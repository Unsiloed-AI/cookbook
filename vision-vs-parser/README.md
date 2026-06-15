# Vision LLM vs. document parser: a 251-row accuracy benchmark

A runnable, scored comparison on a deliberately hard page: a dense financial
holdings table given to a general-purpose vision LLM and to Unsiloed.

```
==========================================================================
  Dense holdings sheet — 251 bond rows x 5 cells = 1255 ground-truth cells
==========================================================================
                            rows found    cells (found rows)     cells (all)
  --------------------------------------------------------------------------
  Unsiloed /parse           251/251        1255/1255   100.0%          100.0%
  Claude Sonnet (vision)    210/251         703/1050   67.0%           56.0%
==========================================================================
```

The vision LLM returns a clean, complete-looking table that is quietly 44% wrong on the full sheet, with no signal which cells are off.

## Why a vision LLM struggles here

Frontier LLMs are excellent generalists, but pulling exact numbers off a complex
document is a specialist's job. The test page is one dense image-only sheet (four
fund pages tiled 2×2, 251 bond rows of small-print figures). Handed the whole
thing and asked to transcribe it, the LLM doesn't error out. It returns a
confident, complete-looking table with numbers that are quietly wrong (`40,576`
becomes `40,076`, `EUR` becomes `USD`).

Unsiloed treats the page as a document instead: it detects the table regions,
reads each one, reconstructs the rows and columns, and returns confidence-scored
structured output.

## Prerequisites

- An **Unsiloed API key** ([sign up](https://www.unsiloed.ai)) and an
  **Anthropic API key**, both needed only for `--live`. The default cached run
  needs no keys.
- Python 3.13+ and `pip install -r requirements.txt` (just `requests`).

Add the keys to the cookbook's root `.env` (the runner searches parent folders
for it):

```
UNSILOED_API_KEY=your-unsiloed-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

## Run it

From this folder:

```bash
pip install -r requirements.txt
python run.py
```

`python run.py` scores the API responses committed under `cached/`, so the
headline numbers reproduce offline with no keys. To call both APIs fresh:

```bash
python run.py --live              # re-run both extractors
python run.py --live --only sonnet   # run a single side
```

Unsiloed is deterministic and reproduces 100% every run. The vision LLM is
sampled, so a live run varies by a few rows and cells, but the pattern
(dropped or garbled rows plus silent digit errors) is stable.

## How it's scored, and why it's fair

- **Ground truth** (`data/ground_truth.json`) comes from the source PDF's own
  text layer (the born-digital original these pages were rendered from), not from
  either tool's output.
- **The LLM gets a fair shot.** It receives the PDF via the Anthropic Messages
  API (`claude-sonnet-4-6`), `max_tokens` set high enough that nothing is cut
  off, and a prompt that explicitly asks for every row and exact digits (see
  `src/sonnet_runner.py`).

## Layout

```
run.py                     orchestrator: run both, score, print the table
src/unsiloed_runner.py     POST /parse, poll, parse table HTML -> rows
src/sonnet_runner.py       Anthropic Messages API, PDF in, transcription out
src/rows.py                HTML/markdown table -> {description: [5 cells]}
src/score.py               fuzzy row matching + exact cell scoring
data/                      fourup.pdf, fourup.png, ground_truth.json
cached/                    committed API responses so `python run.py` needs no keys
```

Try it on your own hardest document: drop a PDF in `data/`, point the runners at
it, and see where your stack starts failing silently.
