"""Thin client for the Unsiloed v2 document API.

Implements exactly the verified v2 flow documented in the repo's AGENTS.md:

* Parse via presigned upload:
    POST /v2/parse/upload  {file_name}          -> {job_id, upload_url, upload_headers}
    PUT  <upload_url>      <raw bytes>          (exact headers Unsiloed signed)
    GET  /parse/{job_id}   until status == "Succeeded"   (capital S; fail = "Failed")
  Result carries ``chunks[]``; each chunk has an ``embed`` Markdown string and a
  page number. Concatenate the chunks for the full document Markdown.

* Extract typed fields:
    POST /v2/extract  (multipart: pdf_file, schema_data, model, enable_citations)
    GET  /extract/{job_id}  until status == "completed"  (lowercase; fail = "failed")
  Result ``result.{field}`` == {value, score, page_no, bboxes}.

The one deviation from a naive read of AGENTS.md: chunk objects are not
guaranteed to spell the page field the same way across documents, so
``iter_chunks`` normalises a few plausible keys.
"""

from __future__ import annotations

import mimetypes
import os
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple
from urllib.parse import urlparse

import requests

from . import config


class UnsiloedError(RuntimeError):
    """Raised for any non-recoverable failure talking to Unsiloed."""


@dataclass
class Chunk:
    ordinal: int
    text: str
    page_no: Optional[int] = None


@dataclass
class ParseResult:
    job_id: str
    chunks: List[Chunk] = field(default_factory=list)
    raw: Dict[str, Any] = field(default_factory=dict)
    page_count: int = 0

    @property
    def markdown(self) -> str:
        return "\n\n".join(c.text for c in self.chunks if c.text).strip()


def _headers() -> Dict[str, str]:
    key = config.unsiloed_api_key()
    if not key:
        raise UnsiloedError(
            "UNSILOED_API_KEY is not set. Add it to your environment or "
            "$HERMES_HOME/.env (or the project ./.env)."
        )
    return {"api-key": key}


# Key names Unsiloed (and adjacent doc APIs) have used for the same concept.
# We try several and fall back rather than assume one fixed schema, because the
# response shape is not a contract we control and has drifted across versions.
_TEXT_KEYS = ("embed", "markdown", "md", "text", "content", "html")
_PAGE_KEYS = ("page_no", "page_number", "page", "pageNo", "page_num", "page_index")


def _first_int(obj: Dict[str, Any], keys) -> Optional[int]:
    for k in keys:
        v = obj.get(k)
        if isinstance(v, bool):
            continue
        if isinstance(v, int):
            return v
        if isinstance(v, float) and v.is_integer():
            return int(v)
        if isinstance(v, str) and v.strip().isdigit():
            return int(v.strip())
    return None


def _segments(obj: Any) -> List[dict]:
    if not isinstance(obj, dict):
        return []
    segs = obj.get("segments")
    return [s for s in segs if isinstance(s, dict)] if isinstance(segs, list) else []


def _chunk_text(obj: Any) -> str:
    """Best text for a chunk: a chunk-level field, else joined segment text."""
    if isinstance(obj, str):
        return obj
    if not isinstance(obj, dict):
        return ""
    for k in _TEXT_KEYS:
        v = obj.get(k)
        if isinstance(v, str) and v.strip():
            return v
    # No chunk-level text — stitch the segments together.
    parts: List[str] = []
    for seg in _segments(obj):
        for k in _TEXT_KEYS:
            v = seg.get(k)
            if isinstance(v, str) and v.strip():
                parts.append(v)
                break
    return "\n\n".join(parts)


def _chunk_page(obj: Any) -> Optional[int]:
    """Page a chunk starts on: a chunk-level field, else the min segment page."""
    if not isinstance(obj, dict):
        return None
    direct = _first_int(obj, _PAGE_KEYS)
    if direct is not None:
        return direct
    seg_pages = [
        p for p in (_first_int(seg, _PAGE_KEYS) for seg in _segments(obj))
        if p is not None
    ]
    return min(seg_pages) if seg_pages else None


def iter_chunks(raw: Dict[str, Any]) -> Iterator[Chunk]:
    chunks = raw.get("chunks")
    if not isinstance(chunks, list):
        # Some responses nest under "result".
        result = raw.get("result")
        if isinstance(result, dict):
            chunks = result.get("chunks")
    if not isinstance(chunks, list):
        return
    for i, obj in enumerate(chunks):
        text = _chunk_text(obj)
        if not text.strip():
            continue
        yield Chunk(ordinal=i, text=text, page_no=_chunk_page(obj))


def _resolve_page_count(raw: Dict[str, Any], chunks: List[Chunk]) -> int:
    """Prefer a top-level count; else derive from the highest chunk page."""
    for k in ("page_count", "pages", "num_pages", "total_pages"):
        v = raw.get(k)
        if isinstance(v, int) and v > 0:
            return v
        if isinstance(v, str) and v.strip().isdigit():
            return int(v.strip())
    pages = [c.page_no for c in chunks if c.page_no is not None]
    return max(pages) if pages else 0


class UnsiloedClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        poll_interval: float = 5.0,
        timeout: float = 600.0,
    ):
        self.base_url = (base_url or config.unsiloed_base_url()).rstrip("/")
        self.poll_interval = poll_interval
        self.timeout = timeout
        self._session = requests.Session()

    # -- parse ---------------------------------------------------------------

    def parse(self, source: str) -> ParseResult:
        """Parse a local path or an http(s) URL into Markdown chunks."""
        path, cleanup = _materialize(source)
        try:
            return self._parse_path(path)
        finally:
            if cleanup:
                try:
                    os.unlink(path)
                except OSError:
                    pass

    def _parse_path(self, path: str) -> ParseResult:
        p = Path(path)
        if not p.is_file():
            raise UnsiloedError(f"File not found: {path}")

        # 1. presigned upload slot
        r = self._session.post(
            f"{self.base_url}/v2/parse/upload",
            headers=_headers(),
            json={"file_name": p.name},
            timeout=60,
        )
        _raise_for_status(r, "POST /v2/parse/upload")
        slot = r.json()
        job_id = slot.get("job_id")
        upload_url = slot.get("upload_url")
        upload_headers = slot.get("upload_headers") or {}
        if not job_id or not upload_url:
            raise UnsiloedError(f"Malformed upload slot response: {slot!r}")

        # 2. PUT the raw bytes with exactly the headers Unsiloed signed
        with open(p, "rb") as f:
            put = self._session.put(
                upload_url, headers=upload_headers, data=f, timeout=300
            )
        if put.status_code >= 400:
            raise UnsiloedError(
                f"Presigned upload PUT failed ({put.status_code}): {put.text[:400]}"
            )

        # 3. poll GET /parse/{job_id} until Succeeded
        raw = self._poll(
            f"{self.base_url}/parse/{job_id}",
            success={"succeeded"},
            failure={"failed"},
            what="parse",
        )
        chunks = list(iter_chunks(raw))
        if not chunks:
            # Fall back to a top-level content/markdown field if present.
            content = raw.get("content") or raw.get("markdown")
            if isinstance(content, str) and content.strip():
                chunks = [Chunk(ordinal=0, text=content)]
        return ParseResult(
            job_id=job_id,
            chunks=chunks,
            raw=raw,
            page_count=_resolve_page_count(raw, chunks),
        )

    # -- extract -------------------------------------------------------------

    def extract(
        self,
        source: str,
        schema: Dict[str, Any],
        model: str = "gamma",
        enable_citations: bool = True,
    ) -> Dict[str, Any]:
        """Extract typed fields. Returns the ``result`` mapping of the job."""
        import json as _json

        path, cleanup = _materialize(source)
        try:
            p = Path(path)
            with open(p, "rb") as f:
                r = self._session.post(
                    f"{self.base_url}/v2/extract",
                    headers=_headers(),
                    files={"pdf_file": (p.name, f, _content_type(p))},
                    data={
                        "schema_data": _json.dumps(schema),
                        "model": model,
                        "enable_citations": "true" if enable_citations else "false",
                    },
                    timeout=120,
                )
            _raise_for_status(r, "POST /v2/extract")
            job_id = r.json().get("job_id")
            if not job_id:
                raise UnsiloedError(f"No job_id from /v2/extract: {r.text[:400]}")
            raw = self._poll(
                f"{self.base_url}/extract/{job_id}",
                success={"completed"},
                failure={"failed"},
                what="extract",
            )
            return raw.get("result", raw)
        finally:
            if cleanup:
                try:
                    os.unlink(path)
                except OSError:
                    pass

    # -- polling -------------------------------------------------------------

    def _poll(
        self,
        url: str,
        success: set,
        failure: set,
        what: str,
    ) -> Dict[str, Any]:
        deadline = time.monotonic() + self.timeout
        while True:
            r = self._session.get(url, headers=_headers(), timeout=60)
            _raise_for_status(r, f"GET {what}")
            body = r.json()
            status = str(body.get("status", "")).strip().lower()
            if status in success:
                return body
            if status in failure:
                raise UnsiloedError(
                    f"Unsiloed {what} job failed: {body.get('message') or body}"
                )
            if time.monotonic() > deadline:
                raise UnsiloedError(
                    f"Unsiloed {what} job timed out after {self.timeout:.0f}s "
                    f"(last status: {status or 'unknown'})"
                )
            time.sleep(self.poll_interval)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def _content_type(p: Path) -> str:
    ctype, _ = mimetypes.guess_type(str(p))
    return ctype or "application/octet-stream"


def _raise_for_status(r: requests.Response, what: str) -> None:
    if r.status_code >= 400:
        raise UnsiloedError(f"{what} -> HTTP {r.status_code}: {r.text[:400]}")


def _materialize(source: str) -> Tuple[str, bool]:
    """Return (local_path, needs_cleanup). Downloads http(s) URLs to a tempfile."""
    parsed = urlparse(source)
    if parsed.scheme in ("http", "https"):
        r = requests.get(source, timeout=120, stream=True)
        if r.status_code >= 400:
            raise UnsiloedError(f"Failed to download {source}: HTTP {r.status_code}")
        suffix = Path(parsed.path).suffix or ".pdf"
        fd, tmp = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, "wb") as out:
            for block in r.iter_content(chunk_size=1 << 16):
                if block:
                    out.write(block)
        return tmp, True
    return str(Path(source).expanduser()), False
