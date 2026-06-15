"""Extract the holdings table with the Unsiloed parse API.

A document parser tiles and OCRs the page at full resolution instead of
downscaling it to fit a vision model's image budget, so the small-print digits
survive. We submit the PDF to POST /parse with:

  ocr_strategy=force_ocr      OCR the page even though we hand it a PDF
  use_high_resolution=true    keep fidelity on the dense, small text
  merge_tables=true           stitch the four tiled tables into one

then poll /parse/{job_id} until "Succeeded", concatenate every Table segment's
markdown, and parse it into the scorer's row format.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rows import parse_html_rows, parse_pipe_rows  # noqa: E402

BASE_URL = "https://prod.visionapi.unsiloed.ai"
POLL_SECONDS = 4
TIMEOUT_SECONDS = 600


def run(pdf_path: str | Path, api_key: str, raw_out: str | Path | None = None) -> dict:
    """Submit the PDF, poll to completion, and return the raw parse response."""
    pdf_path = Path(pdf_path)
    print(f"[unsiloed] submitting {pdf_path.name} to {BASE_URL}/parse ...", flush=True)
    with pdf_path.open("rb") as fh:
        resp = requests.post(
            f"{BASE_URL}/parse",
            headers={"api-key": api_key},
            files={"file": (pdf_path.name, fh, "application/pdf")},
            data={
                "ocr_strategy": "force_ocr",
                "use_high_resolution": "true",
                "merge_tables": "true",
            },
            timeout=120,
        )
    resp.raise_for_status()
    job_id = resp.json()["job_id"]
    print(f"[unsiloed] job {job_id} — polling", flush=True)

    deadline = time.monotonic() + TIMEOUT_SECONDS
    while True:
        r = requests.get(f"{BASE_URL}/parse/{job_id}", headers={"api-key": api_key}, timeout=60)
        r.raise_for_status()
        result = r.json()
        status = result.get("status")
        if status == "Succeeded":
            break
        if status in ("Failed", "Error"):
            raise RuntimeError(f"Unsiloed job failed: {result}")
        if time.monotonic() > deadline:
            raise TimeoutError(f"Unsiloed job {job_id} still {status} after {TIMEOUT_SECONDS}s")
        print(f"[unsiloed]   status={status}", flush=True)
        time.sleep(POLL_SECONDS)

    print("[unsiloed] succeeded", flush=True)
    if raw_out:
        Path(raw_out).write_text(json.dumps(result, indent=2))
    return result


def response_to_rows(result: dict) -> dict:
    """Parse every Table segment into rows.

    Table segments carry both `html` and `markdown`. We prefer the HTML — its
    <tr>/<td> structure is unambiguous, whereas the markdown flavor varies
    between jobs (one-row-per-line vs one-cell-per-line). Markdown is the
    fallback if a segment has no HTML.
    """
    rows: dict = {}
    for chunk in result.get("chunks", []):
        for seg in chunk.get("segments", []):
            if (seg.get("segment_type") or "").lower() != "table":
                continue
            html = seg.get("html") or ""
            if html.strip():
                rows.update(parse_html_rows(html))
            else:
                rows.update(parse_pipe_rows(seg.get("markdown") or ""))
    return rows


def main() -> None:
    here = Path(__file__).resolve().parent.parent
    api_key = os.environ.get("UNSILOED_API_KEY")
    if not api_key:
        print("UNSILOED_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    result = run(here / "data" / "fourup.pdf", api_key, raw_out=here / "cached" / "unsiloed_response.json")
    rows = response_to_rows(result)
    out = here / "results" / "unsiloed_rows.json"
    out.write_text(json.dumps(rows, indent=2))
    print(f"[unsiloed] parsed {len(rows)} rows -> {out}")


if __name__ == "__main__":
    main()
