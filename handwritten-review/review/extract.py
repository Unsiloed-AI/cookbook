"""Send a prepared PDF to Unsiloed's /v2/extract endpoint and collect independent reads."""
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import os

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
BASE_URL = "https://prod.visionapi.unsiloed.ai"
MODEL = "gamma"  # the extraction model best suited to handwriting

SCHEMA = (Path(__file__).parent / "schema.json").read_text()


def headers() -> dict:
    key = os.environ.get("UNSILOED_API_KEY")
    if not key:
        raise RuntimeError("Set UNSILOED_API_KEY in your environment or in a .env file")
    return {"api-key": key}


def submit(pdf: Path) -> str:
    """Start an extraction job and return its ID."""
    with open(pdf, "rb") as f:
        response = requests.post(
            f"{BASE_URL}/v2/extract",
            headers=headers(),
            files={"pdf_file": ("document.pdf", f, "application/pdf")},
            data={"model": MODEL, "schema_data": SCHEMA, "enable_citations": "true"},
            timeout=180,
        )
    response.raise_for_status()
    return response.json()["job_id"]


def wait(job_id: str, timeout: int = 1500) -> dict:
    """Poll the job until it finishes and return the full response."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            job = requests.get(f"{BASE_URL}/extract/{job_id}",
                               headers=headers(), timeout=90).json()
        except (requests.RequestException, ValueError):
            time.sleep(5)  # a transient error or a non-JSON response: try again
            continue
        status = str(job.get("status")).lower()
        if status == "completed":
            return job
        if status in ("failed", "failure"):
            raise RuntimeError(f"Extraction job {job_id} failed: {job.get('error') or job}")
        time.sleep(5)
    raise TimeoutError(f"Extraction job {job_id} did not finish in {timeout} seconds")


def read_once(pdf: Path) -> dict:
    return wait(submit(pdf))


def read_twice(pdf: Path) -> list[dict]:
    """Run two independent extractions of the same PDF in parallel."""
    with ThreadPoolExecutor(2) as pool:
        return list(pool.map(read_once, [pdf, pdf]))
