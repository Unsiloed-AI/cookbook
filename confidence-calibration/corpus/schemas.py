"""Extraction schemas, one per document type, plus the field types behind them.

Every field is declared as a string and every description pins the exact written
form we want back (ISO dates, digits-only amounts). That matters more here than in
a normal recipe: this harness scores extracted values against known ground truth,
and a schema that leaves formatting open turns a correct read into a false miss.

`FIELD_TYPES` maps each field to how it should be compared, keyed by the same dotted
paths the flattened extraction result uses (`line_items[].amount` covers every row).
`compare.py` is the only consumer.
"""

INVOICE_SCHEMA = {
    "type": "object",
    "properties": {
        "invoice_number": {
            "type": "string",
            "description": "Invoice number, characters and dashes exactly as written.",
        },
        "invoice_date": {
            "type": "string",
            "description": "Date the invoice was issued, ISO 8601 (YYYY-MM-DD).",
        },
        "due_date": {
            "type": "string",
            "description": "Date payment is due, ISO 8601 (YYYY-MM-DD).",
        },
        "vendor_name": {
            "type": "string",
            "description": "Name of the company issuing the invoice.",
        },
        "vendor_tax_id": {
            "type": "string",
            "description": "The vendor's tax or VAT registration number, as written.",
        },
        "bill_to_name": {
            "type": "string",
            "description": "Name of the company being billed.",
        },
        "currency": {
            "type": "string",
            "description": "ISO 4217 currency code, for example USD.",
        },
        "subtotal": {
            "type": "string",
            "description": "Subtotal before tax, digits only with a decimal point, no currency symbol.",
        },
        "tax_rate": {
            "type": "string",
            "description": "Tax rate as a percentage, digits only with a decimal point, no percent sign.",
        },
        "tax_amount": {
            "type": "string",
            "description": "Tax charged, digits only with a decimal point, no currency symbol.",
        },
        "total_due": {
            "type": "string",
            "description": "Total amount payable, digits only with a decimal point, no currency symbol.",
        },
        "line_items": {
            "type": "array",
            "description": "Every billed line on the invoice, in the order printed.",
            "items": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "The line item description, as written.",
                    },
                    "quantity": {
                        "type": "string",
                        "description": "Quantity billed, digits only.",
                    },
                    "unit_price": {
                        "type": "string",
                        "description": "Price per unit, digits only with a decimal point.",
                    },
                    "amount": {
                        "type": "string",
                        "description": "Line total, digits only with a decimal point.",
                    },
                },
                "required": ["description", "quantity", "unit_price", "amount"],
            },
        },
    },
    "required": [
        "invoice_number",
        "invoice_date",
        "due_date",
        "vendor_name",
        "bill_to_name",
        "subtotal",
        "tax_amount",
        "total_due",
    ],
}

STATEMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "bank_name": {
            "type": "string",
            "description": "Name of the bank issuing the statement.",
        },
        "account_holder": {
            "type": "string",
            "description": "Name of the account holder, as written.",
        },
        "account_number": {
            "type": "string",
            "description": "Account number, digits and dashes exactly as written.",
        },
        "currency": {
            "type": "string",
            "description": "ISO 4217 currency code, for example USD.",
        },
        "statement_period_start": {
            "type": "string",
            "description": "First day of the statement period, ISO 8601 (YYYY-MM-DD).",
        },
        "statement_period_end": {
            "type": "string",
            "description": "Last day of the statement period, ISO 8601 (YYYY-MM-DD).",
        },
        "opening_balance": {
            "type": "string",
            "description": "Opening balance, digits only with a decimal point, no currency symbol.",
        },
        "closing_balance": {
            "type": "string",
            "description": "Closing balance, digits only with a decimal point, no currency symbol.",
        },
        "transactions": {
            "type": "array",
            "description": "Every transaction row in the statement table, in the order printed.",
            "items": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Transaction date, ISO 8601 (YYYY-MM-DD).",
                    },
                    "description": {
                        "type": "string",
                        "description": "Transaction description, as written.",
                    },
                    "amount": {
                        "type": "string",
                        "description": (
                            "Signed transaction amount, digits with a decimal point, "
                            "leading minus for debits."
                        ),
                    },
                    "balance": {
                        "type": "string",
                        "description": "Running balance after this transaction, digits only.",
                    },
                },
                "required": ["date", "description", "amount", "balance"],
            },
        },
    },
    "required": [
        "bank_name",
        "account_holder",
        "account_number",
        "opening_balance",
        "closing_balance",
    ],
}

ID_CARD_SCHEMA = {
    "type": "object",
    "properties": {
        "full_name": {
            "type": "string",
            "description": "Full name of the holder, as written.",
        },
        "document_number": {
            "type": "string",
            "description": "Document number, characters and digits exactly as written.",
        },
        "date_of_birth": {
            "type": "string",
            "description": "Date of birth, ISO 8601 (YYYY-MM-DD).",
        },
        "nationality": {
            "type": "string",
            "description": "Nationality of the holder, as written.",
        },
        "sex": {
            "type": "string",
            "description": "Sex as printed on the card, a single letter.",
        },
        "place_of_birth": {
            "type": "string",
            "description": "Place of birth, as written.",
        },
        "issue_date": {
            "type": "string",
            "description": "Date the card was issued, ISO 8601 (YYYY-MM-DD).",
        },
        "expiry_date": {
            "type": "string",
            "description": "Date the card expires, ISO 8601 (YYYY-MM-DD).",
        },
        "issuing_authority": {
            "type": "string",
            "description": "Authority that issued the card, as written.",
        },
    },
    "required": ["full_name", "document_number", "date_of_birth", "expiry_date"],
}

SCHEMAS = {
    "invoice": INVOICE_SCHEMA,
    "statement": STATEMENT_SCHEMA,
    "id_card": ID_CARD_SCHEMA,
}

# How each field is compared. Money tolerates currency symbols and separators, dates
# are parsed before comparing so 03/11 and 2026-11-03 do not count as a miss, ids fold
# punctuation, text folds case and whitespace. Spelled out per field rather than
# guessed from the name, so adding a field forces the decision to be made explicitly.
FIELD_TYPES = {
    "invoice": {
        "invoice_number": "id",
        "invoice_date": "date",
        "due_date": "date",
        "vendor_name": "text",
        "vendor_tax_id": "id",
        "bill_to_name": "text",
        "currency": "code",
        "subtotal": "money",
        "tax_rate": "number",
        "tax_amount": "money",
        "total_due": "money",
        "line_items[].description": "text",
        "line_items[].quantity": "number",
        "line_items[].unit_price": "money",
        "line_items[].amount": "money",
    },
    "statement": {
        "bank_name": "text",
        "account_holder": "text",
        "account_number": "id",
        "currency": "code",
        "statement_period_start": "date",
        "statement_period_end": "date",
        "opening_balance": "money",
        "closing_balance": "money",
        "transactions[].date": "date",
        "transactions[].description": "text",
        "transactions[].amount": "money",
        "transactions[].balance": "money",
    },
    "id_card": {
        "full_name": "text",
        "document_number": "id",
        "date_of_birth": "date",
        "nationality": "text",
        "sex": "code",
        "place_of_birth": "text",
        "issue_date": "date",
        "expiry_date": "date",
        "issuing_authority": "text",
    },
}
