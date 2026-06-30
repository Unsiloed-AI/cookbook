#!/usr/bin/env python3
"""
Contract-risk panel — Hermes MoA × Unsiloed × Daytona.

Pipeline:
  1. Daytona public sandbox serves the contract PDF at a public URL.
  2. Unsiloed `/parse` reads that URL (api-key) → clean contract text.
  3. The Hermes Mixture-of-Agents panel reviews the text.
  4. The memo is rendered to a styled `memo.html` and opened.

Run:
  python review.py [contract.pdf]        # defaults to the bundled SEC MSA

Config (see .env.example): UNSILOED_API_KEY, DAYTONA_API_KEY. Alternatives to the
Daytona host: DOC_URL=<public url>, or UNSILOED_USE_UPLOAD=1 (upload the bytes).
"""

import sys
import webbrowser
from pathlib import Path

import config
import banner
from unsiloed import Unsiloed
from daytona_host import serve_public
from hermes_panel import review_contract
from memo import render_html

HERE = Path(__file__).resolve().parent
_DIM, _CYAN, _RESET = "\033[2m", "\033[36m", "\033[0m"


def _log(msg: str) -> None:
    print(f"{_DIM}   {msg}{_RESET}", file=sys.stderr, flush=True)


def _ok(msg: str) -> None:
    print(f"{_CYAN}   ✓ {msg}{_RESET}", file=sys.stderr, flush=True)


def read_contract(pdf: Path) -> str:
    """Get the contract text from Unsiloed, choosing the source per config."""
    unsiloed = Unsiloed(config.require("UNSILOED_API_KEY"))
    if config.USE_UPLOAD:
        _log(f"reading {pdf.name} via Unsiloed upload (no host)…")
        return unsiloed.parse_upload(pdf)
    if config.DOC_URL:
        _log(f"reading {config.DOC_URL} via Unsiloed /parse…")
        return unsiloed.parse_url(config.DOC_URL)
    with serve_public(pdf, config.require("DAYTONA_API_KEY"), log=_log) as url:
        return unsiloed.parse_url(url)


def main() -> None:
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "edgemode-msa.pdf"
    if not pdf.exists():
        raise SystemExit(f"contract not found: {pdf}")

    banner.show(config.HERMES_HOME)

    text = read_contract(pdf)
    _ok(f"Unsiloed extracted {len(text):,} chars of contract text")

    memo = review_contract(text, config.HERMES_HOME, log=_log)

    out = HERE / "memo.html"
    render_html(memo, out, title=f"Contract Risk Memo — {pdf.stem}")
    _ok(f"memo written to {out}")
    webbrowser.open(out.as_uri())


if __name__ == "__main__":
    main()