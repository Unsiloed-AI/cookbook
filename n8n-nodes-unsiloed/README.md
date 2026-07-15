# n8n-nodes-unsiloed

An [n8n](https://n8n.io) community node for [Unsiloed AI](https://unsiloed.ai). It reads documents (PDFs, scans, photos, images) and returns clean Markdown or structured JSON inside your workflows.

n8n has no built-in OCR. Its **Extract from File** node reads a PDF's embedded text layer, not the page, so a scan, a phone photo, or any PDF with a broken text layer comes back as confident nonsense and nothing warns you. This node OCRs the rendered page instead, so it reads what a person sees.

## Why n8n's Built-In Extraction Falls Short

The built-in extractor trusts the text layer. That layer is fine for clean born-digital PDFs, but scans and many exports either have no text layer or a broken one, and the extractor returns garbage without failing. Same invoice, same workflow, two extractors:

```text
n8n Extract from PDF →  "OFCGOET  Ofcgoet Fg. IC-9762 ...  Zgzqsrxt $33,002.99"
Unsiloed             →  "INVOICE  Invoice No. HV-2087 ...  Total due  $11,557.22"
```

Both node operations force OCR on the rendered pixels, so a bad text layer can't poison the result.

## What the Node Does

The node has two operations:

- **Parse:** OCR the document and return layout-aware Markdown (headings, tables, paragraphs). No schema required.
- **Extract:** pull named fields into JSON using a schema you define (invoice number, totals, dates, line items). Each value comes back with per-field confidence scores.

## Installing on Self-Hosted n8n

The node ships via GitHub and installs into n8n's custom extensions folder (`~/.n8n/custom`). There's no build step, because the compiled `dist/` is committed. Once loaded, the node type is `CUSTOM.unsiloed`.

n8n Cloud can't load nodes from disk; it only supports npm-published community nodes, so this install is for self-hosted n8n (Docker or a local install).

If you run n8n in Docker, clone the cookbook, copy the compiled node into the container, and restart it:

```bash
git clone https://github.com/Unsiloed-AI/cookbook
docker cp cookbook/n8n-nodes-unsiloed/dist/. <your-n8n-container>:/home/node/.n8n/custom/
docker restart <your-n8n-container>
```

Or run the bundled installer from the node's folder:

```bash
cd cookbook/n8n-nodes-unsiloed && ./install.sh <your-n8n-container>
```

If you run n8n locally (npm or global install), copy the compiled node into your user folder and restart n8n:

```bash
git clone https://github.com/Unsiloed-AI/cookbook
mkdir -p ~/.n8n/custom
cp -r cookbook/n8n-nodes-unsiloed/dist/* ~/.n8n/custom/
```

After the restart, search for **Unsiloed** in the node panel.

## Setting Up the Credential

Create an **Unsiloed API** credential on the node:

- **API Key:** your Unsiloed key (get one at unsiloed.ai)
- **Base URL:** `https://prod.visionapi.unsiloed.ai` (the default)

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

Each property becomes a key in the output, with its `value` and a per-field `grounding_score` and `extraction_score` you can act on. To run Extract on a different document, change the property names and descriptions to the fields you want. The schema above is generic enough to work on most invoices as-is; a receipt, a contract, or an ID needs its own field list.

The **Model** option defaults to `gamma`, which is the most reliable on scans and photos.

Once you have the output, wire it into a spreadsheet, a database, a notification, or a language-model step. The [`examples/`](./examples) folder has ready-to-import workflows, including a Parse before-and-after against the built-in extractor.

## Building From Source

The committed `dist/` is prebuilt, so most people don't need this. To rebuild after changing the source:

```bash
npm install
npm run build
```

## License

[MIT](./LICENSE)
