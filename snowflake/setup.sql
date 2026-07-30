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
--    file_name is optional: /v2/extract picks its decoder from the file extension, and a
--    scoped file URL is encrypted, so the name can't be recovered from it. The UDF sniffs
--    the format from the leading bytes; pass file_name to override (Office files, or any
--    format the sniffer doesn't know).
CREATE OR REPLACE FUNCTION unsiloed_extract(
    file_url STRING,
    schema_json STRING,
    file_name STRING DEFAULT '',
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
import io, json, time, zipfile
import _snowflake, requests
from snowflake.snowpark.files import SnowflakeFile

BASE = "https://prod.visionapi.unsiloed.ai"
MAX_POLLS, POLL_SECONDS = 100, 3   # 5-minute ceiling; raise for long documents

def sniff_name(data):
    """Name the upload after its real format, since /v2/extract keys off the extension."""
    if data[:4] == b"%PDF":
        return "document.pdf"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "document.png"
    if data[:3] == b"\xff\xd8\xff":
        return "document.jpg"
    if data[:4] in (b"II*\x00", b"MM\x00*"):
        return "document.tiff"
    if data[:2] == b"PK":                      # Office files are zip containers
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                names = z.namelist()
        except zipfile.BadZipFile:
            names = []
        for prefix, ext in (("word/", "docx"), ("xl/", "xlsx"), ("ppt/", "pptx")):
            if any(n.startswith(prefix) for n in names):
                return "document." + ext
    if data[:15].lstrip()[:1] == b"<":
        return "document.html"
    return "document.pdf"

def run(file_url, schema_json, file_name, model):
    api_key = _snowflake.get_generic_secret_string("cred")
    headers = {"api-key": api_key}

    # Read the staged file through the caller-scoped URL.
    with SnowflakeFile.open(file_url, "rb") as f:
        data = f.read()

    # An explicit file_name wins; otherwise name it after the leading bytes.
    name = file_name if file_name and "." in file_name else sniff_name(data)

    # Submit the extraction job.
    resp = requests.post(
        f"{BASE}/v2/extract",
        headers=headers,
        files={"pdf_file": (name, data)},
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
