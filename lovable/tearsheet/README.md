# Tearsheet — fund factsheet → live dashboard

Drop a dense fund factsheet PDF and get a live, interactive dashboard — KPI cards, charts,
and a sortable holdings table — where **every number traces back to its exact spot on the
source page**. Extraction (with bounding-box citations and confidence scores) is powered by
the [Unsiloed AI](https://www.unsiloed.ai) `/v2/extract` API.

The app was generated with [Lovable](https://lovable.dev) (TanStack Start + Vite + React). The
Unsiloed API key stays **server-side** — the browser never sees it; a server function calls
Unsiloed and returns the result.

## Run it locally

```bash
# 1. install deps
npm install        # or: bun install

# 2. add your Unsiloed API key (the .env file is gitignored — it won't be committed)
echo 'UNSILOED_API_KEY=your-unsiloed-key' > .env
#   ...or instead: export UNSILOED_API_KEY="your-unsiloed-key"

# 3. start the dev server
npm run dev        # http://localhost:8080
```

Then open the app, drop a fund factsheet PDF, and explore the dashboard. Toggle
**"Trace to source"** and click any value to see it highlighted on the original page.

Get an Unsiloed API key at [unsiloed.ai](https://www.unsiloed.ai/book-demo). Without the key
the UI still loads, but extraction calls return `UNSILOED_API_KEY not configured`.

## How extraction works

`src/lib/extract.functions.ts` holds the two server functions:
- `submitExtract` — POSTs the PDF to `https://prod.visionapi.unsiloed.ai/v2/extract` with
  `enable_citations=true` and `model=gamma`, returns a `job_id`.
- `pollExtract` — polls `https://prod.visionapi.unsiloed.ai/extract/{job_id}` until complete.

The key is read from `process.env.UNSILOED_API_KEY` on the server only. Nothing is stored or
logged — the uploaded file is sent to Unsiloed and the result is returned to the browser.

See the [Unsiloed extraction API docs](https://www.unsiloed.ai/docs/api-reference/extraction/extract-data) for the request/response shape.
