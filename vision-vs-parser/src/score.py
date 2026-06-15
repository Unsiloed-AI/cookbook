"""Score an extraction against ground truth.

Both extractors (Unsiloed and Sonnet) emit the same row format: a JSON object
mapping a holding's Description to a 5-cell list:

    {"Berkshire Hathaway Finance Corp. 3.85% Mar 15/52": ["USD","33000","40576","36465","0.1"], ...}

The five cells are: Currency, Par Value, Cost, Fair Value, % of Net Assets.

Scoring is deliberately forgiving on row *matching* (so an OCR slip in a bond
name doesn't drop the row) and strict on cell *values* (a misread digit counts
as wrong). We match each ground-truth row to the single best candidate row in
the extractor's output by fuzzy description similarity, then compare the five
cells of matched rows.
"""
from __future__ import annotations

import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

# A candidate row must be at least this similar (0-1) to a ground-truth row's
# description to count as the same holding.
MATCH_THRESHOLD = 0.82
CELL_LABELS = ["Currency", "Par Value", "Cost", "Fair Value", "% Net Assets"]


def norm_desc(s: str) -> str:
    """Normalize a description for fuzzy matching: lowercase alphanumerics only."""
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def norm_cell(idx: int, value: str) -> str:
    """Normalize a single cell value for an exact-equality comparison.

    Currency (idx 0) is compared case-insensitively. The four numeric columns
    have thousands separators, spaces and any stray currency symbols stripped so
    that "1,234" == "1234" but "1,235" stays wrong.
    """
    v = (value or "").strip()
    if idx == 0:
        return v.upper()
    return re.sub(r"[,\s$£€]", "", v)


def _best_matches(truth: dict, pred: dict) -> dict:
    """Greedily match ground-truth descriptions to predicted descriptions.

    Returns {gt_description: pred_description or None}. Each predicted row is
    used at most once. We score every (gt, pred) pair, then assign highest
    similarity first — a stable approximation of optimal bipartite matching.
    """
    pred_norm = {d: norm_desc(d) for d in pred}
    pairs = []
    for gt in truth:
        gtn = norm_desc(gt)
        for pd, pdn in pred_norm.items():
            r = SequenceMatcher(None, gtn, pdn).ratio()
            if r >= MATCH_THRESHOLD:
                pairs.append((r, gt, pd))
    pairs.sort(key=lambda x: x[0], reverse=True)

    matched: dict = {gt: None for gt in truth}
    used_pred: set = set()
    for r, gt, pd in pairs:
        if matched[gt] is None and pd not in used_pred:
            matched[gt] = pd
            used_pred.add(pd)
    return matched


def score(truth: dict, pred: dict) -> dict:
    """Compare a prediction dict against ground truth and return metrics."""
    matched = _best_matches(truth, pred)
    n_rows = len(truth)
    n_matched = sum(1 for v in matched.values() if v is not None)

    cells_total = n_rows * len(CELL_LABELS)
    cells_correct = 0
    cells_attempted = 0  # cells on matched rows only
    errors = []  # sample of wrong cells for the report

    for gt, pd in matched.items():
        gt_cells = truth[gt]
        if pd is None:
            continue
        pred_cells = pred[pd]
        for i in range(len(CELL_LABELS)):
            cells_attempted += 1
            want = norm_cell(i, gt_cells[i] if i < len(gt_cells) else "")
            got = norm_cell(i, pred_cells[i] if i < len(pred_cells) else "")
            if want == got:
                cells_correct += 1
            elif len(errors) < 12:
                errors.append(
                    f'{gt[:42]:<42} {CELL_LABELS[i]:<12} want={gt_cells[i]!r} got={pred_cells[i] if i < len(pred_cells) else None!r}'
                )

    return {
        "rows_total": n_rows,
        "rows_matched": n_matched,
        "row_recall": n_matched / n_rows if n_rows else 0.0,
        "cells_total": cells_total,
        "cells_attempted": cells_attempted,
        "cells_correct": cells_correct,
        # accuracy over the cells the model actually attempted (matched rows)
        "cell_accuracy_attempted": cells_correct / cells_attempted if cells_attempted else 0.0,
        # accuracy over *every* ground-truth cell (missing rows count as wrong)
        "cell_accuracy_overall": cells_correct / cells_total if cells_total else 0.0,
        "sample_errors": errors,
    }


def load(path: str | Path) -> dict:
    return json.loads(Path(path).read_text())


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: python src/score.py <prediction_rows.json> <ground_truth.json>", file=sys.stderr)
        sys.exit(2)
    pred = load(sys.argv[1])
    truth = load(sys.argv[2])
    m = score(truth, pred)
    print(json.dumps({k: v for k, v in m.items() if k != "sample_errors"}, indent=2))
    if m["sample_errors"]:
        print("\nsample cell errors (want vs got):")
        for e in m["sample_errors"]:
            print("  " + e)
