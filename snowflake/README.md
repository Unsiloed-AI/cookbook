# Unsiloed × Snowflake (SQL UDF)

Extract structured data from documents in a Snowflake stage using Unsiloed, entirely in SQL. A Python UDF reads each staged file and sends its bytes to Unsiloed's `/v2/extract` endpoint over an [External Access Integration](https://docs.snowflake.com/en/developer-guide/external-network-access/external-network-access-overview), returning typed fields with confidence scores and citations.

## Prerequisites

- A Snowflake role that can create a network rule, secret, external access integration, and function (`ACCOUNTADMIN` works).
- An Unsiloed API key — [sign up at unsiloed.ai](https://www.unsiloed.ai).
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
    "value": "$4.11",
    "score": { "grounding_score": 0.998, "extraction_score": 0.992 },
    "citation": { "page": 1, "bbox": [541, 142, 573, 155] }
  }
}
```

Because Unsiloed accepts an array-of-objects schema, repeating rows (line items, holdings, table rows) need no columnar rewrite. To process a whole stage in one query, join to `DIRECTORY(@stage)`.

See the [Snowflake integration guide](https://docs.unsiloed.ai/integrations/snowflake) for the full walkthrough, including the Cortex Agent option (running the UDF through Snowflake's Managed MCP server) for interactive, natural-language extraction.
