#!/usr/bin/env python3
"""Standalone driver for the Unsiloed plugin — exercises the pipeline without a
running Hermes agent.

    python demo_local.py <path-or-url> [search query ...]

It relies only on the plugin package (relative imports resolve because we import
it as the package ``unsiloed``). ``ctx.llm`` isn't available here, so
distillation uses the heuristic path; everything else — Unsiloed parse,
workspace/wiki/memory filing, and hybrid FTS5 + semantic search — is the real
thing. Reads UNSILOED_API_KEY from the environment or ./.env.

By default it isolates its output under a scratch HERMES_HOME/wiki/workspace so
it never touches your real ~/wiki or MEMORY.md; pass --live to use the real
locations.
"""

from __future__ import annotations

import os
import sys
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent
sys.path.insert(0, str(REPO))


def main() -> int:
    args = [a for a in sys.argv[1:]]
    live = "--live" in args
    args = [a for a in args if a != "--live"]
    if not args:
        print(__doc__)
        return 2
    source = args[0]
    queries = args[1:] or [
        "what is this document about",
        source,
    ]

    if not live:
        # Isolate outputs, but leave HERMES_HOME alone so the real Nous login
        # (used for embeddings) is still found.
        scratch = REPO / ".demo-scratch"
        scratch.mkdir(exist_ok=True)
        os.environ["WIKI_PATH"] = str(scratch / "wiki")
        os.environ["UNSILOED_WORKSPACE"] = str(scratch / "ingested")
        os.environ["UNSILOED_PLUGIN_HOME"] = str(scratch / "unsiloed")
        os.environ["UNSILOED_MEMORY_DIR"] = str(scratch / "memories")

    from unsiloed import config, ingest as ingest_mod, search_index
    from unsiloed.embeddings import get_embedder

    if not config.has_unsiloed_key():
        print("ERROR: UNSILOED_API_KEY not set (env or ./.env).", file=sys.stderr)
        return 1

    print(f"== embedding backend: {get_embedder().model_id}")
    print(f"== ingesting: {source}\n")
    result = ingest_mod.ingest(source)
    d = result.to_dict()
    print(json.dumps(
        {k: d[k] for k in (
            "slug", "title", "pages", "chunks", "distill_method",
            "workspace_markdown", "workspace_json", "wiki_raw",
            "entities", "concepts", "memory_file",
        )},
        indent=2, ensure_ascii=False,
    ))
    print(f"\n  key_facts ({len(d['key_facts'])}):")
    for f in d["key_facts"][:8]:
        print(f"   - {f}")
    print(f"\n  wiki pages filed: {len(d['wiki_pages'])}")

    for q in queries:
        print(f"\n== document_search: {q!r}")
        hits = search_index.search(q, limit=5)
        if not hits:
            print("   (no matches)")
        for i, h in enumerate(hits, 1):
            page = f" p.{h.page_no}" if h.page_no is not None else ""
            tags = []
            if h.lexical_rank is not None:
                tags.append(f"lex#{h.lexical_rank}")
            if h.semantic_rank is not None:
                tags.append(f"sem#{h.semantic_rank}")
            print(f"   {i}. [{h.title}{page}] score={h.score} ({', '.join(tags)})")
            print(f"      {h.snippet(160)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())