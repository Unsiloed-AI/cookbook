# UNSILOED CLI

```
 ██╗   ██╗ ███╗   ██╗ ███████╗ ██╗ ██╗       ██████╗  ███████╗ ██████╗
 ██║   ██║ ████╗  ██║ ██╔════╝ ██║ ██║      ██╔═══██╗ ██╔════╝ ██╔══██╗
 ██║   ██║ ██╔██╗ ██║ ███████╗ ██║ ██║      ██║   ██║ █████╗   ██║  ██║
 ██║   ██║ ██║╚██╗██║ ╚════██║ ██║ ██║      ██║   ██║ ██╔══╝   ██║  ██║
 ╚██████╔╝ ██║ ╚████║ ███████║ ██║ ███████╗ ╚██████╔╝ ███████╗ ██████╔╝
  ╚═════╝  ╚═╝  ╚═══╝ ╚══════╝ ╚═╝ ╚══════╝  ╚═════╝  ╚══════╝ ╚═════╝
```

**Agentic OCR & document processing in your terminal.** An OG-Claude-Code-style
REPL over the [Unsiloed AI](https://docs.unsiloed.ai/) API. Banner font by
[oh-my-logo](https://github.com/shinshin86/oh-my-logo).

Talk to it in plain English — it picks the right document operation, runs it, and
explains the result.

## What it does

| Tool | Unsiloed endpoint | Use it for |
|------|-------------------|------------|
| `unsiloed_parse_document` | `POST /parse` | PDF/image/Office → Markdown chunks (RAG, tables) |
| `unsiloed_extract_data` | `POST /v2/extract` | typed fields from a JSON schema (invoices, contracts, KYC) |
| `unsiloed_classify_document` | `POST /classify` | route a document to a category |
| `unsiloed_split_document` | `POST /splitter` | split a merged batch into separate PDFs |

Every Unsiloed operation is an async job; the tools submit **and** poll to
completion, then write full output to `unsiloed_output/` and hand the agent a
compact summary.

The agent also has local filesystem tools (`list_directory`, `file_search`,
`read_file`, `write_file`, `copy_file`, `move_file`, `file_delete`), so it can
find the document you mean from a loose description ("the invoice on my desktop")
and resolve path shorthand like `Desktop/q1.pdf` on its own. Set
`UNSILOED_FILE_ROOT` to sandbox file access to one directory.

## Setup

```bash
uv venv && uv pip install -e .
cp .env.example .env   # then fill in your keys
```

You need two keys:

- `OPENAI_API_KEY` — drives the agent's reasoning.
- `UNSILOED_API_KEY` — does the document processing ([get one](https://www.unsiloed.ai)).

## Usage

```bash
unsiloed                       # interactive REPL
unsiloed "parse report.pdf"    # one-shot
```

Inside the REPL:

```
› parse the tables out of q1.pdf
› extract invoice_number and total from invoice.pdf
› what kind of document is ~/Desktop/scan.pdf?
› split the merged batch on my desktop into separate files
› /classify contract.pdf
› /usage
› /help
```

## How it works

```
You ──► ReAct agent ──► picks a tool ──► UnsiloedClient ──► Unsiloed API
            │                              submit + poll
            └─────────── plain-English answer ◄───────────────┘
```

The LLM only decides *which* tool and *what arguments*. All HTTP + polling lives
in `client.py`; the tools in `tools.py` wrap each operation as a structured tool.

The answer **streams token-by-token**: a spinner runs while the tool job submits
and polls, then the response types out live as the model generates it.

## Layout

```
unsiloed_cli/
  client.py   # Unsiloed API client (submit → poll → result)
  tools.py    # tools wrapping each operation
  agent.py    # ReAct agent (model + tools + system prompt)
  ui.py       # oh-my-logo banner + Claude-Code terminal chrome (rich)
  cli.py      # REPL, slash commands, one-shot entry
```
