"""Markup Review: a web app for reviewing handwritten edits that Unsiloed extracts from scans.

Run it with:  uvicorn app:app --reload
"""
import json
import shutil
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse

from review import prepare, redline
from review.pipeline import process

ROOT = Path(__file__).parent
DOCUMENTS = ROOT / "documents"
SAMPLE = ROOT / "sample"
ALLOWED = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}


def load(path: Path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def set_status(folder: Path, **fields) -> None:
    status = load(folder / "status.json", {})
    status.update(fields)
    (folder / "status.json").write_text(json.dumps(status))


def seed_sample() -> None:
    """Load the sample letter with its saved reads, so the app has a document to open without an API key."""
    folder = DOCUMENTS / "sample-letter-1837"
    if folder.exists():
        return
    folder.mkdir(parents=True)
    prepare.page_images(SAMPLE / "letter-1837.pdf", folder)
    reads = load(SAMPLE / "letter-1837.reads.json")  # one pair of reads per page
    (folder / "reads.json").write_text(json.dumps(reads))
    review = redline.merge_pages([redline.build_review(pair) for pair in reads])
    (folder / "review.json").write_text(json.dumps(review))
    set_status(folder, name="Sample: 1837 letter with corrections", state="ready", pages=1, sample=True, created=0)


@asynccontextmanager
async def lifespan(_app):
    DOCUMENTS.mkdir(exist_ok=True)
    seed_sample()
    yield


app = FastAPI(title="Markup Review", lifespan=lifespan)


def folder_for(doc_id: str) -> Path:
    folder = DOCUMENTS / doc_id
    if not doc_id.replace("-", "").isalnum() or not folder.is_dir():
        raise HTTPException(404, "No document with that ID")
    return folder


def run_pipeline(folder: Path, original: Path) -> None:
    try:
        process(original, folder, on_status=lambda **fields: set_status(folder, **fields, started=time.time()))
        set_status(folder, state="ready")
    except Exception as error:
        set_status(folder, state="failed", error=f"{type(error).__name__}: {error}")


@app.post("/documents")
async def upload(file: UploadFile):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED:
        raise HTTPException(400, "Upload a PDF or an image (PNG, JPEG, TIFF, or WebP)")
    doc_id = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    folder = DOCUMENTS / doc_id
    folder.mkdir(parents=True)
    original = folder / f"original{suffix}"
    original.write_bytes(await file.read())
    set_status(folder, name=file.filename, state="queued", created=time.time())
    threading.Thread(target=run_pipeline, args=(folder, original), daemon=True).start()
    return {"id": doc_id}


@app.get("/documents")
def list_documents():
    docs = [{"id": f.name, **load(f / "status.json", {})} for f in DOCUMENTS.iterdir() if (f / "status.json").exists()]
    return sorted(docs, key=lambda d: d.get("created", 0), reverse=True)


@app.get("/documents/{doc_id}")
def get_document(doc_id: str):
    folder = folder_for(doc_id)
    review = load(folder / "review.json")
    decisions = load(folder / "decisions.json", {})
    return {
        "id": doc_id,
        **load(folder / "status.json", {}),
        "pages": len(list(folder.glob("page-*.png"))),
        "review": review,
        "decisions": decisions,
        "clean_text": redline.clean_text(review, decisions) if review else None,
    }


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    shutil.rmtree(folder_for(doc_id))
    return {"deleted": doc_id}


@app.get("/documents/{doc_id}/pages/{number}.png")
def page_image(doc_id: str, number: int):
    image = folder_for(doc_id) / f"page-{number}.png"
    if not image.exists():
        raise HTTPException(404, "No such page")
    return FileResponse(image)


@app.put("/documents/{doc_id}/decisions")
def save_decisions(doc_id: str, decisions: dict):
    folder = folder_for(doc_id)
    review = load(folder / "review.json")
    if not review:
        raise HTTPException(409, "This document is still being read")
    (folder / "decisions.json").write_text(json.dumps(decisions))
    return {"clean_text": redline.clean_text(review, decisions)}


@app.get("/documents/{doc_id}/export")
def export(doc_id: str):
    folder = folder_for(doc_id)
    review, decisions = load(folder / "review.json"), load(folder / "decisions.json", {})
    if not review:
        raise HTTPException(409, "This document is still being read")
    return {"document": load(folder / "status.json", {}).get("name"),
            "clean_text": redline.clean_text(review, decisions),
            "changes": redline.review_log(review, decisions)}


@app.get("/")
def frontend():
    return FileResponse(ROOT / "frontend" / "index.html")
