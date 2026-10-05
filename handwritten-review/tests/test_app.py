"""Tests for the HTTP routes, using the bundled sample so no API calls are made."""
import json

import pytest
from fastapi.testclient import TestClient

import app as server

SAMPLE = "sample-letter-1837"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "DOCUMENTS", tmp_path / "documents")
    with TestClient(server.app) as c:
        yield c


def test_sample_is_preloaded(client):
    docs = client.get("/documents").json()
    assert [d["id"] for d in docs] == [SAMPLE]
    doc = client.get(f"/documents/{SAMPLE}").json()
    assert doc["state"] == "ready" and doc["pages"] == 1 and doc["review"]["changes"]


def test_decisions_are_saved_and_exported(client):
    review = client.get(f"/documents/{SAMPLE}").json()["review"]
    change = next(c for c in review["changes"] if c["printed"] == "preparations")
    saved = client.put(f"/documents/{SAMPLE}/decisions", json={change["id"]: {"state": "accepted"}}).json()
    assert "all passionateness may" in saved["clean_text"]
    export = client.get(f"/documents/{SAMPLE}/export").json()
    logged = next(c for c in export["changes"] if c["id"] == change["id"])
    assert logged["decision"] == "accepted" and "all passionateness may" in export["clean_text"]


def test_document_without_changes_still_exports(client):
    folder = server.DOCUMENTS / "no-edits"
    folder.mkdir()
    (folder / "status.json").write_text(json.dumps({"name": "clean.pdf", "state": "ready"}))
    (folder / "review.json").write_text(json.dumps({"segments": [{"text": "A page without edits."}], "changes": []}))
    export = client.get("/documents/no-edits/export").json()
    assert export["clean_text"] == "A page without edits." and export["changes"] == []


def test_delete_and_unknown_documents(client):
    assert client.delete(f"/documents/{SAMPLE}").status_code == 200
    assert client.get(f"/documents/{SAMPLE}").status_code == 404
    assert client.get("/documents/../etc").status_code == 404


def test_upload_rejects_unsupported_files(client):
    response = client.post("/documents", files={"file": ("notes.docx", b"...", "application/octet-stream")})
    assert response.status_code == 400


def test_export_records_insertion_placement(client):
    folder = server.DOCUMENTS / "placement"
    folder.mkdir()
    (folder / "status.json").write_text(json.dumps({"name": "essay.pdf", "state": "ready"}))
    change = {"id": "c1", "kind": "substitution", "printed": "have", "handwriting": "engaging in",
              "flags": [], "box": None, "second_read": None, "in_transcript": True}
    (folder / "review.json").write_text(json.dumps({"segments": [{"text": "and "}, {"change": "c1"}, {"text": " a"}], "changes": [change]}))

    def export_with(decision):
        client.put("/documents/placement/decisions", json={"c1": decision})
        return client.get("/documents/placement/export").json()

    after = export_with({"state": "accepted", "kind": "insertion"})
    before = export_with({"state": "accepted", "kind": "insertion", "before": True})
    assert after["clean_text"] == "and have engaging in a" and after["changes"][0]["placement"] == "after"
    assert before["clean_text"] == "and engaging in have a" and before["changes"][0]["placement"] == "before"
    assert before["changes"][0]["edited"] is True
