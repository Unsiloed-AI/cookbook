"""Unsiloed document plugin for Hermes Agent.

Bundles three capabilities around the Unsiloed document API:

1. **Ingestion** (``unsiloed_ingest``) — parse PDFs, tables, charts, and scans
   into clean Markdown + structured JSON, saved to the workspace and filed into
   the LLM Wiki with frontmatter, wikilinks, and provenance.
2. **Memory + Wiki** — distilled key facts and entities land in MEMORY.md and as
   interlinked wiki pages that trace back to the raw source.
3. **Hybrid search** (``document_search``) — SQLite FTS5 + semantic vectors over
   every ingested document for accurate cross-session recall.

Also registers the ``/docs`` slash command (status/list/search/ingest/
reindex).

Loaded as a ``kind: backend`` plugin. Tools that call the Unsiloed API gate on
``UNSILOED_API_KEY``; ``document_search`` is always available.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def register(ctx) -> None:
    """Entry point called once by the Hermes plugin loader."""
    from .tools import make_tool_handlers, handle_slash

    for name, schema, handler, check_fn, emoji in make_tool_handlers(ctx):
        ctx.register_tool(
            name=name,
            toolset="unsiloed",
            schema=schema,
            handler=handler,
            check_fn=check_fn,
            emoji=emoji,
        )

    ctx.register_command(
        "docs",
        handler=handle_slash,
        description="Document ingestion & hybrid search.",
        args_hint="status | list | search <q> | ingest <path|url> | reindex",
    )

    logger.debug("unsiloed plugin registered 3 tools + /docs command")
