"""End-to-end ingestion: Unsiloed parse -> workspace -> wiki -> memory -> index.

The spine of every demo in this repo: **Unsiloed grounds the facts (Markdown +
citations); the model does only the judgment.** Here Unsiloed parses the
document into Markdown chunks, then the host LLM (``ctx.llm``) distills a
summary, grounded key facts, entities, and concepts. Those get filed four ways:

1. **Workspace** — clean ``<slug>.md`` (with frontmatter) + ``<slug>.json``
   (structured: chunks, pages, distilled facts, optional typed extraction).
2. **LLM Wiki** — an immutable raw source page plus entity/concept pages with
   frontmatter, ``[[wikilinks]]``, and provenance markers; index + log updated.
3. **MEMORY.md** — one managed entry of key facts + entities with provenance.
4. **Search index** — chunks indexed for hybrid FTS5 + semantic retrieval.

If no LLM is available (standalone use, or ``ctx.llm`` gated off), a
deterministic heuristic still produces a summary, grounded numeric facts, and
concepts from headings — so ingestion never hard-depends on the model.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import config, memory_writer, search_index, wiki
from .unsiloed_client import ParseResult, UnsiloedClient

_MAX_DISTILL_CHARS = 24000  # keep LLM token usage bounded

_DISTILL_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "key_facts": {"type": "array", "items": {"type": "string"}},
        "entities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "type": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["name"],
            },
        },
        "concepts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "summary": {"type": "string"},
                },
                "required": ["name"],
            },
        },
    },
    "required": ["summary", "key_facts", "entities", "concepts"],
}

_DISTILL_INSTRUCTIONS = (
    "You are a knowledge-base curator. From the document Markdown, extract: "
    "(1) a 2-4 sentence summary; (2) up to 8 grounded key facts — prefer facts "
    "with concrete numbers, dates, amounts, or named parties, and NEVER invent "
    "anything not in the text; (3) the salient named entities (people, "
    "organizations, products, places) each with a type and a one-line "
    "description; (4) the main concepts/topics. Use only information present in "
    "the document."
)


@dataclass
class Distillation:
    summary: str = ""
    key_facts: List[str] = field(default_factory=list)
    entities: List[Dict[str, str]] = field(default_factory=list)
    concepts: List[Dict[str, str]] = field(default_factory=list)
    method: str = "heuristic"


@dataclass
class IngestResult:
    slug: str
    title: str
    source: str
    sha256: str
    page_count: int
    chunk_count: int
    workspace_md: str
    workspace_json: str
    wiki_raw: str
    wiki_pages: List[Dict[str, Any]]
    memory_path: str
    distillation: Distillation
    extracted: Optional[Dict[str, Any]]
    index_replaced: bool

    def to_dict(self) -> Dict[str, Any]:
        hr = config.home_relative
        return {
            "slug": self.slug,
            "title": self.title,
            "source": hr(self.source),
            "sha256": self.sha256,
            "pages": self.page_count,
            "chunks": self.chunk_count,
            "workspace_markdown": hr(self.workspace_md),
            "workspace_json": hr(self.workspace_json),
            "wiki_raw": hr(self.wiki_raw),
            "wiki_pages": [{**p, "path": hr(p.get("path", ""))} for p in self.wiki_pages],
            "memory_file": hr(self.memory_path),
            "summary": self.distillation.summary,
            "key_facts": self.distillation.key_facts,
            "entities": [e.get("name") for e in self.distillation.entities],
            "concepts": [c.get("name") for c in self.distillation.concepts],
            "distill_method": self.distillation.method,
            "extracted": self.extracted,
            "reindexed_existing": self.index_replaced,
        }


# --------------------------------------------------------------------------
# distillation
# --------------------------------------------------------------------------


def _llm_distill(llm: Any, markdown: str) -> Optional[Distillation]:
    """Use the host LLM (ctx.llm) to distill. Returns None on any failure."""
    try:
        from agent.plugin_llm import PluginLlmTextInput
    except Exception:
        return None
    text = markdown[:_MAX_DISTILL_CHARS]
    if len(markdown) > _MAX_DISTILL_CHARS:
        text += "\n\n[...document truncated for distillation...]"
    try:
        result = llm.complete_structured(
            instructions=_DISTILL_INSTRUCTIONS,
            input=[PluginLlmTextInput(text=text)],
            json_schema=_DISTILL_SCHEMA,
            max_tokens=1600,
            temperature=0.0,
            purpose="unsiloed-distill",
        )
    except Exception:
        return None
    data = getattr(result, "parsed", None)
    if not isinstance(data, dict):
        return None
    return Distillation(
        summary=str(data.get("summary", "")).strip(),
        key_facts=[str(f).strip() for f in data.get("key_facts", []) if str(f).strip()],
        entities=[
            {k: str(v) for k, v in e.items()}
            for e in data.get("entities", [])
            if isinstance(e, dict) and e.get("name")
        ],
        concepts=[
            {k: str(v) for k, v in c.items()}
            for c in data.get("concepts", [])
            if isinstance(c, dict) and c.get("name")
        ],
        method="llm",
    )


_SENT_RE = re.compile(r"(?<=[.!?])\s+")
_NUMISH = re.compile(r"\d|\$|%|USD|EUR|GBP")


def _heuristic_distill(markdown: str) -> Distillation:
    # strip markdown tables/pipes noise for sentence work
    plain = re.sub(r"\|", " ", markdown)
    paras = [p.strip() for p in plain.split("\n\n") if p.strip()]
    body = [p for p in paras if not p.lstrip().startswith("#")]

    summary = " ".join(body[:2])[:600] if body else ""

    # grounded facts: sentences that carry numbers / money / percent
    facts: List[str] = []
    for p in body:
        for sent in _SENT_RE.split(p):
            s = re.sub(r"\s+", " ", sent).strip()
            if 20 <= len(s) <= 240 and _NUMISH.search(s):
                facts.append(s)
            if len(facts) >= 8:
                break
        if len(facts) >= 8:
            break

    # concepts: markdown headings
    concepts: List[Dict[str, str]] = []
    seen = set()
    for m in re.finditer(r"(?m)^#{1,3}\s+(.+?)\s*$", markdown):
        name = m.group(1).strip()
        key = name.lower()
        words = re.findall(r"[A-Za-z][A-Za-z'-]+", name)
        if len(words) < 2:
            continue
        if 3 <= len(name) <= 60 and key not in seen:
            seen.add(key)
            concepts.append({"name": name, "summary": ""})
        if len(concepts) >= 8:
            break

    return Distillation(
        summary=summary, key_facts=facts, entities=[], concepts=concepts,
        method="heuristic",
    )


def distill(markdown: str, llm: Any = None) -> Distillation:
    if llm is not None:
        d = _llm_distill(llm, markdown)
        if d is not None and (d.summary or d.key_facts or d.entities):
            return d
    return _heuristic_distill(markdown)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def _derive_title(markdown: str, source: str) -> str:
    m = re.search(r"(?m)^#\s+(.+?)\s*$", markdown)
    if m and 3 <= len(m.group(1).strip()) <= 100:
        return m.group(1).strip()
    stem = Path(source.split("?")[0]).stem or "document"
    return re.sub(r"[-_]+", " ", stem).strip().title()


def _write_workspace(
    slug: str, title: str, source: str, sha256: str, pr: ParseResult,
    distillation: Distillation, extracted: Optional[Dict[str, Any]],
) -> Dict[str, str]:
    ws = config.workspace_dir()
    md_path = ws / f"{slug}.md"
    json_path = ws / f"{slug}.json"

    fm = "\n".join([
        "---",
        f"title: {title}",
        f"source: {source}",
        f"ingested: {date.today().isoformat()}",
        f"sha256: {sha256}",
        f"pages: {pr.page_count}",
        f"chunks: {len(pr.chunks)}",
        "parser: unsiloed",
        "---",
    ])
    md_path.write_text(f"{fm}\n\n# {title}\n\n{pr.markdown}\n", encoding="utf-8")

    payload = {
        "slug": slug,
        "title": title,
        "source": source,
        "sha256": sha256,
        "pages": pr.page_count,
        "ingested": date.today().isoformat(),
        "distillation": {
            "method": distillation.method,
            "summary": distillation.summary,
            "key_facts": distillation.key_facts,
            "entities": distillation.entities,
            "concepts": distillation.concepts,
        },
        "extracted": extracted,
        "chunks": [
            {"ordinal": c.ordinal, "page_no": c.page_no, "text": c.text}
            for c in pr.chunks
        ],
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"md": str(md_path), "json": str(json_path)}


def _file_wiki(
    slug: str, title: str, source: str, sha256: str, pr: ParseResult,
    d: Distillation,
) -> Dict[str, Any]:
    wiki.ensure_wiki()
    raw_path = wiki.write_raw_source(
        slug=slug, title=title, content=pr.markdown, source=source,
        sha256=sha256, page_count=pr.page_count,
    )
    provenance = wiki.raw_rel_path(slug)
    raw_source_ref = [provenance]

    entity_names = [e["name"] for e in d.entities]
    concept_names = [c["name"] for c in d.concepts]
    cross = entity_names + concept_names

    pages: List[Dict[str, Any]] = []

    # summary page for the document
    if d.summary:
        page = wiki.upsert_page(
            kind="summary", title=title,
            body=d.summary, tags=["unsiloed", "document"],
            sources=raw_source_ref, wikilinks=cross, provenance=provenance,
        )
        wiki.index_entity("summary", page, d.summary[:120])
        pages.append(page)

    for e in d.entities:
        body = e.get("description", "").strip() or f"{e['name']} (from {title})."
        etype = e.get("type", "").strip()
        page = wiki.upsert_page(
            kind="entity", title=e["name"], body=body,
            tags=["unsiloed"] + ([etype] if etype else []),
            sources=raw_source_ref,
            wikilinks=[title] + [n for n in entity_names if n != e["name"]],
            provenance=provenance,
        )
        wiki.index_entity("entity", page, (e.get("description") or etype or "entity")[:120])
        pages.append(page)

    for c in d.concepts:
        body = c.get("summary", "").strip() or f"Concept referenced in {title}."
        page = wiki.upsert_page(
            kind="concept", title=c["name"], body=body,
            tags=["unsiloed"], sources=raw_source_ref,
            wikilinks=[title] + entity_names, provenance=provenance,
        )
        wiki.index_entity("concept", page, (c.get("summary") or "concept")[:120])
        pages.append(page)

    n_ent, n_con = len(d.entities), len(d.concepts)
    wiki.append_log(
        f"Ingested '{title}' ({pr.page_count}p, {len(pr.chunks)} chunks) via Unsiloed; "
        f"{n_ent} entities, {n_con} concepts filed."
    )
    return {"raw": str(raw_path), "pages": pages, "provenance": provenance}


# --------------------------------------------------------------------------
# orchestrator
# --------------------------------------------------------------------------


def ingest(
    source: str,
    *,
    llm: Any = None,
    client: Optional[UnsiloedClient] = None,
    extract_schema: Optional[Dict[str, Any]] = None,
    write_memory: bool = True,
    write_wiki: bool = True,
) -> IngestResult:
    client = client or UnsiloedClient()
    pr = client.parse(source)
    if not pr.chunks:
        raise RuntimeError(f"Unsiloed returned no text for {source!r}")

    markdown = pr.markdown
    sha256 = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
    title = _derive_title(markdown, source)
    slug = wiki.slugify(Path(source.split("?")[0]).stem or title)

    # Everything we STORE or DISPLAY uses a home-relative source so absolute
    # paths never leak the OS username; the real path only reaches the client.
    display_source = config.home_relative(source)

    d = distill(markdown, llm=llm)

    extracted: Optional[Dict[str, Any]] = None
    if extract_schema:
        try:
            extracted = client.extract(source, extract_schema)
        except Exception as exc:  # extraction is best-effort
            extracted = {"error": str(exc)}

    ws = _write_workspace(slug, title, display_source, sha256, pr, d, extracted)

    wiki_info: Dict[str, Any] = {"raw": "", "pages": [], "provenance": ""}
    if write_wiki:
        wiki_info = _file_wiki(slug, title, display_source, sha256, pr, d)

    ingested_at = date.today().isoformat()
    memory_path = ""
    if write_memory:
        p = memory_writer.upsert_document_memory(
            slug=slug, title=title, source=display_source, ingested_at=ingested_at,
            key_facts=d.key_facts,
            entities=[e["name"] for e in d.entities],
            provenance=wiki_info.get("provenance") or wiki.raw_rel_path(slug),
        )
        memory_path = str(p)

    indexed = search_index.index_document(
        slug=slug, title=title, source=display_source, sha256=sha256,
        page_count=pr.page_count,
        chunks=[(c.ordinal, c.page_no, c.text) for c in pr.chunks],
        ingested_at=ingested_at,
        workspace_md=ws["md"], wiki_raw=wiki_info.get("raw", ""),
    )

    return IngestResult(
        slug=slug, title=title, source=display_source, sha256=sha256,
        page_count=pr.page_count, chunk_count=len(pr.chunks),
        workspace_md=ws["md"], workspace_json=ws["json"],
        wiki_raw=wiki_info.get("raw", ""), wiki_pages=wiki_info.get("pages", []),
        memory_path=memory_path, distillation=d, extracted=extracted,
        index_replaced=indexed.replaced,
    )