# Contract Risk Panel — Hermes MoA × Unsiloed × Daytona

A contract-review agent that reads a real, dense legal contract and returns a
clause-by-clause risk memo — where **every finding is grounded in the document's actual
wording, not a model's memory.**

Three tools, each doing the one thing it's best at:

- **[Unsiloed](https://unsiloed.ai)** is the *eyes* — parses the contract (multi-column
  legal prose, defined terms, cross-referenced clauses) into clean text via its REST API
  (`api-key`, no OAuth). Its tools fetch a document by **public URL**, so…
- **[Daytona](https://daytona.io)** is the *secure host* — a throwaway **public** sandbox
  serves the PDF at a URL Unsiloed can fetch, then is torn down. (SEC.gov blocks
  server-side fetches and many file hosts sit outside Unsiloed's egress; the sandbox
  solves that cleanly and works for private/local docs too.)
- **[Hermes](https://hermes-agent.nousresearch.com) Mixture-of-Agents** is the *judgment* —
  two reference models (GPT-5.5 + DeepSeek-v4-Pro) analyse the text independently and a
  Claude Opus 4.8 aggregator writes the consolidated memo. Different model families, so a
  blind spot in one is caught by another.

```
Daytona sandbox ──serves PDF at public URL──► Unsiloed /parse ──clean text──►
   Hermes MoA panel (GPT-5.5 + DeepSeek ─► Opus 4.8 aggregator) ──► styled HTML memo
```

The output (`memo.html`) quotes each flagged clause verbatim, says who it favours, rates
severity High/Med/Low, gives a redline, and ends with the 3 deal-breakers. See
[`sample-memo.md`](./sample-memo.md) for a real run.

**The payoff moment:** asked to review "for the Customer (EdgeMode)", the panel read the
Particulars, found EdgeMode is actually the *Service Provider* (CUDO is the Customer),
flagged the contradiction, and reviewed from the correct seat — instead of inventing a
contract to fit the brief. That refusal-to-fabricate is the point of grounding judgment in
real extracted facts.

## The document

A real, public **Master Services Agreement** — EdgeMode Inc ↔ CUDO Ventures, dated
27 Dec 2024, filed with the SEC as Exhibit 10.1. Genuinely one-sided legal prose
(one-party indemnity, broad warranty waivers, deposit forfeiture, forced novation).
Bundled as [`edgemode-msa.pdf`](./edgemode-msa.pdf); pass any contract PDF to use your own.

## Setup

**Prerequisite:** [Hermes Agent](https://hermes-agent.nousresearch.com) must be installed
(it provides the Mixture-of-Agents SDK). The demo loads it from `~/.hermes/hermes-agent`
by default — override with `HERMES_HOME`. The MoA `default` preset must exist
(`hermes moa list`) with its reference + aggregator providers authenticated.

```bash
# the Hermes venv already has the MoA SDK + its deps; add this demo's deps to it
source ~/.hermes/hermes-agent/venv/bin/activate     # the Hermes Agent venv
pip install -r requirements.txt

cp .env.example .env        # then fill in UNSILOED_API_KEY and DAYTONA_API_KEY
```

## Run

```bash
python review.py                 # bundled SEC MSA
python review.py /path/to.pdf    # any contract PDF
```

Daytona spins up a public sandbox and serves the PDF, Unsiloed parses it (a few seconds),
then the panel runs — reference models read the contract, then the Opus aggregator writes.
`memo.html` is written and opened in your browser; the sandbox is torn down.

Alternative document sources (set in `.env` or the shell), no Daytona needed:

```bash
DOC_URL="https://…/contract.pdf" python review.py     # any public URL
UNSILOED_USE_UPLOAD=1 python review.py                # upload the file's bytes
```

## Layout

| file | responsibility |
| --- | --- |
| `review.py` | entry point — wires the pipeline together |
| `config.py` | loads `.env` / settings |
| `unsiloed.py` | Unsiloed REST client (parse by URL or upload) |
| `daytona_host.py` | hosts the PDF in a public Daytona sandbox |
| `hermes_panel.py` | runs the Hermes MoA panel over the text |
| `memo.py` | normalises the panel output → styled HTML memo |
| `banner.py` | Hermes caduceus intro banner |
| `edgemode-msa.pdf` | the sample contract (public SEC EX-10.1) |
| `sample-memo.md` | a real memo this produced, for reference |

## Notes

- The panel reasons over the **already-extracted text** (in the prompt), so the MoA agent
  needs no tools — `enabled_toolsets=[]`. Unsiloed does the reading; MoA does the judgment.
- `provider="moa", model="default"` is the SDK equivalent of `/moa` in `hermes chat`.
- The Daytona sandbox **must** be public — a private one token-gates the preview and
  Unsiloed's anonymous fetch would 400. `daytona_host.serve_public` sets `public=True`.
- Runtime is dominated by the reference models reading the contract (~28K tokens) before
  the aggregator writes; expect a few minutes per run.