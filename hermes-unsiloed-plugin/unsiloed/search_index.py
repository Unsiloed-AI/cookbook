"""Persistent hybrid document index: SQLite FTS5 + semantic vectors.

One SQLite database (``$HERMES_HOME/unsiloed/documents.db``) holds every
ingested document so recall works across sessions.

Schema
------
* ``documents`` — one row per ingested source (slug, title, provenance, hash).
* ``chunks``    — one row per Unsiloed chunk (text, page, packed float32 vector,
                  the embed-model id that produced the vector).
* ``chunks_fts``— an FTS5 table over chunk text for BM25 lexical ranking.

Search
------
``search()`` runs two independent retrievers and fuses them with Reciprocal
Rank Fusion (RRF), which needs no score calibration between the BM25 and cosine
spaces:

    fused_score(chunk) = Σ  1 / (k + rank_in_list)

* Lexical  — FTS5 ``MATCH`` ordered by ``bm25()``.
* Semantic — cosine of the query vector against every chunk vector whose
             ``embed_model`` matches the *current* embedder (so we never
             compare vectors from two different embedding spaces; rows indexed
             under a since-changed embedder simply don't contribute semantic
             signal until ``reindex``).

Cosine is a plain dot product because vectors are stored L2-normalised.
"""

from __future__ import annotations

import array
import re
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

from . import config
from .embeddings import Embedder, get_embedder

_RRF_K = 60  # standard RRF damping constant
_write_lock = threading.Lock()


# --------------------------------------------------------------------------
# vector (de)serialisation — float32 packed bytes, no numpy
# --------------------------------------------------------------------------


def _pack(vec: Sequence[float]) -> bytes:
    return array.array("f", vec).tobytes()


def _unpack(blob: bytes) -> array.array:
    a = array.array("f")
    a.frombytes(blob)
    return a


def _dot(a: array.array, b: Sequence[float]) -> float:
    # both operands are L2-normalised => dot == cosine
    n = min(len(a), len(b))
    return sum(a[i] * b[i] for i in range(n))


# --------------------------------------------------------------------------
# connection / schema
# --------------------------------------------------------------------------


def _connect(path: Optional[Path] = None) -> sqlite3.Connection:
    con = sqlite3.connect(str(path or config.db_path()))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    _ensure_schema(con)
    return con


def _ensure_schema(con: sqlite3.Connection) -> None:
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS documents (
            doc_id       INTEGER PRIMARY KEY AUTOINCREMENT,
            slug         TEXT UNIQUE NOT NULL,
            title        TEXT,
            source       TEXT,
            sha256       TEXT,
            page_count   INTEGER,
            chunk_count  INTEGER,
            ingested_at  TEXT,
            workspace_md TEXT,
            wiki_raw     TEXT
        );

        CREATE TABLE IF NOT EXISTS chunks (
            chunk_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id      INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
            ordinal     INTEGER,
            page_no     INTEGER,
            text        TEXT NOT NULL,
            vec         BLOB,
            embed_model TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);

        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
            text,
            content='chunks',
            content_rowid='chunk_id',
            tokenize='porter unicode61'
        );

        -- keep the FTS index in lockstep with the chunks table
        CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
            INSERT INTO chunks_fts(rowid, text) VALUES (new.chunk_id, new.text);
        END;
        CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
            INSERT INTO chunks_fts(chunks_fts, rowid, text)
                VALUES('delete', old.chunk_id, old.text);
        END;
        CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
            INSERT INTO chunks_fts(chunks_fts, rowid, text)
                VALUES('delete', old.chunk_id, old.text);
            INSERT INTO chunks_fts(rowid, text) VALUES (new.chunk_id, new.text);
        END;
        """
    )
    con.commit()


# --------------------------------------------------------------------------
# indexing
# --------------------------------------------------------------------------


@dataclass
class IndexedDoc:
    doc_id: int
    slug: str
    chunk_count: int
    replaced: bool


def index_document(
    *,
    slug: str,
    title: str,
    source: str,
    sha256: str,
    page_count: int,
    chunks: Sequence[Tuple[int, Optional[int], str]],  # (ordinal, page_no, text)
    ingested_at: str,
    workspace_md: str = "",
    wiki_raw: str = "",
    embedder: Optional[Embedder] = None,
    db: Optional[Path] = None,
) -> IndexedDoc:
    """Insert (or replace) a document and all its chunks + vectors."""
    embedder = embedder or get_embedder()
    texts = [t for (_, _, t) in chunks]
    vectors = embedder.embed(texts) if texts else []

    with _write_lock:
        con = _connect(db)
        try:
            replaced = False
            row = con.execute(
                "SELECT doc_id FROM documents WHERE slug = ?", (slug,)
            ).fetchone()
            if row is not None:
                con.execute("DELETE FROM documents WHERE doc_id = ?", (row["doc_id"],))
                replaced = True

            cur = con.execute(
                """INSERT INTO documents
                   (slug, title, source, sha256, page_count, chunk_count,
                    ingested_at, workspace_md, wiki_raw)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    slug, title, source, sha256, page_count, len(texts),
                    ingested_at, workspace_md, wiki_raw,
                ),
            )
            doc_id = int(cur.lastrowid)

            for (ordinal, page_no, text), vec in zip(chunks, vectors):
                con.execute(
                    """INSERT INTO chunks
                       (doc_id, ordinal, page_no, text, vec, embed_model)
                       VALUES (?,?,?,?,?,?)""",
                    (doc_id, ordinal, page_no, text, _pack(vec), embedder.model_id),
                )
            con.commit()
            return IndexedDoc(doc_id, slug, len(texts), replaced)
        finally:
            con.close()


# --------------------------------------------------------------------------
# search
# --------------------------------------------------------------------------


@dataclass
class SearchHit:
    chunk_id: int
    doc_id: int
    slug: str
    title: str
    source: str
    page_no: Optional[int]
    text: str
    score: float
    lexical_rank: Optional[int]
    semantic_rank: Optional[int]

    def snippet(self, width: int = 320) -> str:
        s = re.sub(r"\s+", " ", self.text).strip()
        return s[:width] + ("…" if len(s) > width else "")


_FTS_SPECIAL = re.compile(r'["\']')


def _fts_query(q: str) -> str:
    """Turn free text into a safe FTS5 OR-of-terms query."""
    terms = re.findall(r"[A-Za-z0-9]+", q)
    if not terms:
        return ""
    return " OR ".join(f'"{t}"' for t in terms)


def _lexical(
    con: sqlite3.Connection, query: str, limit: int, doc_ids: Optional[Sequence[int]]
) -> List[sqlite3.Row]:
    match = _fts_query(query)
    if not match:
        return []
    sql = (
        "SELECT c.chunk_id AS chunk_id "
        "FROM chunks_fts f JOIN chunks c ON c.chunk_id = f.rowid "
        "WHERE chunks_fts MATCH ? "
    )
    params: List[object] = [match]
    if doc_ids:
        sql += f"AND c.doc_id IN ({','.join('?' * len(doc_ids))}) "
        params.extend(doc_ids)
    sql += "ORDER BY bm25(chunks_fts) ASC LIMIT ?"
    params.append(limit)
    return con.execute(sql, params).fetchall()


def _semantic(
    con: sqlite3.Connection,
    query: str,
    limit: int,
    embedder: Embedder,
    doc_ids: Optional[Sequence[int]],
) -> List[int]:
    qvec = embedder.embed_one(query)
    sql = "SELECT chunk_id, vec FROM chunks WHERE embed_model = ? AND vec IS NOT NULL"
    params: List[object] = [embedder.model_id]
    if doc_ids:
        sql += f" AND doc_id IN ({','.join('?' * len(doc_ids))})"
        params.extend(doc_ids)
    scored: List[Tuple[float, int]] = []
    for row in con.execute(sql, params):
        sim = _dot(_unpack(row["vec"]), qvec)
        scored.append((sim, row["chunk_id"]))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [cid for _, cid in scored[:limit]]


def search(
    query: str,
    *,
    limit: int = 8,
    pool: int = 40,
    embedder: Optional[Embedder] = None,
    doc_ids: Optional[Sequence[int]] = None,
    db: Optional[Path] = None,
) -> List[SearchHit]:
    """Hybrid FTS5 + semantic retrieval, fused with Reciprocal Rank Fusion."""
    query = (query or "").strip()
    if not query:
        return []
    embedder = embedder or get_embedder()
    con = _connect(db)
    try:
        lex = [r["chunk_id"] for r in _lexical(con, query, pool, doc_ids)]
        sem = _semantic(con, query, pool, embedder, doc_ids)

        fused: Dict[int, float] = {}
        lex_rank: Dict[int, int] = {}
        sem_rank: Dict[int, int] = {}
        for rank, cid in enumerate(lex):
            fused[cid] = fused.get(cid, 0.0) + 1.0 / (_RRF_K + rank)
            lex_rank[cid] = rank
        for rank, cid in enumerate(sem):
            fused[cid] = fused.get(cid, 0.0) + 1.0 / (_RRF_K + rank)
            sem_rank[cid] = rank

        if not fused:
            return []
        top = sorted(fused.items(), key=lambda t: t[1], reverse=True)[:limit]
        ids = [cid for cid, _ in top]

        placeholders = ",".join("?" * len(ids))
        rows = {
            r["chunk_id"]: r
            for r in con.execute(
                f"""SELECT c.chunk_id, c.doc_id, c.page_no, c.text,
                           d.slug, d.title, d.source
                    FROM chunks c JOIN documents d ON d.doc_id = c.doc_id
                    WHERE c.chunk_id IN ({placeholders})""",
                ids,
            )
        }
        hits: List[SearchHit] = []
        for cid, score in top:
            r = rows.get(cid)
            if r is None:
                continue
            hits.append(
                SearchHit(
                    chunk_id=cid,
                    doc_id=r["doc_id"],
                    slug=r["slug"],
                    title=r["title"] or r["slug"],
                    source=r["source"] or "",
                    page_no=r["page_no"],
                    text=r["text"],
                    score=round(score, 6),
                    lexical_rank=lex_rank.get(cid),
                    semantic_rank=sem_rank.get(cid),
                )
            )
        return hits
    finally:
        con.close()


# --------------------------------------------------------------------------
# introspection / maintenance
# --------------------------------------------------------------------------


def list_documents(db: Optional[Path] = None) -> List[Dict[str, object]]:
    con = _connect(db)
    try:
        return [
            dict(r)
            for r in con.execute(
                """SELECT slug, title, source, page_count, chunk_count,
                          ingested_at FROM documents ORDER BY ingested_at DESC"""
            )
        ]
    finally:
        con.close()


def stats(db: Optional[Path] = None) -> Dict[str, object]:
    con = _connect(db)
    try:
        docs = con.execute("SELECT COUNT(*) AS n FROM documents").fetchone()["n"]
        chunks = con.execute("SELECT COUNT(*) AS n FROM chunks").fetchone()["n"]
        models = [
            r["embed_model"]
            for r in con.execute(
                "SELECT DISTINCT embed_model FROM chunks WHERE embed_model IS NOT NULL"
            )
        ]
        return {
            "documents": docs,
            "chunks": chunks,
            "embed_models": models,
            "db_path": str(config.db_path()),
        }
    finally:
        con.close()


def reindex_vectors(embedder: Optional[Embedder] = None, db: Optional[Path] = None) -> int:
    """Recompute every chunk vector with the current embedder. Returns count."""
    embedder = embedder or get_embedder()
    with _write_lock:
        con = _connect(db)
        try:
            rows = con.execute("SELECT chunk_id, text FROM chunks").fetchall()
            texts = [r["text"] for r in rows]
            if not texts:
                return 0
            vectors = embedder.embed(texts)
            for r, vec in zip(rows, vectors):
                con.execute(
                    "UPDATE chunks SET vec = ?, embed_model = ? WHERE chunk_id = ?",
                    (_pack(vec), embedder.model_id, r["chunk_id"]),
                )
            con.commit()
            return len(rows)
        finally:
            con.close()
