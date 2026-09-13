"""Decide correct vs incorrect per field, and flatten a raw response into scorable rows.

A calibration result is only as honest as its definition of "correct". Every comparison rule
is stated here, in one place, rather than scattered through analysis code, because a reader
checking a headline number needs to see the rule that produced it as easily as the number
itself.

Normalisation is deliberately generous about *form* and strict about *value*: "$1,401.42" and
"1401.42" are the same amount, but 1401.42 and 1401.40 are not. A comparison that is strict
about form too would count formatting choices Unsiloed never claimed to preserve as
extraction failures, which would make the whole harness measure the wrong thing.

Array fields (`line_items[].amount`) are matched to ground truth by position: the Nth
extracted row against the Nth truth row. That is an approximation — a genuinely dropped or
reordered row throws every later index out of alignment — accepted because it is what
surfaces a dropped row as a miss instead of silently matching by value and hiding it, which
is closer to the failure this harness exists to catch.
"""

import re
from datetime import date, datetime


def _strip_money(text) -> str | None:
    """Digits, sign and one decimal point; currency symbols and separators discarded.

    Neither "," nor "." has a fixed meaning across locales, so the previous version's bug was
    trusting "." unconditionally: CORD's Indonesian receipts print "." as a thousands separator
    with no decimal subunit ("15.000" = 15000), so "15.000" (extracted) and "15,000" (ground
    truth) parsed to 15.0 and 15000.0 - the same real value scored as a mismatch. This also
    silently corrupted "Rp. 91,000" (the "." from the "Rp." abbreviation survives the regex
    below) into 0.91 instead of 91000.

    Rule: whichever of "," or "." is rightmost is the decimal point candidate, and it only
    counts as one if exactly 1-2 digits follow it. Otherwise every "," and "." present is a
    separator (or noise) and gets discarded. This matches both "1,401.42" (US) and "1.401,42"
    (EU/ID) while treating "15.000" and "Rp. 91,000" as pure thousands groupings.
    """
    if text is None:
        return None
    cleaned = re.sub(r"[^\d.,\-]", "", str(text))
    negative = cleaned.startswith("-") or cleaned.endswith("-")
    cleaned = cleaned.strip("-")
    if not cleaned:
        return None

    has_comma, has_dot = "," in cleaned, "." in cleaned
    if has_comma and has_dot:
        decimal_char = "," if cleaned.rfind(",") > cleaned.rfind(".") else "."
    elif has_comma:
        decimal_char = ","
    elif has_dot:
        decimal_char = "."
    else:
        decimal_char = None

    if decimal_char:
        head, _, tail = cleaned.rpartition(decimal_char)
        if len(tail) in (1, 2) and head:
            cleaned = f"{re.sub(r'[.,]', '', head)}.{tail}"
        else:
            cleaned = re.sub(r"[.,]", "", cleaned)

    try:
        value = float(cleaned)
    except ValueError:
        return None
    return f"{-value if negative else value:.2f}"


def _strip_number(text) -> str | None:
    if text is None:
        return None
    cleaned = re.sub(r"[^\d.\-]", "", str(text))
    try:
        return f"{float(cleaned):g}"
    except ValueError:
        return None


_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y", "%m/%d/%Y")


def _parse_date(text) -> date | None:
    if text is None:
        return None
    text = str(text).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _fold_text(text) -> str | None:
    if text is None:
        return None
    return re.sub(r"\s+", " ", str(text).strip().lower())


def _fold_id(text) -> str | None:
    if text is None:
        return None
    return re.sub(r"[\s\-.]", "", str(text)).upper()


def values_match(field_type: str, predicted, truth) -> bool | None:
    """True or False once both sides parse; None when the comparison itself is undefined.

    None is distinct from False. A predicted value that fails to parse under its field's own
    rule is a mismatch (False); a *ground truth* value that fails to parse is a defect in the
    corpus, not a verdict on the extraction, and is excluded from scoring (None) rather than
    silently counted as wrong.
    """
    if truth is None or str(truth).strip() == "":
        return None

    if field_type == "money":
        t = _strip_money(truth)
        return None if t is None else _strip_money(predicted) == t

    if field_type == "number":
        t = _strip_number(truth)
        return None if t is None else _strip_number(predicted) == t

    if field_type == "date":
        t = _parse_date(truth)
        return None if t is None else _parse_date(predicted) == t

    if field_type == "id":
        t = _fold_id(truth)
        return None if not t else _fold_id(predicted) == t

    if field_type in ("text", "code"):
        t = _fold_text(truth)
        return None if not t else _fold_text(predicted) == t

    raise ValueError(f"Unknown field type: {field_type!r}")


def flatten_result(node, path: str = "") -> dict[str, dict]:
    """Walk an extraction result into {indexed_path: {value, grounding, extraction}} leaves.

    An array leaf (`value` is a list of objects) expands into `path[0].field`, `path[1].field`,
    ... so sibling rows never collide under one dict key.
    """
    leaves: dict[str, dict] = {}
    if isinstance(node, dict):
        if "score" in node and "value" in node:
            value = node["value"]
            if isinstance(value, list):
                for index, item in enumerate(value):
                    leaves.update(flatten_result(item, f"{path}[{index}]"))
            elif isinstance(value, dict) and "score" not in value:
                for key, child in value.items():
                    leaves.update(flatten_result(child, f"{path}.{key}" if path else key))
            else:
                leaves[path] = {
                    "value": value,
                    "grounding_score": node["score"].get("grounding_score"),
                    "extraction_score": node["score"].get("extraction_score"),
                }
            return leaves
        for key, child in node.items():
            leaves.update(flatten_result(child, f"{path}.{key}" if path else key))
    elif isinstance(node, list):
        for index, item in enumerate(node):
            leaves.update(flatten_result(item, f"{path}[{index}]"))
    return leaves


def flatten_truth(node, path: str = "") -> dict[str, object]:
    """Walk a ground-truth `fields` object into the same indexed-path shape as `flatten_result`."""
    leaves: dict[str, object] = {}
    if isinstance(node, dict):
        for key, child in node.items():
            leaves.update(flatten_truth(child, f"{path}.{key}" if path else key))
    elif isinstance(node, list):
        for index, item in enumerate(node):
            leaves.update(flatten_truth(item, f"{path}[{index}]"))
    else:
        leaves[path] = node
    return leaves


_INDEX_RE = re.compile(r"\[\d+\]")


def score_rows(
    result: dict, truth_fields: dict, field_types: dict[str, str], context: dict
) -> list[dict]:
    """Pair every truth-bearing leaf with its extraction, typed and scored.

    `context` (document, tier, doc_type, ...) is copied onto every row so results across the
    whole corpus can be concatenated and grouped without a join back to a document table.
    """
    predicted = flatten_result(result)
    truth = flatten_truth(truth_fields)

    rows = []
    for indexed_path, truth_value in truth.items():
        field_type = field_types.get(_INDEX_RE.sub("[]", indexed_path))
        if field_type is None:
            continue

        pred_leaf = predicted.get(indexed_path)
        predicted_value = pred_leaf["value"] if pred_leaf else None
        rows.append(
            {
                **context,
                "field": _INDEX_RE.sub("[]", indexed_path),
                "field_type": field_type,
                "predicted_value": predicted_value,
                "truth_value": truth_value,
                "grounding_score": pred_leaf["grounding_score"] if pred_leaf else None,
                "extraction_score": pred_leaf["extraction_score"] if pred_leaf else None,
                "correct": values_match(field_type, predicted_value, truth_value),
            }
        )
    return rows
