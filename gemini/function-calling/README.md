# Gemini Function Calling + Unsiloed: Visual Document Audit Trail

This example gives [Gemini](https://ai.google.dev/gemini-api/docs/function-calling) structured access to [Unsiloed's](https://docs.unsiloed.ai) document processing API through function calling, then draws Unsiloed's own evidence, per-field confidence scores and bounding-box citations, onto the source document so a reviewer can check every extracted value against the page it came from.

## What you'll learn

- How to define Unsiloed's parse, extract, and classify operations as Gemini function declarations
- How to build a tool executor and a manual function-calling loop that submits and polls Unsiloed's async jobs
- How to read the two confidence scores Unsiloed returns per field, and why the difference between them matters
- How to render citation boxes on the source document, including on photographs, using the reusable renderer in [`utils/audit_renderer.py`](./utils/audit_renderer.py)

## Why the two scores matter

Every extracted field comes back with both a `grounding_score` and an `extraction_score`. They answer different questions. `grounding_score` is confidence the value was located in the document; `extraction_score` is confidence it was read correctly once located.

The notebook demonstrates why that distinction is worth respecting. Ask for a field the document does not contain, such as an IBAN on a domestic statement, and Unsiloed returns `null` rather than a plausible invention. But the `extraction_score` on that null field stays high, while the `grounding_score` drops to zero. An integration that flattens the two into a single confidence number, or that reads only `extraction_score`, can report high confidence for a value that is not there.

Read `grounding_score` before trusting a value, and route the low and zero ones to a human.

## Prerequisites

- [Unsiloed API key](https://www.unsiloed.ai)
- [Gemini API key](https://aistudio.google.com/apikey)

## Quick start

```bash
# From the repo root
cp .env.example .env
# Edit .env and set UNSILOED_API_KEY and GEMINI_API_KEY

pip install -e .

cd gemini/function-calling
jupyter notebook gemini_unsiloed_audit_trail.ipynb
```

Run the cells in order. The notebook makes real API calls and takes a couple of minutes end to end.

## What the notebook covers

It works through two documents already in this repo, so there is nothing to download.

`sample-documents/sample-statement.pdf`, a clean digitally generated statement, covers the straightforward path: parse and summarise, extract typed fields with citations, then render the audit trail. It also covers the absent-field case described above.

`kyc-app/samples/passport_specimen.jpg` is the harder one. It is a specimen passport photographed at an angle, with holographic glare, trilingual field labels and a handwritten signature. It exercises three things the statement cannot: that `/v2/extract` accepts images despite the `pdf_file` form field name, that handwriting is read rather than guessed at, and a field that comes back ungrounded because it is not legible in the frame.

Classification closes the notebook, routing the passport through the same agent loop.

Scores move slightly between runs, so treat any number you see in a cell as indicative rather than fixed.

## Notes on the integration

`enable_citations=true` and `model=gamma` are set in the tool executor rather than exposed as parameters Gemini can choose. Without citations the grounding pass does not run and every `grounding_score` comes back as zero, which would quietly hollow out the entire point of this recipe. The `alpha` model tier also returns a different, flatter response shape.

The loop uses `client.models.generate_content` with `automatic_function_calling` disabled, so each tool call is visible in the output rather than handled inside the SDK. That keeps it close to the [Claude tool-use recipe](../../claude/tool-use/) in this cookbook, which follows the same submit, poll, feed-back structure.

This recipe covers parse, extract, and classify. It does not cover split, since nothing here needed a multi-document batch.

## The renderer

[`utils/audit_renderer.py`](./utils/audit_renderer.py) is independent of Gemini. Give it a document path and any `/v2/extract` result with citations enabled:

```python
from utils.audit_renderer import render_extraction_audit

render_extraction_audit("statement.pdf", extraction_result)
```

It draws a box per cited field, labelled with that field's raw scores, and lists anything it could not draw in a footer under the page: fields the API declined to ground, and fields cited on other pages. Nothing is dropped silently, because a field the API would not stand behind is the one a reviewer most needs to see. Pass `page=` to render a different page.

Deliberately absent is any red, amber and green verdict. Unsiloed's documentation defines no threshold for a safe score, so the renderer shows the numbers and leaves the judgement to the reader.

## Related

- [Unsiloed extract API reference](https://www.unsiloed.ai/docs/api-reference/extraction/extract-data)
- [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Claude + Unsiloed tool use](../../claude/tool-use/), the same integration against a different model
