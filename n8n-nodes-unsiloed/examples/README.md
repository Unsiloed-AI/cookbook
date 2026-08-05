# Example Workflow

A ready-to-import workflow for trying the Unsiloed node, with a bundled `sample-invoice.pdf`. The sample looks perfect on screen, but its text layer is garbled, which is exactly where the node earns its keep.

`invoice-to-markdown.json` reads the invoice, runs it through the Unsiloed node's **Parse** operation, and returns clean Markdown. Parse needs no schema, so this works on any document. For structured extraction with a schema, see the [main README](../README.md).

## Trying It

First, install the node (see the main README) and create your **Unsiloed API** credential.

Next, put the sample invoice where n8n can read it. n8n restricts file reads to `~/.n8n-files` by default, so copy it there. If you run n8n in Docker:

```bash
docker exec <your-n8n-container> mkdir -p /home/node/.n8n-files
docker cp sample-invoice.pdf <your-n8n-container>:/home/node/.n8n-files/invoice.pdf
```

(The `mkdir` matters: `.n8n-files` doesn't exist until n8n creates it, and `docker cp` fails if the directory is missing.)

If you run n8n locally:

```bash
mkdir -p ~/.n8n-files && cp sample-invoice.pdf ~/.n8n-files/invoice.pdf
```

Then import `invoice-to-markdown.json` in n8n (Workflows → ⋯ → Import from File), open the **Unsiloed** node, select your credential, and run the workflow. You should get the invoice back as clean Markdown.

Two things to check if the import doesn't run:

- **File path.** The workflow ships with the Docker path (`/home/node/.n8n-files/invoice.pdf`). On a local n8n, open the "Read invoice.pdf" node and change it to your own `~/.n8n-files/invoice.pdf` (expanded, e.g. `/Users/you/.n8n-files/invoice.pdf`).
- **Node type.** The workflow references `n8n-nodes-unsiloed.unsiloed`, which is how the node registers when installed from npm. If you installed from source into `~/.n8n/custom` instead, the node registers as `CUSTOM.unsiloed` and n8n will show "Unrecognized node type" — either install from npm or edit the node's `type` in the JSON.

To try it on your own document, point the "Read invoice.pdf" node at a different file. A scan or a phone photo shows the difference best.
