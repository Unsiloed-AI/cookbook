-- Unsiloed x Snowflake: extract documents from a stage, entirely in SQL.
--
-- Creates a Python UDF that reads a staged file and sends its bytes to Unsiloed's
-- /v2/extract endpoint over an External Access Integration, returning typed fields
-- with confidence scores.
--
-- Prerequisites:
--   * A role that can create network rules, secrets, integrations, and functions
--     (ACCOUNTADMIN works).
--   * An Unsiloed API key: https://www.unsiloed.ai
--   * A stage holding your documents. For an internal stage, create it with
--     ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE') so SnowflakeFile can read it.
--
-- Set your database and schema, then run this file in a Snowflake worksheet.

USE DATABASE MY_DB;
USE SCHEMA MY_SCHEMA;

-- 1. Allow egress to the Unsiloed API host.
CREATE OR REPLACE NETWORK RULE unsiloed_api_network_rule
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = ('prod.visionapi.unsiloed.ai');

-- 2. Store your Unsiloed API key as a secret (it never appears in UDF source or query text).
CREATE OR REPLACE SECRET unsiloed_api_key
  TYPE = GENERIC_STRING
  SECRET_STRING = 'unsiloed_your_key_here';   -- replace with your key

-- 3. Bind the network rule and secret into an external access integration.
CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION unsiloed_access_integration
  ALLOWED_NETWORK_RULES = (unsiloed_api_network_rule)
  ALLOWED_AUTHENTICATION_SECRETS = (unsiloed_api_key)
  ENABLED = TRUE;

-- 4. The UDF: read a staged file, POST the bytes to /v2/extract, poll, return the result.
--    Pass file_name as well as the URL: /v2/extract picks its decoder from the file
--    extension, and a scoped file URL is encrypted, so the name can't be recovered from
--    it. You already have the name -- it's the second argument to BUILD_SCOPED_FILE_URL.
CREATE OR REPLACE FUNCTION unsiloed_extract(
    file_url STRING,
    file_name STRING,
    schema_json STRING,
    model STRING DEFAULT 'gamma')
  RETURNS VARIANT
  LANGUAGE PYTHON
  RUNTIME_VERSION = '3.12'
  HANDLER = 'run'
  EXTERNAL_ACCESS_INTEGRATIONS = (unsiloed_access_integration)
  PACKAGES = ('requests', 'snowflake-snowpark-python')
  SECRETS = ('cred' = unsiloed_api_key)
AS
$$
import json, time
import _snowflake, requests
from snowflake.snowpark.files import SnowflakeFile

BASE = "https://prod.visionapi.unsiloed.ai"
MAX_POLLS, POLL_SECONDS = 100, 3   # 5-minute ceiling; raise for long documents

def run(file_url, file_name, schema_json, model):
    api_key = _snowflake.get_generic_secret_string("cred")
    headers = {"api-key": api_key}

    # The extension decides how the file is decoded, so insist on having one.
    if not file_name or "." not in file_name:
        return {"_unsiloed_error": "file_name needs an extension, e.g. 'invoice.pdf'",
                "file_name": file_name}

    # Read the staged file through the caller-scoped URL.
    with SnowflakeFile.open(file_url, "rb") as f:
        data = f.read()

    # Submit the extraction job.
    resp = requests.post(
        f"{BASE}/v2/extract",
        headers=headers,
        files={"pdf_file": (file_name, data)},
        data={"schema_data": schema_json, "model": model or "gamma", "enable_citations": "true"},
        timeout=60,
    )
    resp.raise_for_status()
    job_id = resp.json().get("job_id")
    if not job_id:
        return {"_unsiloed_error": "no job_id returned", "response": resp.json()}

    # Poll until the job reaches a terminal state, riding out transient network errors.
    for _ in range(MAX_POLLS):
        time.sleep(POLL_SECONDS)
        try:
            status = requests.get(f"{BASE}/extract/{job_id}", headers=headers, timeout=30).json()
        except (requests.RequestException, ValueError):
            continue
        # "review" is terminal and carries a result: the job finished but was flagged
        # for human review, so treat it like "completed".
        if status.get("status") in ("completed", "review"):
            return status.get("result", {})
        if status.get("status") == "failed":
            return {"_unsiloed_error": "extraction failed", "job_id": job_id, "response": status}
    return {"_unsiloed_error": "timeout", "job_id": job_id}
$$;
