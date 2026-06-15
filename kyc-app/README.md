# KYC ID-Verification Demo

Reads ID documents that have **no text layer** (photos / scans) and runs a rule-based
consistency check across them. Text extraction (`pdftotext`) returns 0 characters on
these images; a vision model reads them but will confidently invent a digit in a
passport number or DOB with no way to know which fields to trust. So the reading is
done by **[Unsiloed](https://unsiloed.ai)**, which pulls every field straight off the
image with a **confidence score and a citation** to where it read it. Everything around
it — cross-checks and the decision — is deterministic.

## What it does

1. Upload an **ID**, a **utility bill**, and a **bank statement** (any combination).
2. Each is run through Unsiloed `/v2/extract` with a per-document-type schema, with
   citations and confidence enabled. The Unsiloed API key stays server-side.
3. A rule engine cross-checks **name** and **address** across documents and checks the
   **ID expiry**.
4. Returns **PASS / REVIEW / FAIL** — low-confidence or unreadable fields are flagged
   for manual review.

## ⚠️ Scope — read this

This verifies **consistency and validity, not authenticity.** It checks that the
name/address agree across documents and that the ID is unexpired. It does **not** do
forgery detection, liveness, or document-authenticity checks — a cleanly faked ID with
a matching name/address and a future expiry date will **PASS**. KYC/onboarding
has compliance, security, and anti-fraud requirements this does not address.

## Run

```bash
pip install flask requests
export UNSILOED_API_KEY=...        # or put it in ../.env
python app.py                      # http://127.0.0.1:5001
```

## Decision logic

| Outcome | When |
|---|---|
| **FAIL** | ID expired, or a name/address mismatch across documents |
| **REVIEW** | a critical field is unreadable or below the confidence threshold (0.85) |
| **PASS** | all documents consistent and clearly read |

Built on Unsiloed for the reading; the rest is a thin Flask app. Open source and free.