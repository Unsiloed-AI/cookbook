"""Extract the holdings table with Claude Sonnet's vision.

This is the "just hand the document to a capable multimodal LLM" baseline. We
send the PDF to the Anthropic Messages API as a document block. Claude renders
each PDF page to an image internally and, like every vision model, downscales
it to fit an image budget (~1.15 megapixels). Our page is 5100x6600 ≈ 34 MP, so
roughly 97% of the pixels — and the tiny digits with them — are gone before the
model ever "looks". The prompt below asks for a complete, exact transcription;
the failure is not the prompt, it is the resolution the model receives.
"""
from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rows import parse_pipe_rows  # noqa: E402

URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 32000  # generous, so any missing rows are the model's choice, not a cap

PROMPT = """\
This PDF is one large sheet containing four "Schedule of Investment Portfolio" \
pages from a bond fund, arranged in a 2x2 grid (top-left, top-right, \
bottom-left, bottom-right). Each quadrant is a dense bond-holdings table with \
these columns: Description, Currency, Par Value, Cost ($), Fair Value ($), \
% of Net Assets.

Transcribe EVERY row of ALL FOUR quadrants as a single markdown table. Go \
quadrant by quadrant (top-left, then top-right, then bottom-left, then \
bottom-right). Do not skip, summarize, or truncate rows. Copy every number \
exactly as printed, including commas. If you cannot read a value, write your \
best guess rather than leaving it blank. Accuracy on every digit matters most.

Output ONLY the markdown table, starting with this exact header row and \
nothing before it:

| Description | Currency | Par Value | Cost ($) | Fair Value ($) | % of Net Assets |
| --- | --- | --- | --- | --- | --- |
"""


def run(pdf_path: str | Path, api_key: str, raw_out: str | Path | None = None) -> str:
    """Send the PDF to Claude and return the raw transcription text."""
    pdf_path = Path(pdf_path)
    data_b64 = base64.standard_b64encode(pdf_path.read_bytes()).decode()
    print(f"[sonnet] sending {pdf_path.name} to {MODEL} ...", flush=True)
    resp = requests.post(
        URL,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": MODEL,
            "max_tokens": MAX_TOKENS,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {"type": "base64", "media_type": "application/pdf", "data": data_b64},
                        },
                        {"type": "text", "text": PROMPT},
                    ],
                }
            ],
        },
        timeout=600,
    )
    resp.raise_for_status()
    body = resp.json()
    text = "".join(block.get("text", "") for block in body.get("content", []) if block.get("type") == "text")
    usage = body.get("usage", {})
    print(
        f"[sonnet] done — stop_reason={body.get('stop_reason')} "
        f"in={usage.get('input_tokens')} out={usage.get('output_tokens')}",
        flush=True,
    )
    if raw_out:
        Path(raw_out).write_text(text)
    return text


def text_to_rows(text: str) -> dict:
    return parse_pipe_rows(text)


def main() -> None:
    here = Path(__file__).resolve().parent.parent
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    text = run(here / "data" / "fourup.pdf", api_key, raw_out=here / "cached" / "sonnet_response.md")
    rows = text_to_rows(text)
    out = here / "results" / "sonnet_rows.json"
    out.write_text(json.dumps(rows, indent=2))
    print(f"[sonnet] parsed {len(rows)} rows -> {out}")


if __name__ == "__main__":
    main()
