---
name: unsiloed
description: Use whenever the user wants information out of a document — to read it, answer a question about its contents, pull fields from it, classify it, or split it. The trigger is that request, not merely that a file is attached. A document dropped in as background for another task, with no question about its contents, does not need this skill. Covers four operations through one API — parse (read everything on the page), extract (pull named fields with confidence scores), classify (decide what kind of document this is), and split (break a multi-document PDF apart by type). Trigger phrases include "what does this say", "what medicines are listed", "extract the totals", "is this a receipt or a contract", "split this bundle into separate files", "read this form". When acting on a document, DO NOT read it with your own vision — that fabricates content on handwriting and dense layouts and gives no confidence signal. Route through Unsiloed via the curl blocks in this skill.
metadata:
  openclaw:
    requires:
      env: [UNSILOED_API_KEY]
      bins: [curl, jq]
---

# Unsiloed

Specialised document AI for any image or PDF. Four operations, all via the same async pattern: submit returns a `job_id`, poll until done, read the result. The API base is `https://prod.visionapi.unsiloed.ai` and every call sends the API key in the `api-key` header.

## When to Use — Read This First

Use this skill whenever the user wants information out of a document — to read it, answer a question about it, pull fields from it, classify it, or split it. What triggers the skill is that request, not the mere presence of an attachment: if someone drops a file in as background for another task and doesn't ask anything about its contents, you don't need to run it.

When they do ask, and the source is a document (PDF, scan, form, or photo of a page), route it through Unsiloed instead of reading it yourself. Images with no document content — a photo of a pet, a landscape, a screenshot they're asking about visually — aren't documents; answer those directly.

For text-bearing documents, the skill exists to give the user a confidence-scored answer they can verify. Reading the document with your own vision skips that signal and reintroduces the failure mode this skill is designed to prevent — fabricated content on handwriting, silent errors on dense layouts, no way for the user to know what to trust. If a document "looks easy to read" and you're tempted to skip the curl call, that's the failure mode. Run it anyway.

## Picking the Right Operation

Four operations, one decision tree:

- **Parse** — the user wants to *read* the document. "What does this say", "list the medicines", "what's on this form". Returns Markdown of every layout region on the page. **This is the default. Use Parse unless one of the other three clearly fits.**
- **Extract** — the user wants *specific fields as structured data*. "Pull the invoice total", "give me each line item as JSON", "I need name, date, and amount with confidence scores". Needs a JSON Schema you build up front.
- **Classify** — the user wants to *know what kind of document this is*. "Is this an invoice or a contract", "categorise this as one of: receipt, lab report, prescription". Returns the predicted category with a confidence score.
- **Split** — the user has *one PDF containing several different documents* and wants them separated. "This scan is a stack of mixed receipts and invoices — split them apart". Returns one downloadable file per detected document.

All four are async. The polling shape is the same. The status values and form field names differ slightly per endpoint — the curl blocks below have the right values for each.

## Parse — The Default Read

For "what does this say" / "what's on this page" / "list the items" questions:

```bash
JOB=$(curl -s -X POST https://prod.visionapi.unsiloed.ai/parse \
  -H "api-key: $UNSILOED_API_KEY" \
  -F "file=@<FILE-PATH>" \
  | jq -r '.job_id')
for _ in $(seq 60); do  # 60 × 3s = 180s cap
  R=$(curl -s "https://prod.visionapi.unsiloed.ai/parse/$JOB" -H "api-key: $UNSILOED_API_KEY")
  S=$(echo "$R" | jq -r '.status')
  [ "$S" = "Succeeded" ] && { echo "$R" | jq -r '.chunks[].embed'; break; }
  [ "$S" = "Failed" ] && { echo "$R" | jq -r '.message' >&2; exit 1; }
  sleep 3
done
[ "$S" = "Succeeded" ] || echo "Parse timed out after 180s — job may still be running" >&2
```

Parse uses `file=@...` and PascalCase statuses (`Succeeded`/`Failed`). The result is Markdown of each layout region — one chunk per heading, paragraph, table, list, image caption, etc. Quote the relevant chunk in the reply. Don't invent sections that aren't there.

Typical timing is 10–30 seconds. Allow up to 180 seconds for dense scanned PDFs.

Parse returns the whole document, so on a long PDF the combined `embed` output gets large. When the user only needs part of it, narrow the request with `-F "page_range=1-5"` or `-F "segment_filter=table"` instead of pulling every chunk back, and summarise rather than echoing all of it into the reply.

## Extract — Specific Fields with Confidence

Use Extract only when **all three** are true:

1. The user explicitly asked for structured fields, a table, or JSON.
2. You can name every field they want up front.
3. They need numerical confidence per individual field.

```bash
SCHEMA='<SCHEMA-JSON>'  # single-quote so the schema's double quotes survive

JOB=$(curl -s -X POST https://prod.visionapi.unsiloed.ai/v2/extract \
  -H "api-key: $UNSILOED_API_KEY" \
  -F "pdf_file=@<FILE-PATH>" \
  -F "schema_data=$SCHEMA" \
  | jq -r '.job_id')
for _ in $(seq 60); do  # 60 × 3s = 180s cap
  R=$(curl -s "https://prod.visionapi.unsiloed.ai/extract/$JOB" -H "api-key: $UNSILOED_API_KEY")
  S=$(echo "$R" | jq -r '.status')
  [ "$S" = "completed" ] && { echo "$R" | jq '.result'; break; }
  [ "$S" = "failed" ] && { echo "$R" | jq -r '.error' >&2; exit 1; }
  sleep 3
done
[ "$S" = "completed" ] || echo "Extract timed out after 180s — job may still be running" >&2
```

Extract uses `pdf_file=@...` (which accepts images too, despite the name) and lowercase statuses (`completed`/`failed`). Every leaf in `.result` is wrapped as `{value, score}`, and the default output above keeps both — which is what you want, since the per-field score is the whole point. (Bounding-box citations are added to each leaf only if you also pass `-F "enable_citations=true"`.)

Treat `score >= 0.85` as reliable. Below that, flag the uncertainty in the reply so the user knows which fields to double-check.

When the values are headed somewhere structured (a spreadsheet, a database row) and you've already done the confidence check, strip the wrappers to a clean values-only object:

```bash
echo "$R" | jq '.result | walk(if type == "object" and has("value") and has("score") then .value else . end)'
```

### Building the schema

Plain JSON Schema. Two rules and one habit:

- Set `additionalProperties: false` on every object level so Unsiloed doesn't invent fields.
- Mark a field `required` only when it's reliably present on this kind of document. A `required` field the model can't find pressures it to emit a guess — the exact fabrication this skill exists to prevent. Leave genuinely optional fields out of `required` so a missing value comes back absent instead of invented.
- Add a short `description` to each property — it steers Unsiloed at the page. Tell it "name as written, do not expand abbreviations", "ISO 4217 currency code", "digits only with single decimal separator". That's how you stop the model from being clever.

Medicines on a prescription:

```json
{
  "type": "object",
  "properties": {
    "medicines": {
      "type": "array",
      "description": "Every medicine prescribed. Exclude diagnoses, advice, headings.",
      "items": {
        "type": "object",
        "properties": {
          "name":     {"type": "string", "description": "Brand name as written. Do not expand abbreviations."},
          "strength": {"type": "string"},
          "dosing":   {"type": "string", "description": "Schedule if visible (e.g. 1-0-1, BD, TDS)."}
        },
        "required": ["name"],
        "additionalProperties": false
      }
    }
  },
  "required": ["medicines"],
  "additionalProperties": false
}
```

Receipt totals:

```json
{
  "type": "object",
  "properties": {
    "merchant": {"type": "string"},
    "date":     {"type": "string", "description": "ISO 8601 (YYYY-MM-DD)"},
    "currency": {"type": "string", "description": "ISO 4217 code"},
    "total":    {"type": "string", "description": "Final total paid, digits only"}
  },
  "required": ["merchant", "date", "currency", "total"],
  "additionalProperties": false
}
```

## Classify — What Kind of Document Is This

When the user wants to label a document as one of several types:

```bash
CATEGORIES='[{"name":"invoice","description":"Financial invoices with itemized charges"},{"name":"receipt"},{"name":"contract","description":"Legal agreements"}]'

JOB=$(curl -s -X POST https://prod.visionapi.unsiloed.ai/classify \
  -H "api-key: $UNSILOED_API_KEY" \
  -F "pdf_file=@<FILE-PATH>" \
  -F "categories=$CATEGORIES" \
  | jq -r '.job_id')
for _ in $(seq 60); do  # 60 × 3s = 180s cap
  R=$(curl -s "https://prod.visionapi.unsiloed.ai/classify/$JOB" -H "api-key: $UNSILOED_API_KEY")
  S=$(echo "$R" | jq -r '.status')
  [ "$S" = "completed" ] && { echo "$R" | jq '.result'; break; }
  [ "$S" = "failed" ] && { echo "$R" | jq -r '.error' >&2; exit 1; }
  sleep 3
done
[ "$S" = "completed" ] || echo "Classify timed out after 180s — job may still be running" >&2
```

Classify uses `pdf_file=@...` and lowercase statuses. The categories array can include short descriptions per category — adding them noticeably improves accuracy when category names are ambiguous (e.g. "invoice" vs "receipt" both being financial). Build the category list from what the user asked about: if they only named two options, use those; if they didn't name any, propose a small list of plausible categories in your reply and run with those.

The result includes a per-page category plus an overall classification, each with confidence. Quote the overall verdict in the reply and flag any individual page that disagreed.

## Split — Break a Mixed PDF Apart

When the user has one PDF containing several different documents (a scanned batch, a mixed inbox dump):

```bash
CATEGORIES='[{"name":"invoice","description":"Business invoices"},{"name":"contract"},{"name":"receipt"}]'

JOB=$(curl -s -X POST https://prod.visionapi.unsiloed.ai/splitter \
  -H "api-key: $UNSILOED_API_KEY" \
  -F "file=@<FILE-PATH>" \
  -F "categories=$CATEGORIES" \
  | jq -r '.job_id')
for _ in $(seq 60); do  # 60 × 3s = 180s cap
  R=$(curl -s "https://prod.visionapi.unsiloed.ai/splitter/$JOB" -H "api-key: $UNSILOED_API_KEY")
  S=$(echo "$R" | jq -r '.status')
  [ "$S" = "completed" ] && { echo "$R" | jq '.result'; break; }
  [ "$S" = "failed" ] && { echo "$R" | jq -r '.error' >&2; exit 1; }
  sleep 3
done
[ "$S" = "completed" ] || echo "Split timed out after 180s — job may still be running" >&2
```

Split uses `file=@...` (different from classify) and lowercase statuses. The result is `result.files[]` — one entry per detected document, named by its category (e.g. `Invoice.pdf`), each with a `confidence_score` and a `full_path` download URL. Splitter keeps multi-page documents together — a two-page lab report stays as one output, not two. The response does not include per-document page ranges, so don't state which pages a document spanned.

For the reply, list each detected document by its category (from the file name) and confidence. Quote the `full_path` download URLs if the user asked for them; otherwise summarise. Do not promise the user a file you didn't get back.

## Replying to the User

The curl output is the agent's working data, not the reply. Quote the relevant content in plain English. Don't paste raw JSON, don't paste raw markdown chunks, and don't narrate the curl commands.

For Parse, summarise what's on the page or quote the section the user asked about.

For Extract, quote the `value` fields and flag any with `score` below 0.85.

For Classify, name the predicted category and mention the confidence. Flag any per-page disagreement.

For Split, list each output document by its category and confidence.

A few examples of the tone:

> Three medicines on this prescription: **Tab Azee 500mg**, **Tab Montair FX**, **Tab Dolo 650**. All extracted with confidence above 0.95.

> This is an **invoice** (confidence 0.94). Page 3 was less clear (0.71) and might be an attached receipt — worth a glance.

> The bundle split into four documents — an invoice, a receipt, a contract, and a form — each saved as its own file, all classified with confidence above 0.99.

## Getting the File Path

Inbound media (Telegram attachments, file shares) is already on disk by the time the agent sees it — the channel handler passes the local path through. Use that path in the `-F "file=@..."` or `-F "pdf_file=@..."` form field. If the user pastes a path, use that. Multi-page PDFs go through directly without any pre-splitting.

## Errors

If the curl call fails or returns a `failed` / `Failed` status, do not fall back to vision-reading the document. Tell the user what failed (timeout, unsupported file type, missing API key) and stop. Falling back to your own vision defeats the whole point of the skill.

Common errors and what they mean:

- **`UNSILOED_API_KEY not set`** — the env var isn't loaded into the gateway. Tell the user.
- **`Unsupported file type`** — Unsiloed accepts PDF, PNG, JPEG, TIFF, BMP, DOCX, XLSX, PPTX. Anything else needs converting first.
- **Polling timeout (180s)** — the job is still running. Unusual for single pages, common for dense multi-page scans. Tell the user and offer to retry.
- **`Extraction failed`** — schema rejected, file corrupted, or pages unreadable. Report the error message verbatim.
