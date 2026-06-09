"""Thin client for the Unsiloed AI document-processing API.

Every Unsiloed operation is an async job: you POST a file/url and get a
``job_id`` back immediately, then poll a matching GET endpoint until the job
reaches a terminal status. This module hides that submit→poll dance behind a
handful of blocking helpers.

One gotcha worth remembering: the terminal status token is *not* consistent
across operations. Parse uses capitalized ``Succeeded``/``Failed`` while
extract, classify and split use lowercase ``completed``/``failed``. The poll
loop is parametrised on the success/failure tokens so each call matches.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any, Callable

import requests

BASE_URL = "https://prod.visionapi.unsiloed.ai"


class UnsiloedError(RuntimeError):
    """Raised when a job fails or the API returns an error response."""


@dataclass
class PollResult:
    status: str
    payload: dict[str, Any]


class UnsiloedClient:
    """Blocking client. Submit a job, then poll until it finishes."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = BASE_URL,
        poll_interval: float = 5.0,
        max_attempts: int = 60,
    ) -> None:
        self.api_key = api_key or os.environ.get("UNSILOED_API_KEY")
        if not self.api_key:
            raise UnsiloedError(
                "No API key. Set UNSILOED_API_KEY or pass api_key=. "
                "Get one at https://www.unsiloed.ai"
            )
        self.base_url = base_url.rstrip("/")
        self.poll_interval = poll_interval
        self.max_attempts = max_attempts

    # -- low level ---------------------------------------------------------

    @property
    def _headers(self) -> dict[str, str]:
        return {"api-key": self.api_key}

    def _open_file(self, path: str) -> tuple[str, Any, str]:
        path = os.path.expanduser(os.path.expandvars(path))
        if not os.path.isfile(path):
            raise UnsiloedError(f"File not found: {path}")
        name = os.path.basename(path)
        return (name, open(path, "rb"), "application/pdf")

    def _submit(
        self,
        endpoint: str,
        *,
        file_field: str,
        file_path: str | None,
        url: str | None,
        data: dict[str, str],
    ) -> str:
        """POST a job and return its job_id."""
        if bool(file_path) == bool(url):
            raise UnsiloedError("Provide exactly one of file_path or url.")

        kwargs: dict[str, Any] = {"headers": self._headers, "data": data}
        if file_path:
            kwargs["files"] = {file_field: self._open_file(file_path)}
        else:
            data[_url_field(endpoint)] = url  # type: ignore[index]

        resp = requests.post(f"{self.base_url}{endpoint}", **kwargs)
        if not resp.ok:
            raise UnsiloedError(f"{endpoint} -> {resp.status_code}: {resp.text}")
        body = resp.json()
        job_id = body.get("job_id")
        if not job_id:
            raise UnsiloedError(f"No job_id in response: {body}")
        return job_id

    def _poll(
        self,
        endpoint: str,
        job_id: str,
        *,
        success: str,
        failure: str,
        on_tick: Callable[[int, str], None] | None = None,
        include_url: bool = False,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{endpoint}/{job_id}"
        params = {"include_url": "true"} if include_url else None
        for attempt in range(1, self.max_attempts + 1):
            resp = requests.get(url, headers=self._headers, params=params)
            if not resp.ok:
                raise UnsiloedError(
                    f"poll {endpoint}/{job_id} -> {resp.status_code}: {resp.text}"
                )
            body = resp.json()
            status = body.get("status", "")
            if on_tick:
                on_tick(attempt, status)
            if status == success:
                return body
            if status == failure:
                raise UnsiloedError(body.get("message", f"{endpoint} job failed"))
            time.sleep(self.poll_interval)
        raise UnsiloedError(
            f"Timed out after {self.max_attempts} polls ({endpoint}/{job_id})"
        )

    # -- operations --------------------------------------------------------

    def parse(
        self,
        *,
        file_path: str | None = None,
        url: str | None = None,
        options: dict[str, str] | None = None,
        on_tick: Callable[[int, str], None] | None = None,
        include_url: bool = False,
    ) -> dict[str, Any]:
        job_id = self._submit(
            "/parse",
            file_field="file",
            file_path=file_path,
            url=url,
            data=dict(options or {}),
        )
        return self._poll(
            "/parse",
            job_id,
            success="Succeeded",
            failure="Failed",
            on_tick=on_tick,
            include_url=include_url,
        )

    def extract(
        self,
        *,
        schema: dict[str, Any],
        file_path: str | None = None,
        url: str | None = None,
        model: str = "gamma",
        enable_citations: bool = True,
        on_tick: Callable[[int, str], None] | None = None,
    ) -> dict[str, Any]:
        data = {
            "schema_data": json.dumps(schema),
            "model": model,
            "enable_citations": "true" if enable_citations else "false",
        }
        job_id = self._submit(
            "/v2/extract",
            file_field="pdf_file",
            file_path=file_path,
            url=url,
            data=data,
        )
        return self._poll(
            "/extract", job_id, success="completed", failure="failed", on_tick=on_tick
        )

    def classify(
        self,
        *,
        categories: list[dict[str, str]],
        file_path: str | None = None,
        url: str | None = None,
        on_tick: Callable[[int, str], None] | None = None,
    ) -> dict[str, Any]:
        data = {"categories": json.dumps(categories)}
        job_id = self._submit(
            "/classify",
            file_field="pdf_file",
            file_path=file_path,
            url=url,
            data=data,
        )
        return self._poll(
            "/classify", job_id, success="completed", failure="failed", on_tick=on_tick
        )

    def split(
        self,
        *,
        categories: list[dict[str, str]],
        file_path: str | None = None,
        url: str | None = None,
        on_tick: Callable[[int, str], None] | None = None,
    ) -> dict[str, Any]:
        data = {"categories": json.dumps(categories)}
        job_id = self._submit(
            "/splitter",
            file_field="file",
            file_path=file_path,
            url=url,
            data=data,
        )
        return self._poll(
            "/splitter", job_id, success="completed", failure="failed", on_tick=on_tick
        )

    def usage(self) -> dict[str, Any]:
        resp = requests.get(f"{self.base_url}/org/get_usage", headers=self._headers)
        if not resp.ok:
            raise UnsiloedError(f"usage -> {resp.status_code}: {resp.text}")
        return resp.json()


def _url_field(endpoint: str) -> str:
    """The form field name used to pass a remote URL, per endpoint."""
    return {
        "/parse": "url",
        "/v2/extract": "file_url",
        "/classify": "file_url",
        "/splitter": "file_url",
    }.get(endpoint, "url")