"""Append distilled document facts into Hermes' MEMORY.md.

MEMORY.md (``$HERMES_HOME/memories/MEMORY.md``) is the agent's persistent
memory, loaded into the system prompt every session. Entries are separated by
the delimiter ``\\n§\\n`` (matching ``tools/memory_tool``), and each entry is a
free-form Markdown block.

This module writes exactly one managed entry per ingested document, tagged with
a stable ``[unsiloed-doc: <slug>]`` header so a re-ingest *replaces* rather than
duplicates it. Each entry carries the key facts, the entity list as
``[[wikilinks]]`` into the wiki, and a provenance path back to the raw source —
so a later session can recall the fact *and* trace it.

Writes are atomic (temp file + rename) under an advisory lock, the same shape
the host uses, so a concurrent reader always sees a complete file.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import List, Optional, Sequence

from . import config

ENTRY_DELIMITER = "\n§\n"
_TAG_PREFIX = "[unsiloed-doc:"


def _memory_file() -> Path:
    d = config.memory_dir()
    d.mkdir(parents=True, exist_ok=True)
    return d / "MEMORY.md"


def _lock_file(path: Path):
    """Best-effort advisory lock; returns an open fd (or None if unavailable)."""
    lock_path = path.with_suffix(path.suffix + ".lock")
    try:
        import fcntl

        fd = open(lock_path, "a+")
        fcntl.flock(fd.fileno(), fcntl.LOCK_EX)
        return fd
    except Exception:
        return None


def _unlock(fd) -> None:
    if fd is None:
        return
    try:
        import fcntl

        fcntl.flock(fd.fileno(), fcntl.LOCK_UN)
    except Exception:
        pass
    finally:
        try:
            fd.close()
        except Exception:
            pass


def _split(raw: str) -> List[str]:
    return [e for e in (s.strip() for s in raw.split(ENTRY_DELIMITER)) if e]


def _atomic_replace(path: Path, content: str) -> None:
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".mem_", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def build_entry(
    *,
    slug: str,
    title: str,
    source: str,
    ingested_at: str,
    key_facts: Sequence[str],
    entities: Sequence[str],
    provenance: str,
) -> str:
    lines = [
        f"{_TAG_PREFIX} {slug}] {title}",
        f"Ingested {ingested_at} from {source} · wiki: [[{slug}]] · provenance: {provenance}",
    ]
    facts = [f.strip() for f in key_facts if f and f.strip()]
    if facts:
        lines.append("")
        lines.append("Key facts:")
        lines.extend(f"- {f}" for f in facts)
    ents = [e.strip() for e in entities if e and e.strip()]
    if ents:
        lines.append("")
        lines.append("Entities: " + ", ".join(f"[[{e}]]" for e in ents))
    return "\n".join(lines).strip()


def upsert_document_memory(
    *,
    slug: str,
    title: str,
    source: str,
    ingested_at: str,
    key_facts: Sequence[str],
    entities: Sequence[str],
    provenance: str,
    path: Optional[Path] = None,
) -> Path:
    """Write/replace the managed MEMORY.md entry for one document."""
    path = path or _memory_file()
    entry = build_entry(
        slug=slug, title=title, source=source, ingested_at=ingested_at,
        key_facts=key_facts, entities=entities, provenance=provenance,
    )
    tag = f"{_TAG_PREFIX} {slug}]"

    lock = _lock_file(path)
    try:
        raw = path.read_text(encoding="utf-8") if path.exists() else ""
        entries = _split(raw)
        # drop any prior managed entry for this slug
        entries = [e for e in entries if not e.startswith(tag)]
        entries.append(entry)
        _atomic_replace(path, ENTRY_DELIMITER.join(entries) + "\n")
    finally:
        _unlock(lock)
    return path
