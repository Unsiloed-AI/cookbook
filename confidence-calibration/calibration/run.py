"""Extract every document in the corpus and cache the raw responses.

This is the only module that spends API quota, and it is written so that it spends it once.
Each response is written to `results/` under a key derived from the document and tier, and a
key already on disk is never requested again. A run that dies halfway resumes where it stopped,
and a reviewer who clones the repo reproduces every figure without an Unsiloed key at all.

`enable_citations=true` and `model=gamma` are fixed rather than configurable, for the reason
given in the Gemini recipe: without citations the grounding pass does not run and every
`grounding_score` comes back zero, which would hollow out the measurement entirely.

Run: python -m calibration.run                  (from confidence-calibration/)
     python -m calibration.run --pilot          three documents, all four tiers
     python -m calibration.run --only cord      just the real receipts
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from corpus.cord import RECEIPT_SCHEMA  # noqa: E402
from corpus.degrade import TIERS  # noqa: E402
from corpus.schemas import SCHEMAS  # noqa: E402

load_dotenv()

BASE_URL = "https://prod.visionapi.unsiloed.ai"
HEADERS = {"api-key": os.getenv("UNSILOED_API_KEY")}

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "documents"
DEGRADED_DIR = DOCS_DIR / "degraded"
CORD_DIR = DOCS_DIR / "cord"
RESULTS_DIR = ROOT / "results" / "extractions"

POLL_SECONDS = 3
POLL_TIMEOUT = 300

# Three documents, one of each generated type, for the pilot. Enough to see whether the scores
# spread across tiers before committing the whole corpus to a run.
PILOT_STEMS = ("invoice_01", "statement_01", "id_card_01")


def submit(path: Path, schema: dict) -> str:
    """Start an extraction job and return its id."""
    with open(path, "rb") as handle:
        response = requests.post(
            f"{BASE_URL}/v2/extract",
            headers=HEADERS,
            files={"pdf_file": (path.name, handle)},
            data={
                "schema_data": json.dumps(schema),
                "model": "gamma",
                "enable_citations": "true",
            },
            timeout=180,
        )
    response.raise_for_status()
    payload = response.json()
    job_id = payload.get("job_id") or payload.get("id")
    if not job_id:
        raise RuntimeError(f"No job id in response for {path.name}: {payload}")
    return job_id


def poll(job_id: str) -> dict:
    """Wait for one job to finish and return its completed payload."""
    deadline = time.monotonic() + POLL_TIMEOUT
    while time.monotonic() < deadline:
        response = requests.get(f"{BASE_URL}/extract/{job_id}", headers=HEADERS, timeout=60)
        response.raise_for_status()
        payload = response.json()
        status = (payload.get("status") or "").lower()
        if status in {"completed", "succeeded", "success", "done"}:
            return payload
        if status in {"failed", "error"}:
            raise RuntimeError(f"Job {job_id} failed: {payload}")
        time.sleep(POLL_SECONDS)
    raise TimeoutError(f"Job {job_id} did not finish within {POLL_TIMEOUT}s")


def extract(path: Path, schema: dict, key: str) -> dict:
    """Extract one document, or return the cached response if it has been done before."""
    cached = RESULTS_DIR / f"{key}.json"
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))

    payload = poll(submit(path, schema))
    record = {"key": key, "document": path.name, "response": payload}
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    return record


def tier_path(stem: str, tier: str) -> Path:
    """Where the file for one document at one tier lives. T0 stays the original PDF."""
    if tier == "t0":
        return DOCS_DIR / f"{stem}.pdf"
    if tier == "t3":
        return DEGRADED_DIR / f"{stem}_t3.jpg"
    return DEGRADED_DIR / f"{stem}_{tier}.png"


def generated_jobs(stems: list[str] | None = None) -> list[tuple[str, Path, dict]]:
    """Every (key, path, schema) triple for the generated ladder."""
    jobs = []
    for truth_file in sorted(DOCS_DIR.glob("*.truth.json")):
        stem = truth_file.name.removesuffix(".truth.json")
        if stems and stem not in stems:
            continue
        doc_type = json.loads(truth_file.read_text(encoding="utf-8"))["doc_type"]
        for tier in TIERS:
            jobs.append((f"{stem}__{tier}", tier_path(stem, tier), SCHEMAS[doc_type]))
    return jobs


def cord_jobs() -> list[tuple[str, Path, dict]]:
    """Every (key, path, schema) triple for the real receipts."""
    jobs = []
    for truth_file in sorted(CORD_DIR.glob("*.truth.json")):
        stem = truth_file.name.removesuffix(".truth.json")
        jobs.append((f"cord_{stem}", CORD_DIR / f"{stem}.jpg", RECEIPT_SCHEMA))
    return jobs


def run(jobs: list[tuple[str, Path, dict]]) -> None:
    pending = [j for j in jobs if not (RESULTS_DIR / f"{j[0]}.json").exists()]
    print(f"{len(jobs)} jobs, {len(jobs) - len(pending)} already cached, {len(pending)} to run")

    failures = []
    for index, (key, path, schema) in enumerate(jobs, start=1):
        if (RESULTS_DIR / f"{key}.json").exists():
            continue
        try:
            extract(path, schema, key)
            print(f"  [{index}/{len(jobs)}] {key}")
        except Exception as error:  # noqa: BLE001 - one bad document must not end the run
            failures.append((key, repr(error)))
            print(f"  [{index}/{len(jobs)}] {key} FAILED {error}")

    print(f"Done. {len(failures)} failed.")
    for key, error in failures:
        print(f"  {key}: {error}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pilot", action="store_true", help="three generated documents only")
    parser.add_argument(
        "--only", choices=["generated", "cord"], help="restrict the run to one corpus"
    )
    args = parser.parse_args()

    if not HEADERS["api-key"]:
        raise SystemExit("UNSILOED_API_KEY is not set. Add it to the repo-root .env file.")

    if args.pilot:
        jobs = generated_jobs(list(PILOT_STEMS))
    elif args.only == "cord":
        jobs = cord_jobs()
    elif args.only == "generated":
        jobs = generated_jobs()
    else:
        jobs = generated_jobs() + cord_jobs()

    run(jobs)


if __name__ == "__main__":
    main()
