"""Unsiloed REST client — agentic OCR / document parsing.

The eyes of the pipeline: turn a PDF into clean text. Two entry points:

  • parse_url(url)   — the documented tool shape: Unsiloed fetches a *public* URL.
  • parse_upload(p)  — presigned upload of the file's bytes; no public host needed.

Auth is a single `api-key` header (no OAuth). Jobs are async: submit returns a
job_id, then we poll until the parse succeeds.
"""

import time
from pathlib import Path

import requests

BASE = "https://prod.visionapi.unsiloed.ai"
_POLL_SECONDS = 6


class Unsiloed:
    def __init__(self, api_key: str):
        self._headers = {"api-key": api_key}

    def parse_url(self, url: str) -> str:
        """Parse a document at a publicly accessible URL → Markdown text."""
        resp = requests.post(f"{BASE}/parse", headers=self._headers, data={
            "url": url,
            "segmentation_method": "smart_layout_detection",
            "ocr_mode": "auto_ocr",
        })
        resp.raise_for_status()
        return self._poll(resp.json()["job_id"])

    def parse_upload(self, path: Path) -> str:
        """Upload the file's bytes via the presigned endpoint → Markdown text."""
        slot = requests.post(f"{BASE}/v2/parse/upload", headers=self._headers,
                             json={"file_name": path.name}).json()
        with open(path, "rb") as f:
            requests.put(slot["upload_url"], headers=slot["upload_headers"], data=f).raise_for_status()
        return self._poll(slot["job_id"])

    def _poll(self, job_id: str) -> str:
        while True:
            res = requests.get(f"{BASE}/parse/{job_id}", headers=self._headers).json()
            status = res.get("status")
            if status == "Succeeded":
                chunks = res.get("content") or res.get("chunks") or []
                parts = [(c.get("embed") or c.get("markdown") or c.get("text") or "")
                         for c in chunks]
                return "\n\n".join(p for p in parts if p).strip()
            if status == "Failed":
                raise RuntimeError(f"Unsiloed parse failed: {res.get('message')}")
            time.sleep(_POLL_SECONDS)