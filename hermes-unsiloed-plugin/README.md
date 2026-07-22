# Unsiloed plugin for Hermes Agent

A [Hermes Agent](https://github.com/NousResearch/hermes-agent) backend plugin that turns
the [Unsiloed](https://unsiloed.ai) document API into three agent capabilities:

1. **Unsiloed-powered ingestion** — parse PDFs, tables, charts, and scanned docs into
   clean Markdown + structured JSON, then save to the **workspace** and the **LLM Wiki**
   with proper frontmatter.
2. **Memory + Wiki integration** — distill key facts/entities into `MEMORY.md` and
   create/update wiki pages with `[[wikilinks]]` and provenance back to the raw source.
3. **Hybrid document search** — a `document_search` tool combining **SQLite FTS5** lexical
   ranking with **semantic** vector retrieval (Reciprocal Rank Fusion) over every ingested
   document, for accurate cross-session recall.

The design follows this repo's spine: **Unsiloed grounds the facts (Markdown + citations);
the model does only the judgment.** Unsiloed parses; the host LLM (`ctx.llm`) distills the
summary, grounded facts, entities, and concepts.

## Tools

| Tool | Gated on | What it does |
|------|----------|--------------|
| `unsiloed_ingest` | `UNSILOED_API_KEY` | Parse a document (path or URL) → workspace `.md`/`.json`, wiki pages, `MEMORY.md` facts, and the search index. Optional `extract_schema` adds typed fields. |
| `unsiloed_extract` | `UNSILOED_API_KEY` | Typed field extraction only — returns each field as `{value, score, page_no, bboxes}` for citable numbers. Files nothing. |
| `document_search` | — (always on) | Hybrid FTS5 + semantic recall over ingested docs. Returns ranked chunks with document, page, source, and snippet. |

Plus a `/docs` slash command: `status`, `list`, `search <q>`, `ingest <path|url>`, `reindex`.

## Install

```bash
# 1. Link (or copy) the plugin package into your Hermes user-plugins dir
ln -s "$PWD/unsiloed" ~/.hermes/plugins/unsiloed
#   (or: cp -r unsiloed ~/.hermes/plugins/unsiloed)

# 2. Enable it (user plugins are opt-in via plugins.enabled in ~/.hermes/config.yaml)
#    install.sh does this for you:
./install.sh
```

`install.sh` symlinks the package and adds `unsiloed` to `plugins.enabled` in
`~/.hermes/config.yaml`. Restart the agent (or `hermes plugins reload`) and check:

```
hermes tools | grep -E "unsiloed|document_search"
```

## Configuration

Read from the environment, then `$HERMES_HOME/.env`, then the project `./.env`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `UNSILOED_API_KEY` | — (required for ingest/extract) | Unsiloed API key (`api-key` header). |
| `UNSILOED_BASE_URL` | `https://prod.visionapi.unsiloed.ai` | Unsiloed v2 base URL. |
| `WIKI_PATH` | `~/wiki` | LLM Wiki root (matches the `llm-wiki` skill). |
| `UNSILOED_WORKSPACE` | `<cwd>/ingested` | Where parsed `.md`/`.json` land. |
| `UNSILOED_PLUGIN_HOME` | `$HERMES_HOME/unsiloed` | Search DB + plugin state. |
| `UNSILOED_EMBED_PROVIDER` | `auto` | `auto` \| `nous` \| `openrouter` \| `openai` \| `hash`. |
| `UNSILOED_EMBED_MODEL` | `openai/text-embedding-3-small` | Embedding model id (OpenAI-compatible; served by both Nous and OpenRouter). |
| `OPENROUTER_API_KEY` | — | Enables the OpenRouter embeddings backend. |
| `UNSILOED_EMBED_API_KEY` / `OPENAI_API_KEY` | — | Key for a custom OpenAI-compatible endpoint (`provider=openai`). |
| `UNSILOED_EMBED_BASE_URL` | `https://api.openai.com/v1` | Base URL for that custom endpoint. |

### Embeddings

Unsiloed does **not** return vector embeddings (its chunk `embed` field is Markdown text,
not a vector), so the plugin computes its own for the semantic half of `document_search`.
Hermes exposes no embeddings SDK/`ctx.llm` method either — but its **inference gateway does
expose an OpenAI-compatible `/v1/embeddings`**, so the plugin uses that. Four backends, one
shared HTTP path (they differ only in base URL + how the bearer token is obtained):

- **`nous`** — the Nous inference gateway's `/v1/embeddings`, authed via the Hermes Nous
  login (`resolve_nous_access_token`, refresh-aware). **Zero extra config.** Requires Nous
  Portal **credits** — all Nous embedding models are paid (cheapest ~$0.01 / 1M tokens,
  e.g. `qwen/qwen3-embedding-8b`); with no credits it returns 404 and `auto` moves on.
- **`openrouter`** — OpenRouter's `/v1/embeddings` using `OPENROUTER_API_KEY`.
- **`openai`** — any OpenAI-compatible endpoint via `UNSILOED_EMBED_BASE_URL` + key.
- **`hash`** — pure-Python feature-hashing fallback (**no deps, no numpy, no network**).
  Fuzzy/word-overlap only — *not* true semantic similarity. Always available offline.

**`auto`** (default) tries, probing each once so a stale login / no credits / offline box
degrades cleanly: custom endpoint → Nous login → OpenRouter key → hash.

Every stored vector is tagged with the model that produced it, so the search layer never
mixes vectors from two embedding spaces. After changing the backend, run `/docs reindex`
to recompute vectors.

## How it files a document

Ingesting `report.pdf` produces:

```
<workspace>/report.md            # clean Markdown + frontmatter
<workspace>/report.json          # {chunks, pages, distillation, extracted}
<WIKI_PATH>/raw/documents/report.md      # immutable source, sha256 in frontmatter
<WIKI_PATH>/entities/<name>.md           # entity pages ([[wikilinks]] + provenance)
<WIKI_PATH>/concepts/<topic>.md          # concept pages
<WIKI_PATH>/index.md, log.md             # catalog + action log updated
$HERMES_HOME/memories/MEMORY.md          # one managed entry: key facts + entities
$HERMES_HOME/unsiloed/documents.db       # FTS5 + vectors for document_search
```

Re-ingesting the same document replaces its MEMORY.md entry and re-indexes it (deduped by
slug) rather than duplicating.

## Try it without Hermes

`demo_local.py` runs the whole pipeline standalone (no agent; heuristic distillation since
`ctx.llm` isn't available, but real Unsiloed parse + real hybrid search):

```bash
# isolates output under ./.demo-scratch so it won't touch your real ~/wiki or MEMORY.md
python demo_local.py filing.pdf "revenue and net income"
python demo_local.py https://example.com/doc.pdf --live   # use real wiki/memory locations
```

## Files

```
unsiloed/
├── plugin.yaml          manifest (kind: backend, provides_tools)
├── __init__.py          register(ctx): 3 tools + /docs command
├── config.py            paths + env/.env resolution
├── unsiloed_client.py   Unsiloed v2 client (parse-upload + extract), defensive parsing
├── embeddings.py        pluggable embeddings (openai | pure-python hash)
├── search_index.py      SQLite FTS5 + semantic vectors, RRF fusion
├── wiki.py              Karpathy LLM-Wiki writer (frontmatter/wikilinks/provenance)
├── memory_writer.py     managed MEMORY.md entries
├── ingest.py            orchestration: parse → workspace → wiki → memory → index
└── tools.py             tool schemas, handlers, /docs slash command
```

## Notes

- The Unsiloed response shape is not a contract we control, so `unsiloed_client.py` parses
  defensively — it tries several key spellings for chunk text and page number and stitches
  from `segments[]` when a chunk carries no top-level text — rather than assuming one fixed
  schema.
- `document_search` needs no API key: it reads the local index, so recall keeps working
  offline and across sessions.
- Writes to `MEMORY.md` are atomic (temp + rename) under an advisory lock, the same shape
  the host uses. An out-of-band write may trip the host's drift detection on its next
  memory write (it snapshots + reloads); that is non-destructive.
```
