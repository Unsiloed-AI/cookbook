"""Tool schemas, handlers, and the ``/docs`` slash command.

Three tools are registered (see ``__init__.register``):

* ``unsiloed_ingest``  — parse a document and file it everywhere.
* ``unsiloed_extract`` — typed field extraction (schema -> JSON w/ citations).
* ``document_search``  — hybrid FTS5 + semantic recall over ingested docs.

Handlers are built by :func:`make_tool_handlers`, which binds the host
``ctx`` (for ``ctx.llm``) into each closure. ``ingest``/``extract`` gate on
``UNSILOED_API_KEY``; ``document_search`` needs no key (it reads the local
index) so it stays usable offline.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Dict, List, Tuple

from tools.registry import tool_error, tool_result

from . import config, ingest as ingest_mod, search_index

# --------------------------------------------------------------------------
# schemas
# --------------------------------------------------------------------------

UNSILOED_INGEST_SCHEMA = {
    "name": "unsiloed_ingest",
    "description": (
        "Parse a document (PDF, scan, image, or Office file — local path or "
        "http(s) URL) with Unsiloed into clean Markdown + structured JSON, then "
        "file it into the workspace, the LLM Wiki (entity/concept pages with "
        "wikilinks + provenance), MEMORY.md (key facts), and the hybrid search "
        "index. Use this to permanently ingest a document for later recall."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "source": {
                "type": "string",
                "description": "Local file path or http(s) URL of the document.",
            },
            "extract_schema": {
                "type": "object",
                "description": (
                    "Optional JSON Schema of typed fields to also extract with "
                    "citations (company_name, revenue, ...). Adds a structured "
                    "block to the JSON output."
                ),
            },
            "write_wiki": {
                "type": "boolean",
                "description": "File entity/concept pages into the LLM Wiki (default true).",
            },
            "write_memory": {
                "type": "boolean",
                "description": "Append key facts to MEMORY.md (default true).",
            },
        },
        "required": ["source"],
    },
}

UNSILOED_EXTRACT_SCHEMA = {
    "name": "unsiloed_extract",
    "description": (
        "Extract typed fields from a document with Unsiloed. Returns each field "
        "as {value, score, page_no, bboxes} so every number is citable. Does "
        "NOT file anything — use unsiloed_ingest for that."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "source": {"type": "string", "description": "Local path or http(s) URL."},
            "schema": {
                "type": "object",
                "description": "JSON Schema describing the fields to extract.",
            },
            "model": {
                "type": "string",
                "description": "Unsiloed extract model (default 'gamma').",
            },
        },
        "required": ["source", "schema"],
    },
}

DOCUMENT_SEARCH_SCHEMA = {
    "name": "document_search",
    "description": (
        "Hybrid search over all documents ingested via unsiloed_ingest. Fuses "
        "SQLite FTS5 lexical ranking with semantic vector similarity (Reciprocal "
        "Rank Fusion) for accurate cross-session recall. Returns ranked chunks "
        "with document title, page number, source, and a snippet."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Natural-language or keyword query."},
            "limit": {"type": "integer", "description": "Max results (default 8)."},
        },
        "required": ["query"],
    },
}


# --------------------------------------------------------------------------
# handlers
# --------------------------------------------------------------------------


def _coerce_bool(v: Any, default: bool) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in {"1", "true", "yes", "on"}
    return default


def make_tool_handlers(ctx: Any) -> List[Tuple[str, dict, Callable, Callable, str]]:
    """Return (name, schema, handler, check_fn, emoji) tuples bound to *ctx*."""

    def _llm():
        # ctx.llm is host-owned; fall back to None if unavailable.
        try:
            return ctx.llm
        except Exception:
            return None

    def handle_ingest(args: dict, **_: Any) -> str:
        source = (args or {}).get("source")
        if not source or not isinstance(source, str):
            return tool_error("'source' (file path or URL) is required.")
        extract_schema = (args or {}).get("extract_schema")
        if extract_schema is not None and not isinstance(extract_schema, dict):
            return tool_error("'extract_schema' must be a JSON Schema object.")
        try:
            result = ingest_mod.ingest(
                source,
                llm=_llm(),
                extract_schema=extract_schema or None,
                write_wiki=_coerce_bool((args or {}).get("write_wiki"), True),
                write_memory=_coerce_bool((args or {}).get("write_memory"), True),
            )
        except Exception as exc:
            return tool_error(f"Ingestion failed: {type(exc).__name__}: {exc}")
        return tool_result(result.to_dict())

    def handle_extract(args: dict, **_: Any) -> str:
        source = (args or {}).get("source")
        schema = (args or {}).get("schema")
        if not source or not isinstance(source, str):
            return tool_error("'source' is required.")
        if not isinstance(schema, dict) or not schema:
            return tool_error("'schema' (JSON Schema object) is required.")
        model = (args or {}).get("model") or "gamma"
        try:
            from .unsiloed_client import UnsiloedClient

            result = UnsiloedClient().extract(source, schema, model=str(model))
        except Exception as exc:
            return tool_error(f"Extraction failed: {type(exc).__name__}: {exc}")
        return tool_result({"source": source, "result": result})

    def handle_search(args: dict, **_: Any) -> str:
        query = (args or {}).get("query")
        if not query or not isinstance(query, str):
            return tool_error("'query' is required.")
        limit = (args or {}).get("limit")
        try:
            limit = int(limit) if limit is not None else 8
        except (TypeError, ValueError):
            limit = 8
        limit = max(1, min(50, limit))
        try:
            hits = search_index.search(query, limit=limit)
        except Exception as exc:
            return tool_error(f"Search failed: {type(exc).__name__}: {exc}")
        results = [
            {
                "document": h.title,
                "slug": h.slug,
                "page_no": h.page_no,
                "source": h.source,
                "score": h.score,
                "lexical_rank": h.lexical_rank,
                "semantic_rank": h.semantic_rank,
                "snippet": h.snippet(),
            }
            for h in hits
        ]
        return tool_result({"query": query, "count": len(results), "results": results})

    return [
        ("unsiloed_ingest", UNSILOED_INGEST_SCHEMA, handle_ingest,
         config.has_unsiloed_key, "📥"),
        ("unsiloed_extract", UNSILOED_EXTRACT_SCHEMA, handle_extract,
         config.has_unsiloed_key, "🔎"),
        ("document_search", DOCUMENT_SEARCH_SCHEMA, handle_search,
         (lambda: True), "🧠"),
    ]


# --------------------------------------------------------------------------
# /docs slash command
# --------------------------------------------------------------------------

_HELP = """\
/docs — document ingestion & hybrid search

  status              Index stats + configured paths + embedding backend
  list                List ingested documents
  search <query>      Hybrid FTS5 + semantic search over ingested docs
  ingest <path|url>   Ingest a document (parse -> workspace/wiki/memory/index)
  reindex             Recompute all chunk vectors with the current embedder
"""


def handle_slash(raw_args: str) -> str:
    argv = (raw_args or "").strip().split(maxsplit=1)
    if not argv or argv[0] in {"help", "-h", "--help"}:
        return _HELP
    sub = argv[0]
    rest = argv[1] if len(argv) > 1 else ""

    if sub == "status":
        from .embeddings import get_embedder

        st = search_index.stats()
        emb = get_embedder()
        hr = config.home_relative
        lines = [
            "Document index status",
            f"  documents indexed : {st['documents']}",
            f"  chunks indexed    : {st['chunks']}",
            f"  embed backend     : {emb.model_id}",
            f"  api key set       : {config.has_unsiloed_key()}",
            f"  db                : {hr(st['db_path'])}",
            f"  workspace         : {hr(config.workspace_dir())}",
            f"  wiki              : {hr(config.wiki_path())}",
            f"  memory            : {hr(config.memory_dir() / 'MEMORY.md')}",
        ]
        return "\n".join(lines)

    if sub == "list":
        docs = search_index.list_documents()
        if not docs:
            return "No documents ingested yet. Use `/docs ingest <path|url>`."
        return "\n".join(
            f"- {d['title'] or d['slug']}  ({d['page_count']}p, "
            f"{d['chunk_count']} chunks, {d['ingested_at']})"
            for d in docs
        )

    if sub == "search":
        if not rest.strip():
            return "Usage: /docs search <query>"
        hits = search_index.search(rest.strip(), limit=8)
        if not hits:
            return f"No matches for: {rest.strip()}"
        out = [f"Top {len(hits)} results for: {rest.strip()}", ""]
        for i, h in enumerate(hits, 1):
            page = f" p.{h.page_no}" if h.page_no is not None else ""
            out.append(f"{i}. [{h.title}{page}] (score {h.score})")
            out.append(f"   {h.snippet(240)}")
        return "\n".join(out)

    if sub == "ingest":
        if not rest.strip():
            return "Usage: /docs ingest <path|url>"
        if not config.has_unsiloed_key():
            return "UNSILOED_API_KEY is not set (env or $HERMES_HOME/.env)."
        try:
            result = ingest_mod.ingest(rest.strip())
        except Exception as exc:
            return f"Ingestion failed: {type(exc).__name__}: {exc}"
        r = result.to_dict()
        return (
            f"Ingested '{r['title']}' — {r['pages']}p, {r['chunks']} chunks.\n"
            f"  workspace : {r['workspace_markdown']}\n"
            f"  wiki raw  : {r['wiki_raw']}\n"
            f"  wiki pages: {len(r['wiki_pages'])}  ·  entities: {len(r['entities'])}  "
            f"·  concepts: {len(r['concepts'])}\n"
            f"  memory    : {r['memory_file']}\n"
            f"  facts     : {len(r['key_facts'])}  ·  distilled via {r['distill_method']}"
        )

    if sub == "reindex":
        n = search_index.reindex_vectors()
        from .embeddings import get_embedder

        return f"Re-embedded {n} chunks with {get_embedder().model_id}."

    return f"Unknown subcommand: {sub}\n\n{_HELP}"
