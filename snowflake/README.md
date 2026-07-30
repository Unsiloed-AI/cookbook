# Unsiloed × Snowflake (SQL UDF)

Extract structured data from documents in a Snowflake stage using Unsiloed, entirely in SQL. A Python UDF reads each staged file and sends its bytes to Unsiloed's `/v2/extract` endpoint over an [External Access Integration](https://docs.snowflake.com/en/developer-guide/external-network-access/external-network-access-overview), returning typed fields with confidence scores and citations.

## Prerequisites

- A Snowflake role that can create a network rule, secret, external access integration, and function (`ACCOUNTADMIN` works).
- An Unsiloed API key. [Sign up at unsiloed.ai](https://www.unsiloed.ai).
- A stage holding your documents. For an internal stage, create it with `ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')` so `SnowflakeFile` can read it.

## Setup

1. Open `setup.sql`, set your database and schema, and paste your Unsiloed API key into the secret.
2. Run it in a Snowflake worksheet. It creates the network rule, secret, external access integration, and the `unsiloed_extract` function.

## Use it

Call the function with a scoped URL for a staged file and a JSON Schema describing the fields you want:

```sql
SELECT unsiloed_extract(
    BUILD_SCOPED_FILE_URL(@MY_DB.MY_SCHEMA.PDF_STAGE, 'invoice.pdf'),
    '{
       "type": "object",
       "properties": {
         "vendor": { "type": "string" },
         "invoice_number": { "type": "string" },
         "total": { "type": "string" }
       }
     }'
) AS result;
```

Each field comes back as an object with a value, a confidence score, and a citation:

```json
{
  "total": {
    "value": "4.11",
    "score": { "grounding_score": 0.998, "extraction_score": 0.989 },
    "citation": { "page": 1, "bbox": [548, 142, 573, 156], "page_width": 612.0, "page_height": 792.0 }
  }
}
```

`bbox` is `[x0, y0, x1, y1]` in points, measured against the `page_width` and `page_height` in the same object, so you can scale it to whatever you render the page at.

Because Unsiloed accepts an array-of-objects schema, repeating rows (line items, holdings, table rows) need no columnar rewrite. To process a whole stage in one query, join to `DIRECTORY(@stage)`.

## File types

`/v2/extract` chooses its decoder from the file extension, and a scoped file URL is encrypted, so the UDF can't read the name off the URL. It identifies PDFs, PNG, JPEG and TIFF images, Office files, and HTML from the leading bytes instead. If you have a format it doesn't recognise, pass the name yourself as the third argument:

```sql
SELECT unsiloed_extract(
    BUILD_SCOPED_FILE_URL(@MY_DB.MY_SCHEMA.DOC_STAGE, 'contract.docx'),
    '{ "type": "object", "properties": { "counterparty": { "type": "string" } } }',
    'contract.docx'
) AS result;
```

Joining to `DIRECTORY(@stage)` gives you `relative_path` for exactly this.

## Notes

- The UDF polls for up to five minutes (`MAX_POLLS` × `POLL_SECONDS` in `setup.sql`). Long multi-page documents can need more, so raise `MAX_POLLS` if you see `{"_unsiloed_error": "timeout"}`.
- The first call after creating the external access integration sometimes times out while the Python environment cold-starts. Run it again.
- `unsiloed_extract` has optional arguments, so Snowflake won't let you create another function called `unsiloed_extract` with a different number of arguments. Drop the old one first if you have one.

See the [Snowflake integration guide](https://docs.unsiloed.ai/integrations/snowflake) for the full walkthrough, including the Cortex Agent option (running the UDF through Snowflake's Managed MCP server) for interactive, natural-language extraction.
