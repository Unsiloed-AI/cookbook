#!/usr/bin/env python3
"""Head-to-head: Claude Sonnet vision vs the Unsiloed parser on one hard page.

  python run.py            # use the cached API responses bundled in the repo (no keys needed)
  python run.py --live     # call both APIs fresh (needs ANTHROPIC_API_KEY + UNSILOED_API_KEY)
  python run.py --live --only unsiloed   # run just one side live

Both extractors are scored against data/ground_truth.json (251 bond rows, taken
from the source PDF's own text layer). The scorer matches rows by fuzzy
description similarity and compares the five cell values exactly.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

import score as scorer  # noqa: E402
import sonnet_runner  # noqa: E402
import unsiloed_runner  # noqa: E402
from rows import parse_pipe_rows  # noqa: E402

PDF = ROOT / "data" / "fourup.pdf"
GROUND_TRUTH = ROOT / "data" / "ground_truth.json"
CACHE = ROOT / "cached"
RESULTS = ROOT / "results"


def _load_env() -> None:
    """Minimal .env loader so the repo has no hard dependency on python-dotenv.

    Searches this folder and its parents for the first .env, so the demo works
    both standalone and as a recipe inside the Unsiloed cookbook (which keeps a
    single .env at the repo root).
    """
    env = None
    for parent in [ROOT, *ROOT.parents]:
        candidate = parent / ".env"
        if candidate.exists():
            env = candidate
            break
    if env is None:
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def get_unsiloed_rows(live: bool) -> dict:
    if live:
        key = os.environ.get("UNSILOED_API_KEY")
        if not key:
            sys.exit("UNSILOED_API_KEY not set (needed for --live). See .env.example.")
        result = unsiloed_runner.run(PDF, key, raw_out=CACHE / "unsiloed_response.json")
        rows = unsiloed_runner.response_to_rows(result)
    else:
        raw = json.loads((CACHE / "unsiloed_response.json").read_text())
        rows = unsiloed_runner.response_to_rows(raw)
    (RESULTS / "unsiloed_rows.json").write_text(json.dumps(rows, indent=2))
    return rows


def get_sonnet_rows(live: bool) -> dict:
    if live:
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            sys.exit("ANTHROPIC_API_KEY not set (needed for --live). See .env.example.")
        text = sonnet_runner.run(PDF, key, raw_out=CACHE / "sonnet_response.md")
    else:
        text = (CACHE / "sonnet_response.md").read_text()
    rows = parse_pipe_rows(text)
    (RESULTS / "sonnet_rows.json").write_text(json.dumps(rows, indent=2))
    return rows


def _pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def print_report(truth: dict, results: dict) -> None:
    rows = []
    for name, rowdict in results.items():
        m = scorer.score(truth, rowdict)
        rows.append((name, m))

    n = len(truth)
    w = 22
    print("\n" + "=" * 74)
    print(f"  Dense holdings sheet — {n} bond rows x 5 cells = {n * 5} ground-truth cells")
    print("=" * 74)
    header = f"  {'':<{w}}{'rows found':>14}{'cells (found rows)':>22}{'cells (all)':>16}"
    print(header)
    print("  " + "-" * (w + 52))
    for name, m in rows:
        print(
            f"  {name:<{w}}"
            f"{m['rows_matched']:>7}/{m['rows_total']:<6}"
            f"{m['cells_correct']:>9}/{m['cells_attempted']:<6} {_pct(m['cell_accuracy_attempted']):>5}"
            f"{_pct(m['cell_accuracy_overall']):>16}"
        )
    print("=" * 74)

    for name, m in rows:
        if m["sample_errors"]:
            print(f"\n  sample misreads — {name}:")
            for e in m["sample_errors"][:8]:
                print("    " + e)
    print()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--live", action="store_true", help="call the APIs instead of using cached responses")
    ap.add_argument("--only", choices=["unsiloed", "sonnet"], help="run a single extractor")
    args = ap.parse_args()

    _load_env()
    RESULTS.mkdir(exist_ok=True)
    truth = json.loads(GROUND_TRUTH.read_text())

    mode = "LIVE (calling APIs)" if args.live else "CACHED (bundled responses)"
    print(f"mode: {mode}")

    results: dict = {}
    if args.only in (None, "unsiloed"):
        results["Unsiloed /parse"] = get_unsiloed_rows(args.live)
    if args.only in (None, "sonnet"):
        results["Claude Sonnet (vision)"] = get_sonnet_rows(args.live)

    print_report(truth, results)


if __name__ == "__main__":
    main()
