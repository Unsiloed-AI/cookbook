# n8n-nodes-unsiloed

An [n8n](https://n8n.io) community node for [Unsiloed AI](https://unsiloed.ai). It reads documents (PDFs, scans, photos, images) and returns clean Markdown or structured JSON inside your workflows.

n8n has no built-in OCR. Its **Extract from File** node reads a PDF's embedded text layer, not the page, so a scan, a phone photo, or any PDF with a broken text layer comes back as confident nonsense and nothing warns you. This node OCRs the rendered page instead, so it reads what a person sees.

## Why n8n's Built-In Extraction Falls Short

The built-in extractor trusts the text layer. That layer is fine for clean born-digital PDFs, but scans and many exports either have no text layer or a broken one, and the extractor returns garbage without failing. Same invoice, same workflow, two extractors:

```text
n8n Extract from PDF →  "OFCGOET  Ofcgoet Fg. IC-9762 ...  Zgzqsrxt $33,002.99"
Unsiloed             →  "INVOICE  Invoice No. HV-2087 ...  Total due  $11,557.22"
```

Parse forces OCR on the rendered pixels, and Extract reads the rendered document by design, so a bad text layer can't poison either result.

## What the Node Does

The node has two operations:

- **Parse:** OCR the document and return layout-aware Markdown (headings, tables, paragraphs). No schema required.
- **Extract:** pull named fields into JSON using a schema you define (invoice number, totals, dates, line items). Each value comes back with a confidence score and a citation (page and bounding box).

## Installing

The node is published on npm as [`n8n-nodes-unsiloed`](https://www.npmjs.com/package/n8n-nodes-unsiloed), so you can install it from n8n's own UI, with no terminal and no restart:

1. Open **Settings → Community Nodes → Install**.
2. Enter `n8n-nodes-unsiloed` and confirm.
3. Search for **Unsiloed** in the node panel.

Once installed, the node type is `n8n-nodes-unsiloed.unsiloed`.

This is for self-hosted n8n. n8n Cloud only allows community nodes that n8n has itself verified, and this node isn't verified yet, so Cloud users need a self-hosted instance for now.

If you'd rather install from the command line, add it to your n8n user folder and restart n8n:

```bash
mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes
npm install n8n-nodes-unsiloed
```

### Installing From Source Instead

You only need this if you're modifying the node. n8n loads anything in `~/.n8n/custom` on startup, and the compiled `dist/` is committed, so no build step is required. Note that a node loaded this way registers as `CUSTOM.unsiloed`, **not** `n8n-nodes-unsiloed.unsiloed` — so workflows exported from one install won't import into the other without editing the node's `type`.

For Docker:

```bash
git clone https://github.com/Unsiloed-AI/cookbook
docker cp cookbook/n8n-nodes-unsiloed/dist/. <your-n8n-container>:/home/node/.n8n/custom/
docker restart <your-n8n-container>
```

Or run the bundled installer from the node's folder:

```bash
cd cookbook/n8n-nodes-unsiloed && ./install.sh <your-n8n-container>
```

For a local n8n install:

```bash
git clone https://github.com/Unsiloed-AI/cookbook
mkdir -p ~/.n8n/custom
cp -r cookbook/n8n-nodes-unsiloed/dist/* ~/.n8n/custom/
# then restart n8n
```

## Setting Up the Credential

Create an **Unsiloed API** credential on the node:

- **API Key:** your Unsiloed key (get one at unsiloed.ai)
- **Base URL:** `https://prod.visionapi.unsiloed.ai` (the default)

Use the credential's **Test** button to confirm the key works before you run a workflow.

## Using the Node

Feed the node a binary file from an earlier step, such as **Read/Write Files from Disk**, an email attachment, an HTTP download, or a form upload. The default binary field is `data`. Then choose an operation depending on what you need back.

### Parse: Clean Markdown From Any Document

Parse needs no configuration beyond the binary field. Point it at any document and it returns the document as Markdown in the `markdown` field, with tables and headings preserved. This is the fastest way to try the node: install it, drop in a scan or a photo, and run.

Use Parse when you want the full document text, for example to feed a language model, index a knowledge base, or store a readable copy.

### Extract: Structured Fields You Define

Extract returns structured JSON, so you tell it which fields to pull with a JSON Schema. Set the **Schema (JSON)** field on the node. This example pulls an invoice's header fields and its line-item table:

```json
{
  "type": "object",
  "properties": {
    "vendor": { "type": "string", "description": "Company that issued the invoice" },
    "invoice_number": { "type": "string" },
    "total_due": { "type": "string" },
    "line_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "quantity": { "type": "string" },
          "unit_price": { "type": "string" },
          "amount": { "type": "string" }
        }
      }
    }
  }
}
```

Each property becomes a key in the output, holding a `value`, a nested `score` (with `grounding_score` and `extraction_score`), and a `citation` you can act on:

```json
{
  "total_due": {
    "value": "$11,557.22",
    "score": { "grounding_score": 0.998, "extraction_score": 0.998 },
    "citation": { "page": 1, "bbox": [470, 577, 533, 592], "page_width": 595.28, "page_height": 841.89 }
  }
}
```

So in later steps the value is `{{ $json.total_due.value }}` and its confidence is `{{ $json.total_due.score.grounding_score }}` — the scores are nested under `score`, not on the field itself. To run Extract on a different document, change the property names and descriptions to the fields you want. The schema above is generic enough to work on most invoices as-is; a receipt, a contract, or an ID needs its own field list.

Extraction runs on Unsiloed's `gamma` model (the recommended, most thorough tier), with citations enabled so every field comes back grounded.

Once you have the output, wire it into a spreadsheet, a database, a notification, or a language-model step. The [`examples/` folder in the repo](https://github.com/Unsiloed-AI/cookbook/tree/main/n8n-nodes-unsiloed/examples) has a ready-to-import Parse workflow with a sample document.

## Building From Source

The committed `dist/` is prebuilt, so most people don't need this. To rebuild after changing the source:

```bash
npm install
npm run build
```

## License

[MIT](./LICENSE)
