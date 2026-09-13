"""Generate the calibration corpus: documents whose every field value is already known.

Measuring whether a confidence score predicts correctness needs ground truth for every
field, and hand-labelling documents is slow, error-prone and unpublishable. Generating
the documents inverts the problem: we write the values first, lay them out second, so
the answer key is exact by construction and the whole corpus is reproducible from a seed.

Each document is written twice, as a PDF and as a `.truth.json` holding its values keyed
by the dotted paths `compare.py` flattens extraction results into.

Deterministic: `rl_config.invariant` strips the timestamps reportlab would otherwise
embed, so regenerating from the same seed produces byte-identical PDFs.

Run: python -m corpus.generate        (from confidence-calibration/)
"""

import json
import random
from datetime import date, timedelta
from pathlib import Path

from reportlab import rl_config

# Must be set before any reportlab canvas is built, hence the import placement below.
rl_config.invariant = 1

from reportlab.lib import colors  # noqa: E402
from reportlab.lib.pagesizes import LETTER  # noqa: E402
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # noqa: E402
from reportlab.lib.units import inch, mm  # noqa: E402
from reportlab.pdfgen import canvas as pdfcanvas  # noqa: E402
from reportlab.platypus import (  # noqa: E402
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

SEED = 20260912
OUT_DIR = Path(__file__).resolve().parent.parent / "documents"

# Counts are a budget decision: every document is extracted once per difficulty tier,
# so 12 documents means 48 extraction jobs. Enough fields for a reliability curve
# without making the run expensive to reproduce.
INVOICE_COUNT = 5
STATEMENT_COUNT = 4
ID_CARD_COUNT = 3

styles = getSampleStyleSheet()
TITLE = ParagraphStyle("T", parent=styles["Title"], fontSize=20, alignment=0, spaceAfter=2)
SUB = ParagraphStyle("SUB", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#666666"))
BODY = ParagraphStyle("B", parent=styles["Normal"], fontSize=9, leading=12)
LABEL = ParagraphStyle("L", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#888888"))

VENDORS = [
    ("Brightline Logistics Ltd", "GB 742 118 593", "Unit 7 Canalside Park, Leeds LS11 5QP"),
    ("Meridian Print Services", "US 84-2917553", "1140 Fulton Ave, Sacramento CA 95825"),
    ("Halvorsen Instruments AS", "NO 983 472 118", "Storgata 44, 0184 Oslo"),
    ("Kestrel Facilities Group", "GB 556 903 217", "3 Ashby Court, Bristol BS2 0QN"),
    ("Tanaka Precision KK", "JP 6010401 09287", "2-14-8 Shibaura, Minato-ku, Tokyo"),
]

CLIENTS = [
    "Northwind Capital LLC",
    "Aldergate Pharma Inc",
    "Vantor Systems GmbH",
    "Pellham & Rowe Associates",
    "Cobalt Ridge Holdings",
]

BANKS = [
    ("First Meridian Bank", "USD"),
    ("Caldera Savings & Trust", "USD"),
    ("Ostsee Handelsbank AG", "EUR"),
    ("Northbank Commercial", "GBP"),
]

LINE_DESCRIPTIONS = [
    "Freight forwarding, Rotterdam to Felixstowe",
    "Pallet handling and storage, 30 days",
    "Customs documentation processing",
    "Temperature-controlled container hire",
    "Offset printing, 4-colour, 2500 units",
    "Digital proofing and colour matching",
    "Calibration service, class 2 instruments",
    "Annual maintenance contract, tier B",
    "Site cleaning, out of hours",
    "Emergency callout, engineer attendance",
]

# Direction and plausible range are fixed per description rather than drawn at random.
# A monthly account fee that credits the account, or a £5,800 stationery purchase, reads
# as fake immediately, and these documents have to survive a skim by someone who works
# with statements all day. Each entry is (description, sign, low, high).
TRANSACTIONS = [
    ("CARD PURCHASE 4412 STAPLES", -1, 18.0, 240.0),
    ("DIRECT DEBIT BRITISH GAS", -1, 95.0, 680.0),
    ("TRANSFER IN REF INV-2291", 1, 1_400.0, 12_500.0),
    ("SALARY PAYMENT RUN 08", -1, 9_800.0, 24_000.0),
    ("CARD PURCHASE 4412 UBER", -1, 11.0, 86.0),
    ("STANDING ORDER OFFICE RENT", -1, 1_250.0, 4_400.0),
    ("BACS CREDIT MERIDIAN PRINT", 1, 800.0, 7_300.0),
    ("FEE MONTHLY ACCOUNT CHARGE", -1, 12.0, 48.0),
    ("CARD PURCHASE 4412 AMAZON", -1, 24.0, 410.0),
    ("CHEQUE DEPOSIT 004187", 1, 350.0, 5_600.0),
]

HOLDER_NAMES = [
    ("ROWAN ELISE MARCHETTI", "F", "Valletta, Malta", "Maltese"),
    ("DEVRAJ SINGH KHURANA", "M", "Jalandhar, India", "Indian"),
    ("INGRID SOLVEIG HALVORSEN", "F", "Bergen, Norway", "Norwegian"),
]

CURRENCY_SYMBOLS = {"USD": "$", "EUR": "€", "GBP": "£"}


def _money(value: float) -> str:
    """Ground-truth form for an amount: digits and a decimal point, matching the schema."""
    return f"{value:.2f}"


def _printed(value: float, currency: str) -> str:
    """Display form for an amount: symbol, thousands separators, minus outside the symbol."""
    sign = "-" if value < 0 else ""
    return f"{sign}{CURRENCY_SYMBOLS[currency]}{abs(value):,.2f}"


def _table(headers, rows, widths, align_right=()):
    t = Table([headers] + rows, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f3864")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f6f9")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c8ccd4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for col in align_right:
        style.append(("ALIGN", (col, 0), (col, -1), "RIGHT"))
    t.setStyle(TableStyle(style))
    return t


def make_invoice(rng: random.Random, index: int) -> tuple[str, dict, list]:
    """Build one invoice. Returns (stem, ground truth, reportlab flowables)."""
    vendor_name, vendor_tax_id, vendor_address = VENDORS[index % len(VENDORS)]
    client = CLIENTS[index % len(CLIENTS)]
    currency = rng.choice(["USD", "EUR", "GBP"])

    issued = date(2026, rng.randint(1, 8), rng.randint(1, 28))
    due = issued + timedelta(days=rng.choice([14, 30, 45]))
    number = f"INV-{issued.year}-{rng.randint(1000, 9999)}"

    items = []
    for description in rng.sample(LINE_DESCRIPTIONS, rng.randint(3, 5)):
        quantity = rng.randint(1, 24)
        unit_price = round(rng.uniform(18.0, 940.0), 2)
        items.append(
            {
                "description": description,
                "quantity": str(quantity),
                "unit_price": _money(unit_price),
                "amount": _money(round(quantity * unit_price, 2)),
            }
        )

    subtotal = round(sum(float(i["amount"]) for i in items), 2)
    tax_rate = rng.choice([5.0, 7.5, 19.0, 20.0])
    tax_amount = round(subtotal * tax_rate / 100, 2)
    total_due = round(subtotal + tax_amount, 2)

    truth = {
        "invoice_number": number,
        "invoice_date": issued.isoformat(),
        "due_date": due.isoformat(),
        "vendor_name": vendor_name,
        "vendor_tax_id": vendor_tax_id,
        "bill_to_name": client,
        "currency": currency,
        "subtotal": _money(subtotal),
        "tax_rate": f"{tax_rate:g}",
        "tax_amount": _money(tax_amount),
        "total_due": _money(total_due),
        "line_items": items,
    }

    flow = [
        Paragraph("INVOICE", TITLE),
        Paragraph(f"{vendor_name}<br/>{vendor_address}<br/>Tax ID {vendor_tax_id}", SUB),
        Spacer(1, 16),
        _table(
            ["Invoice number", "Invoice date", "Due date", "Currency"],
            [[number, issued.strftime("%d %b %Y"), due.strftime("%d %b %Y"), currency]],
            [1.6 * inch, 1.4 * inch, 1.4 * inch, 1.0 * inch],
        ),
        Spacer(1, 14),
        Paragraph("BILL TO", LABEL),
        Paragraph(client, BODY),
        Spacer(1, 14),
        _table(
            ["Description", "Qty", "Unit price", "Amount"],
            [
                [
                    Paragraph(i["description"], BODY),
                    i["quantity"],
                    _printed(float(i["unit_price"]), currency),
                    _printed(float(i["amount"]), currency),
                ]
                for i in items
            ],
            [3.5 * inch, 0.6 * inch, 1.2 * inch, 1.2 * inch],
            align_right=(1, 2, 3),
        ),
        Spacer(1, 10),
        _table(
            ["", ""],
            [
                ["Subtotal", _printed(subtotal, currency)],
                [f"Tax at {tax_rate:g}%", _printed(tax_amount, currency)],
                ["Total due", _printed(total_due, currency)],
            ],
            [4.3 * inch, 1.4 * inch],
            align_right=(1,),
        ),
        Spacer(1, 18),
        Paragraph(
            f"Payment due by {due.strftime('%d %B %Y')}. "
            "Late settlement is subject to interest at 4% above base rate.",
            SUB,
        ),
    ]
    return f"invoice_{index + 1:02d}", truth, flow


def make_statement(rng: random.Random, index: int) -> tuple[str, dict, list]:
    """Build one bank statement. Returns (stem, ground truth, reportlab flowables)."""
    bank_name, currency = BANKS[index % len(BANKS)]
    holder = CLIENTS[(index + 2) % len(CLIENTS)]
    account_number = f"{rng.randint(10, 99)}-{rng.randint(10000, 99999)}-{rng.randint(100, 999)}"

    period_start = date(2026, rng.randint(1, 7), 1)
    period_end = (period_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

    opening = round(rng.uniform(4_000.0, 90_000.0), 2)
    balance = opening
    rows = []
    for description, direction, low, high in rng.sample(TRANSACTIONS, rng.randint(5, 7)):
        day = rng.randint(1, (period_end - period_start).days + 1)
        when = period_start + timedelta(days=day - 1)
        magnitude = round(rng.uniform(low, high), 2)
        rows.append(
            {
                "date": when.isoformat(),
                "description": description,
                "amount": _money(direction * magnitude),
                "balance": "",  # filled after sorting, below
            }
        )
    rows.sort(key=lambda r: r["date"])

    # The running balance has to agree with the order the rows are printed in, so it is
    # computed after the sort rather than during generation.
    balance = opening
    for row in rows:
        balance = round(balance + float(row["amount"]), 2)
        row["balance"] = _money(balance)
    closing = balance

    truth = {
        "bank_name": bank_name,
        "account_holder": holder,
        "account_number": account_number,
        "currency": currency,
        "statement_period_start": period_start.isoformat(),
        "statement_period_end": period_end.isoformat(),
        "opening_balance": _money(opening),
        "closing_balance": _money(closing),
        "transactions": rows,
    }

    flow = [
        Paragraph(bank_name, TITLE),
        Paragraph("Statement of account", SUB),
        Spacer(1, 16),
        _table(
            ["Account holder", "Account number", "Period", "Currency"],
            [
                [
                    Paragraph(holder, BODY),
                    account_number,
                    f"{period_start.strftime('%d %b')} to {period_end.strftime('%d %b %Y')}",
                    currency,
                ]
            ],
            [1.9 * inch, 1.5 * inch, 1.8 * inch, 0.8 * inch],
        ),
        Spacer(1, 14),
        _table(
            ["Date", "Description", "Amount", "Balance"],
            [
                [
                    date.fromisoformat(r["date"]).strftime("%d/%m/%Y"),
                    Paragraph(r["description"], BODY),
                    _printed(float(r["amount"]), currency),
                    _printed(float(r["balance"]), currency),
                ]
                for r in rows
            ],
            [0.95 * inch, 3.0 * inch, 1.25 * inch, 1.25 * inch],
            align_right=(2, 3),
        ),
        Spacer(1, 10),
        _table(
            ["", ""],
            [
                ["Opening balance", _printed(opening, currency)],
                ["Closing balance", _printed(closing, currency)],
            ],
            [4.3 * inch, 1.4 * inch],
            align_right=(1,),
        ),
        Spacer(1, 18),
        Paragraph(
            "Please report any discrepancy within 60 days of the statement date.", SUB
        ),
    ]
    return f"statement_{index + 1:02d}", truth, flow


def write_flowable_pdf(path: Path, flow: list, pagesize=LETTER) -> None:
    SimpleDocTemplate(
        str(path),
        pagesize=pagesize,
        leftMargin=0.8 * inch,
        rightMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        title="",
        author="",
        subject="",
        creator="",
    ).build(flow)


def write_id_card(path: Path, rng: random.Random, index: int) -> dict:
    """Draw an ID card at fixed coordinates and return its ground truth.

    Cards are laid out directly on a canvas rather than with flowables: the value of
    this document type is the dense two-column label grid and the small type, which a
    flowing layout would not reproduce.
    """
    full_name, sex, place_of_birth, nationality = HOLDER_NAMES[index % len(HOLDER_NAMES)]
    number = f"{rng.choice('XKPT')}{rng.randint(1000000, 9999999)}"
    born = date(rng.randint(1968, 2001), rng.randint(1, 12), rng.randint(1, 28))
    issued = date(2024, rng.randint(1, 12), rng.randint(1, 28))
    expires = issued.replace(year=issued.year + 10)
    authority = rng.choice(
        ["Ministry of the Interior", "National Registry Office", "Department of Civil Affairs"]
    )

    truth = {
        "full_name": full_name,
        "document_number": number,
        "date_of_birth": born.isoformat(),
        "nationality": nationality,
        "sex": sex,
        "place_of_birth": place_of_birth,
        "issue_date": issued.isoformat(),
        "expiry_date": expires.isoformat(),
        "issuing_authority": authority,
    }

    width, height = 150 * mm, 100 * mm
    c = pdfcanvas.Canvas(str(path), pagesize=(width, height))
    c.setTitle("")
    c.setAuthor("")
    c.setSubject("")
    c.setCreator("")

    c.setFillColor(colors.HexColor("#eef1f6"))
    c.rect(0, 0, width, height, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#1f3864"))
    c.rect(0, height - 16 * mm, width, 16 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(8 * mm, height - 10.5 * mm, "IDENTITY CARD")
    c.setFont("Helvetica", 8)
    c.drawRightString(width - 8 * mm, height - 10.5 * mm, authority.upper())

    # Portrait placeholder. Present so the layout reads as a card rather than a form.
    c.setFillColor(colors.HexColor("#cfd5e0"))
    c.rect(8 * mm, 22 * mm, 30 * mm, 40 * mm, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#8a93a5"))
    c.setFont("Helvetica", 6)
    c.drawCentredString(23 * mm, 41 * mm, "PHOTO")

    fields = [
        ("SURNAME / GIVEN NAMES", full_name),
        ("DOCUMENT NO.", number),
        ("DATE OF BIRTH", born.strftime("%d %b %Y")),
        ("SEX", sex),
        ("NATIONALITY", nationality),
        ("PLACE OF BIRTH", place_of_birth),
        ("DATE OF ISSUE", issued.strftime("%d %b %Y")),
        ("DATE OF EXPIRY", expires.strftime("%d %b %Y")),
    ]

    y = height - 26 * mm
    for label, value in fields:
        c.setFillColor(colors.HexColor("#7a8496"))
        c.setFont("Helvetica", 5.5)
        c.drawString(44 * mm, y, label)
        c.setFillColor(colors.HexColor("#111111"))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(44 * mm, y - 4.6 * mm, value)
        y -= 9.2 * mm

    # Machine-readable zone, the dense small-type band every real card carries.
    c.setFillColor(colors.HexColor("#ffffff"))
    c.rect(0, 0, width, 14 * mm, stroke=0, fill=1)
    surname = full_name.split()[-1]
    given = "".join(part[0] for part in full_name.split()[:-1])
    c.setFillColor(colors.HexColor("#222222"))
    c.setFont("Courier-Bold", 9)
    c.drawString(8 * mm, 8 * mm, f"IDC{nationality[:3].upper()}{number}<<<<<<<<<<<<<<<")
    c.drawString(
        8 * mm,
        3 * mm,
        f"{born.strftime('%y%m%d')}{sex}{expires.strftime('%y%m%d')}<<{surname}<<{given}<<",
    )

    c.showPage()
    c.save()
    return truth


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)
    written = []

    for index in range(INVOICE_COUNT):
        stem, truth, flow = make_invoice(rng, index)
        write_flowable_pdf(OUT_DIR / f"{stem}.pdf", flow)
        (OUT_DIR / f"{stem}.truth.json").write_text(
            json.dumps({"doc_type": "invoice", "fields": truth}, indent=2), encoding="utf-8"
        )
        written.append(stem)

    for index in range(STATEMENT_COUNT):
        stem, truth, flow = make_statement(rng, index)
        write_flowable_pdf(OUT_DIR / f"{stem}.pdf", flow)
        (OUT_DIR / f"{stem}.truth.json").write_text(
            json.dumps({"doc_type": "statement", "fields": truth}, indent=2), encoding="utf-8"
        )
        written.append(stem)

    for index in range(ID_CARD_COUNT):
        stem = f"id_card_{index + 1:02d}"
        truth = write_id_card(OUT_DIR / f"{stem}.pdf", rng, index)
        (OUT_DIR / f"{stem}.truth.json").write_text(
            json.dumps({"doc_type": "id_card", "fields": truth}, indent=2), encoding="utf-8"
        )
        written.append(stem)

    print(f"Wrote {len(written)} documents to {OUT_DIR}")
    for stem in written:
        print(f"  {stem}.pdf + {stem}.truth.json")


if __name__ == "__main__":
    main()
