# Due-Diligence Agent

Upload any company/transaction PDF → get a rigorous, risk-flagged diligence memo, then
chat with the document. Built on three pieces:

- **Unsiloed** — reads the PDF into clean Markdown (dense tables, multi-column legal text, scans).
- **Claude Opus 4.8 via LangChain** (`create_agent`) — acts as a skeptical diligence analyst.
- **E2B** — a secure Python sandbox the agent uses to *compute and verify* every figure
  (growth, CAGR, margins, leverage/coverage ratios, burn/runway, dilution) instead of doing
  arithmetic in its head.

Source numbers come from Unsiloed (no hallucinated figures); every derived number is checked
in real code; the risk synthesis, red flags and follow-ups are the model's judgment.

## How it works

```
PDF ──► Unsiloed Parse ──► Markdown text
                               │
                               ▼
        LangChain agent (Opus 4.8)  ◄──►  run_python tool  ──►  E2B sandbox
                               │            (verifies the numbers in real Python)
                               ▼
        with_structured_output ──► JSON memo ──► HTML report / chat
```

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env          # then fill in your three keys
```

`.env` keys:

| key | where to get it |
| --- | --- |
| `UNSILOED_API_KEY` | Unsiloed dashboard |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `E2B_API_KEY` | e2b.dev → Dashboard |

## Run

**Web app** — upload any PDF, read the memo, chat about it:

```bash
python app.py            # http://127.0.0.1:5058
```

**CLI** — run a memo straight from the terminal:

```bash
python cli.py                  # bundled SpaceX sample, first 3 pages
python cli.py 1                # sample, first 1 page (fastest)
python cli.py path/to/doc.pdf  # any PDF, all pages
python cli.py path/to/doc.pdf 5  # any PDF, first 5 pages
```

A bare number slices to the first N pages (faster Unsiloed parse). The full memo is
written to `reports/memo.json`.

## Files

| file | what it is |
| --- | --- |
| `cli.py` | The engine + command-line runner: parse → agent reasoning + E2B calculations → structured memo → HTML. |
| `app.py` | Flask web server. Thin wrapper: `/analyze` and `/chat` call into `cli`. |
| `unsiloed.py` | Unsiloed API client (`parse`, `extract`) and `.env` loader. |
| `templates/`, `static/` | Web UI (upload page + styles). |
| `data_room/spacex_sample.pdf` | Bundled test document. |
| `requirements.txt` | `langchain`, `langchain-anthropic`, `langgraph`, `e2b-code-interpreter`, `pypdf`, `requests`. |

## Notes

- Unsiloed parses most reliably at ≤ 40 pages/call; larger docs are auto-sliced (capped at 120 pages).
- The agent step and the structured-output step are split on purpose — it keeps the JSON memo reliable.
- Transient `529 Overloaded` (Anthropic) or Unsiloed timeouts are external hiccups; just re-run.
