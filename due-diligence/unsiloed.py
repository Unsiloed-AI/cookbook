"""Unsiloed client for the due-diligence agent — Parse (read) and Extract (fields).

Parse turns a document slice into clean Markdown (Unsiloed's strength: dense tables,
multi-column legal text, scanned pages). That text is what the LLM reasons over.
"""

import os
import time
import json
import pathlib

import requests

ROOT = pathlib.Path(__file__).resolve().parent.parent
API_BASE = "https://prod.visionapi.unsiloed.ai"


HERE = pathlib.Path(__file__).resolve().parent


def load_env() -> None:
    # Look for .env in the project root and in this package dir (so a standalone copy works).
    for env_path in (ROOT / ".env", HERE / ".env"):
        if not env_path.exists():
            continue
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _api_key() -> str:
    load_env()
    key = os.environ.get("UNSILOED_API_KEY")
    if not key:
        raise RuntimeError("UNSILOED_API_KEY not set in environment / .env")
    return key


def parse(file_path: str, max_attempts: int = 2) -> str:
    """Parse a document into Markdown text (concatenated layout chunks)."""
    key = _api_key()
    path = pathlib.Path(file_path)
    last_err = None
    for _ in range(max_attempts):
        with path.open("rb") as fh:
            submit = requests.post(
                f"{API_BASE}/parse",
                headers={"api-key": key},
                files={"file": (path.name, fh, "application/pdf")},
                timeout=180,
            ).json()
        job = submit.get("job_id")
        if not job:
            raise RuntimeError(f"no job_id from Unsiloed parse: {submit}")
        for _ in range(80):  # 80 x 3s = 240s
            body = requests.get(f"{API_BASE}/parse/{job}", headers={"api-key": key}, timeout=30).json()
            status = body.get("status")
            if status == "Succeeded":
                chunks = body.get("chunks") or []
                return "\n\n".join((c.get("embed") or "") for c in chunks).strip()
            if status == "Failed":
                last_err = body.get("message")
                break
            time.sleep(3)
        else:
            raise RuntimeError("Unsiloed parse timed out")
    raise RuntimeError(f"Unsiloed parse failed: {last_err}")


def extract(file_path: str, schema: dict, max_attempts: int = 3) -> dict:
    """Extract typed fields ({value, score}) from a document."""
    key = _api_key()
    path = pathlib.Path(file_path)
    schema_json = json.dumps(schema)
    last_err = None
    for _ in range(max_attempts):
        with path.open("rb") as fh:
            submit = requests.post(
                f"{API_BASE}/v2/extract",
                headers={"api-key": key},
                files={"pdf_file": (path.name, fh, "application/pdf")},
                data={"schema_data": schema_json},
                timeout=180,
            ).json()
        job = submit.get("job_id")
        if not job:
            raise RuntimeError(f"no job_id from Unsiloed extract: {submit}")
        for _ in range(60):
            body = requests.get(f"{API_BASE}/extract/{job}", headers={"api-key": key}, timeout=30).json()
            status = body.get("status")
            if status == "completed":
                return body.get("result") or {}
            if status == "failed":
                last_err = body.get("error") or body.get("message")
                break
            time.sleep(5)
        else:
            raise RuntimeError("Unsiloed extract timed out")
    raise RuntimeError(f"Unsiloed extract failed: {last_err}")