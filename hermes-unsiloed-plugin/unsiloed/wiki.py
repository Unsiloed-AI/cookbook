"""Writer for Karpathy's LLM Wiki layout (the ``llm-wiki`` skill's convention).

A wiki is just a directory of Markdown files at ``$WIKI_PATH`` (default
``~/wiki``) with three layers:

    wiki/
    ├── SCHEMA.md        conventions
    ├── index.md         sectioned catalog
    ├── log.md           append-only action log
    ├── raw/documents/   Layer 1: immutable ingested sources
    ├── entities/        Layer 2: people / orgs / products
    ├── concepts/        Layer 2: topics
    └── queries/         Layer 2: filed query results

This module only writes the deterministic parts: raw source pages (with a
sha256 so re-ingests can detect drift), entity/concept pages carrying
frontmatter + ``[[wikilinks]]`` + provenance markers, and the index/log
bookkeeping. The *content* of entity/concept pages (summary, facts) is produced
upstream by the LLM in ``ingest.py`` — here we just file it consistently.
"""

from __future__ import annotations

import re
import threading
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Sequence

from . import config

_lock = threading.RLock()

_SECTION_FOR_KIND = {
    "entity": "Entities",
    "concept": "Concepts",
    "comparison": "Comparisons",
    "query": "Queries",
    "summary": "Summaries",
}
_DIR_FOR_KIND = {
    "entity": "entities",
    "concept": "concepts",
    "comparison": "comparisons",
    "query": "queries",
    "summary": "concepts",
}


def slugify(text: str, max_len: int = 60) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return (text or "untitled")[:max_len].strip("-")


def _today() -> str:
    return date.today().isoformat()


# --------------------------------------------------------------------------
# structure
# --------------------------------------------------------------------------


def ensure_wiki(root: Optional[Path] = None) -> Path:
    root = root or config.wiki_path()
    with _lock:
        for sub in ("raw/documents", "raw/assets", "entities", "concepts",
                    "comparisons", "queries"):
            (root / sub).mkdir(parents=True, exist_ok=True)
        schema = root / "SCHEMA.md"
        if not schema.exists():
            schema.write_text(_SCHEMA_TEMPLATE, encoding="utf-8")
        index = root / "index.md"
        if not index.exists():
            index.write_text(_INDEX_TEMPLATE, encoding="utf-8")
        log = root / "log.md"
        if not log.exists():
            log.write_text("# Wiki Log\n\n", encoding="utf-8")
    return root


# --------------------------------------------------------------------------
# frontmatter helpers
# --------------------------------------------------------------------------


def _fm_value(v) -> str:
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(str(x) for x in v) + "]"
    return str(v)


def _frontmatter(fields: Dict[str, object]) -> str:
    lines = ["---"]
    for k, v in fields.items():
        if v is None or v == [] or v == "":
            continue
        lines.append(f"{k}: {_fm_value(v)}")
    lines.append("---")
    return "\n".join(lines)


def _atomic_write(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(path)


# --------------------------------------------------------------------------
# raw source
# --------------------------------------------------------------------------


def write_raw_source(
    *,
    slug: str,
    title: str,
    content: str,
    source: str,
    sha256: str,
    page_count: int,
    root: Optional[Path] = None,
) -> Path:
    """Write the immutable parsed source into ``raw/documents/<slug>.md``.

    Returns the wiki-relative path used for provenance (``raw/documents/…``).
    """
    root = ensure_wiki(root)
    rel = f"raw/documents/{slug}.md"
    path = root / rel
    fm = _frontmatter(
        {
            "title": title,
            "type": "raw-source",
            "source": source,
            "ingested": _today(),
            "sha256": sha256,
            "pages": page_count,
            "parser": "unsiloed",
        }
    )
    with _lock:
        _atomic_write(path, f"{fm}\n\n# {title}\n\n{content.strip()}\n")
    return path


def raw_rel_path(slug: str) -> str:
    return f"raw/documents/{slug}.md"


# --------------------------------------------------------------------------
# entity / concept pages
# --------------------------------------------------------------------------


def upsert_page(
    *,
    kind: str,
    title: str,
    body: str,
    tags: Optional[Sequence[str]] = None,
    sources: Optional[Sequence[str]] = None,
    wikilinks: Optional[Sequence[str]] = None,
    provenance: Optional[str] = None,
    root: Optional[Path] = None,
) -> Dict[str, object]:
    """Create or update an entity/concept page.

    On update, we append the new body under a dated section rather than
    overwrite — the wiki is meant to *compound*. ``updated`` is always bumped.
    ``wikilinks`` are rendered as a "Related" line of ``[[links]]``;
    ``provenance`` (e.g. ``raw/documents/foo.md``) is appended as a ``^[...]``
    marker so each claim traces back to its source.
    """
    root = ensure_wiki(root)
    kind = kind if kind in _DIR_FOR_KIND else "concept"
    directory = _DIR_FOR_KIND[kind]
    slug = slugify(title)
    path = root / directory / f"{slug}.md"

    related = ""
    if wikilinks:
        uniq = []
        for w in wikilinks:
            wl = f"[[{w}]]" if not w.startswith("[[") else w
            if wl not in uniq:
                uniq.append(wl)
        related = "\n\n**Related:** " + " · ".join(uniq)

    prov = f" ^[{provenance}]" if provenance else ""
    block = body.strip() + prov + related

    with _lock:
        created = not path.exists()
        if created:
            fm = _frontmatter(
                {
                    "title": title,
                    "created": _today(),
                    "updated": _today(),
                    "type": kind,
                    "tags": list(tags or []),
                    "sources": list(sources or []),
                }
            )
            _atomic_write(path, f"{fm}\n\n# {title}\n\n{block}\n")
        else:
            existing = path.read_text(encoding="utf-8")
            existing = _bump_updated(existing)
            existing = _merge_sources(existing, sources or [])
            addition = f"\n\n## Update {_today()}\n\n{block}\n"
            _atomic_write(path, existing.rstrip() + addition)

    return {"kind": kind, "slug": slug, "title": title,
            "path": str(path), "created": created}


def _bump_updated(text: str) -> str:
    return re.sub(r"(?m)^updated:\s*.*$", f"updated: {_today()}", text, count=1)


def _merge_sources(text: str, new_sources: Sequence[str]) -> str:
    if not new_sources:
        return text
    m = re.search(r"(?m)^sources:\s*\[(.*)\]\s*$", text)
    if not m:
        return text
    current = [s.strip() for s in m.group(1).split(",") if s.strip()]
    for s in new_sources:
        if s not in current:
            current.append(s)
    return text[: m.start()] + f"sources: [{', '.join(current)}]" + text[m.end():]


# --------------------------------------------------------------------------
# index + log
# --------------------------------------------------------------------------


def add_to_index(
    section: str, title: str, slug: str, summary: str, subdir: str,
    root: Optional[Path] = None,
) -> None:
    root = ensure_wiki(root)
    index = root / "index.md"
    line = f"- [[{slug}]] — {summary}".rstrip()
    header = f"## {section}"
    with _lock:
        text = index.read_text(encoding="utf-8") if index.exists() else _INDEX_TEMPLATE
        if line in text:
            return
        if header in text:
            # insert right after the section header
            text = re.sub(
                re.escape(header) + r"\n",
                f"{header}\n{line}\n",
                text,
                count=1,
            )
        else:
            text = text.rstrip() + f"\n\n{header}\n{line}\n"
        _atomic_write(index, text)


def append_log(entry: str, root: Optional[Path] = None) -> None:
    root = ensure_wiki(root)
    log = root / "log.md"
    with _lock:
        with open(log, "a", encoding="utf-8") as f:
            f.write(f"- {_today()} — {entry}\n")


def index_entity(kind: str, page: Dict[str, object], summary: str,
                 root: Optional[Path] = None) -> None:
    section = _SECTION_FOR_KIND.get(kind, "Concepts")
    subdir = _DIR_FOR_KIND.get(kind, "concepts")
    add_to_index(section, str(page["title"]), str(page["slug"]), summary, subdir, root)


# --------------------------------------------------------------------------
# templates
# --------------------------------------------------------------------------

_SCHEMA_TEMPLATE = """\
# Wiki Schema

## Domain
Documents ingested via the Unsiloed Hermes plugin (PDFs, tables, charts, scans).

## Conventions
- File names: lowercase, hyphens, no spaces.
- Every page starts with YAML frontmatter (title, created, updated, type, tags, sources).
- Use `[[wikilinks]]` to link between pages.
- Raw sources live in `raw/documents/` and are immutable (agent reads, never edits).
- Pages that synthesize a source append a provenance marker `^[raw/documents/<slug>.md]`.
- Every new page is added to `index.md`; every ingest is appended to `log.md`.

## Frontmatter
```yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | raw-source
tags: []
sources: [raw/documents/source-slug.md]
---
```
"""

_INDEX_TEMPLATE = """\
# Wiki Index

Content catalog. Each entry links to a page with a one-line summary.

## Summaries

## Entities

## Concepts

## Comparisons

## Queries
"""
