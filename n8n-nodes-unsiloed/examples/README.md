# Example Workflow

A ready-to-import workflow for trying the Unsiloed node, with a bundled `sample-invoice.pdf`. The sample looks perfect on screen, but its text layer is garbled, which is exactly where the node earns its keep.

`invoice-to-markdown.json` reads the invoice, runs it through the Unsiloed node's **Parse** operation, and returns clean Markdown. Parse needs no schema, so this works on any document. For structured extraction with a schema, see the [main README](../README.md).

## Trying It

First, install the node (see the main README) and create your **Unsiloed API** credential.

Next, put the sample invoice where n8n can read it. n8n restricts file reads to `~/.n8n-files` by default, so copy it there. If you run n8n in Docker:

```bash
docker cp sample-invoice.pdf <your-n8n-container>:/home/node/.n8n-files/invoice.pdf
```

If you run n8n locally:

```bash
mkdir -p ~/.n8n-files && cp sample-invoice.pdf ~/.n8n-files/invoice.pdf
```

Then import `invoice-to-markdown.json` in n8n (Workflows → ⋯ → Import from File), open the **Unsiloed** node, select your credential, and run the workflow. You should get the invoice back as clean Markdown.

To try it on your own document, point the "Read invoice.pdf" node at a different file. A scan or a phone photo shows the difference best.
