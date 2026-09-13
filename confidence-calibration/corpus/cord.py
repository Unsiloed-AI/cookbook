"""Fetch the real half of the corpus: CORD receipts, with the ground truth their authors published.

CORD is a benchmark of photographed Indonesian receipts released by NAVER CLOVA AI Research
under CC-BY-4.0. They are crumpled, thermal-printed, shot in bad light, and frequently have a
hand shadow across the total. That is the point: a reliability curve needs documents that
actually defeat an extractor sometimes, and clean digital PDFs do not.

Ground truth comes from the benchmark, not from us, which is what makes the result something
other than our own opinion about our own documents.

Images are cached under `documents/cord/` and never committed. The dataset is redistributable
under CC-BY, but a cookbook should stay small, and a download this cheap is not worth 100 blobs
in git history. Extraction results *are* committed, so figures reproduce with no download and
no API spend.

Values in CORD are recorded exactly as printed, and Indonesian receipts write sixty thousand as
"60.000". Rather than guess a locale we ask for values as printed and compare on digits alone,
which sidesteps the separator question entirely. See `compare.py`.

Run: python -m corpus.cord           (from confidence-calibration/)
"""

import json
import urllib.request
from pathlib import Path

DATASET = "naver-clova-ix/cord-v2"
SPLIT = "test"
ROWS_URL = "https://datasets-server.huggingface.co/rows"
UA = {"User-Agent": "unsiloed-cookbook-confidence-calibration"}

OUT_DIR = Path(__file__).resolve().parent.parent / "documents" / "cord"

# The test split holds 100 receipts. Every one is extracted once, so this count is also the
# API budget for the real half of the study.
RECEIPT_COUNT = 100
PAGE_SIZE = 100  # the rows endpoint caps a single request at 100

RECEIPT_SCHEMA = {
    "type": "object",
    "properties": {
        "subtotal_price": {
            "type": "string",
            "description": "Subtotal before tax and service charge, exactly as printed on the receipt.",
        },
        "tax_price": {
            "type": "string",
            "description": "Tax charged, exactly as printed on the receipt.",
        },
        "service_price": {
            "type": "string",
            "description": "Service charge, exactly as printed on the receipt.",
        },
        "total_price": {
            "type": "string",
            "description": "Final total payable, exactly as printed on the receipt.",
        },
        "cash_price": {
            "type": "string",
            "description": "Cash tendered by the customer, exactly as printed on the receipt.",
        },
        "change_price": {
            "type": "string",
            "description": "Change returned to the customer, exactly as printed on the receipt.",
        },
        "credit_card_price": {
            "type": "string",
            "description": "Amount paid by card, exactly as printed on the receipt.",
        },
        "line_items": {
            "type": "array",
            "description": (
                "Every priced line in the purchased-items block, top to bottom, including "
                "add-ons and modifiers printed on their own line beneath an item."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Item name, exactly as printed, including any abbreviation.",
                    },
                    "quantity": {
                        "type": "string",
                        "description": "Quantity purchased, exactly as printed.",
                    },
                    "unit_price": {
                        "type": "string",
                        "description": "Price for a single unit, where the receipt prints one separately.",
                    },
                    "price": {
                        "type": "string",
                        "description": "Total price for this line, exactly as printed, separators included.",
                    },
                },
                "required": ["name", "price"],
            },
        },
    },
    "required": ["total_price"],
}

FIELD_TYPES = {
    "subtotal_price": "money",
    "tax_price": "money",
    "service_price": "money",
    "total_price": "money",
    "cash_price": "money",
    "change_price": "money",
    "credit_card_price": "money",
    "line_items[].name": "text",
    "line_items[].quantity": "number",
    "line_items[].unit_price": "money",
    "line_items[].price": "money",
}

# CORD's own key names, mapped onto the schema above. Keys it also carries but that are
# left out deliberately: `etc`, `num`, `itemsubtotal`, `discountprice`, `menuqty_cnt` and
# `menutype_cnt`. They are either free-text catch-alls or derived counts, and a field that
# cannot be scored unambiguously should not be asked for at all.
SCALAR_SOURCES = {
    "subtotal_price": ("sub_total", "subtotal_price"),
    "tax_price": ("sub_total", "tax_price"),
    "service_price": ("sub_total", "service_price"),
    "total_price": ("total", "total_price"),
    "cash_price": ("total", "cashprice"),
    "change_price": ("total", "changeprice"),
    "credit_card_price": ("total", "creditcardprice"),
}


def _get_json(url: str) -> dict:
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120))


def _as_list(node) -> list:
    """CORD stores a single menu entry as an object and several as an array."""
    if node is None:
        return []
    return node if isinstance(node, list) else [node]


def normalise_truth(gt_parse: dict) -> dict:
    """Reshape one CORD annotation into the flat shape `RECEIPT_SCHEMA` asks for.

    Only fields CORD actually annotated are emitted. A receipt with no tax line contributes
    no tax observation rather than a null one, because a field the benchmark never labelled
    cannot be scored either right or wrong.
    """
    fields: dict[str, object] = {}

    for name, (group, key) in SCALAR_SOURCES.items():
        value = (gt_parse.get(group) or {}).get(key)
        if isinstance(value, str) and value.strip():
            fields[name] = value.strip()

    items = []
    for entry in _as_list(gt_parse.get("menu")):
        if not isinstance(entry, dict):
            continue
        items.extend(_menu_entry_to_items(entry))
    if items:
        fields["line_items"] = items

    return fields


def _menu_entry_to_items(entry: dict) -> list[dict]:
    """Flatten one CORD menu entry, and any modifiers hanging off it, into printed lines.

    CORD nests add-ons under a parent as `sub`: a syrup added to a coffee is a child of the
    coffee rather than an entry of its own. On the paper receipt though it occupies its own
    line with its own price, so an extractor reading top to bottom reports it as a line and
    would be marked wrong against the nested form. Flattening keeps the answer key aligned
    with what is actually printed, which is the only thing being measured.
    """
    lines = []
    parent = {}
    for target, source in (
        ("name", "nm"),
        ("quantity", "cnt"),
        ("unit_price", "unitprice"),
        ("price", "price"),
    ):
        value = entry.get(source)
        # A repeated item can carry a list of values for one key. Those rows cannot be
        # aligned without guessing, so the field is dropped rather than invented.
        if isinstance(value, str) and value.strip():
            parent[target] = value.strip()
    if parent:
        lines.append(parent)

    for child in _as_list(entry.get("sub")):
        if not isinstance(child, dict):
            continue
        item = {}
        for target, source in (("name", "nm"), ("quantity", "cnt"), ("price", "price")):
            value = child.get(source)
            if isinstance(value, str) and value.strip():
                item[target] = value.strip()
        if item:
            lines.append(item)

    return lines


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    skipped = 0

    for offset in range(0, RECEIPT_COUNT, PAGE_SIZE):
        length = min(PAGE_SIZE, RECEIPT_COUNT - offset)
        payload = _get_json(
            f"{ROWS_URL}?dataset={DATASET}&config=default&split={SPLIT}"
            f"&offset={offset}&length={length}"
        )

        for row in payload["rows"]:
            index = row["row_idx"]
            stem = f"receipt_{index:03d}"
            annotation = json.loads(row["row"]["ground_truth"])
            fields = normalise_truth(annotation.get("gt_parse", {}))

            # Without a total there is nothing anchoring the receipt, so it is not worth an
            # extraction call.
            if "total_price" not in fields:
                skipped += 1
                continue

            image_path = OUT_DIR / f"{stem}.jpg"
            if not image_path.exists():
                src = row["row"]["image"]["src"]
                data = urllib.request.urlopen(
                    urllib.request.Request(src, headers=UA), timeout=180
                ).read()
                image_path.write_bytes(data)

            (OUT_DIR / f"{stem}.truth.json").write_text(
                json.dumps(
                    {
                        "doc_type": "receipt",
                        "source": f"{DATASET} [{SPLIT}] row {index}",
                        "licence": "CC-BY-4.0, NAVER CLOVA AI Research",
                        "image_size": annotation.get("meta", {}).get("image_size"),
                        "fields": fields,
                    },
                    indent=2,
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            written += 1

    print(f"Cached {written} receipts in {OUT_DIR}")
    if skipped:
        print(f"Skipped {skipped} with no annotated total")


if __name__ == "__main__":
    main()
