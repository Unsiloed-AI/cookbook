# Claude Sonnet 5 vs. Claude Fable 5 — Coding Comparison

Source code from the head-to-head coding comparison between **Claude Sonnet 5** and
**Claude Fable 5**. Each model was given the same two tasks; this repo collects
everything each model produced, organized by task and model.

Companion blog post: *Claude Sonnet 5 vs. Claude Fable 5: Coding Comparison*.

## Structure

```
claude-sonnet-5-vs-claude-fable-5/
├── clash-royale-game/          # Task 1 — build a web-based Clash Royale-style game
│   ├── fable-5/                #   Fable 5's build
│   └── sonnet-5/               #   Sonnet 5's build
├── openwebui-rag-debugger/     # Task 2 — add a RAG Debugger inside the Open WebUI codebase
│   ├── fable-5/                #   Fable 5's build (full Open WebUI fork + the feature)
│   └── sonnet-5/               #   Sonnet 5's build (full Open WebUI fork + the feature)
└── prompts/                    # The exact prompts given to both models
    ├── clash-royale-game-prompt.md
    └── openwebui-rag-debugger-prompt.md
```

## Tasks

### Task 1 — Web-based Clash Royale-style game
Each model built a browser-based real-time lane/tower battle game (lobby, custom
decks, PvP + vs-bot, elixir system, units, towers, win/loss). See
[`prompts/clash-royale-game-prompt.md`](prompts/clash-royale-game-prompt.md).

### Task 2 — RAG Debugger in Open WebUI
Each model added a RAG Debugger feature to the (~400K-line) Open WebUI codebase —
a way to inspect document processing, chunks, metadata, and retrieval results
before the LLM answers. The folders contain the full Open WebUI fork with each
model's changes applied. See
[`prompts/openwebui-rag-debugger-prompt.md`](prompts/openwebui-rag-debugger-prompt.md).

## Provenance

Code exported (without git history) from the branches of the original test repo:

| Folder | Original branch |
| --- | --- |
| `clash-royale-game/fable-5` | `fable-5-cr` |
| `clash-royale-game/sonnet-5` | `sonnet-5-cr` |
| `openwebui-rag-debugger/fable-5` | `fable-5-agentic-test-openwebui` |
| `openwebui-rag-debugger/sonnet-5` | `sonnet-5-agentic-test-openwebui` |

The `openwebui-rag-debugger/*` folders include upstream Open WebUI source, which
is distributed under its own license — see the `LICENSE` file inside each folder.
