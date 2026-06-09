"""LangChain tools wrapping the Unsiloed API.

Each tool submits a job *and* polls it to completion, so the agent gets the
final result in a single call rather than juggling job ids. Inputs accept either
a local ``path`` or a remote ``url`` — a CLI has filesystem access, so we lean on
local files when we can.

Results are trimmed before they reach the model: parse can return megabytes of
OCR and bounding boxes, which would blow the context window and tell the model
nothing it needs. We hand back compact summaries and write the full payload to
disk, returning the saved path.
"""

from __future__ import annotations

import json
import os
from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from .client import UnsiloedClient, UnsiloedError
from . import ui

OUTPUT_DIR = os.environ.get("UNSILOED_OUTPUT_DIR", "unsiloed_output")


def _save(name: str, payload: dict[str, Any]) -> str:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, name)
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
    return path


def _resolve_path(path: str) -> str:
    """Turn user-typed shorthand into a real absolute path.

    The user shouldn't have to spell out their username. We accept '~', env
    vars, relative paths, and paths that drop the home prefix or use the
    display-redacted '/Users/user/...' form, resolving them against $HOME and
    the CWD. The first candidate that exists on disk wins; otherwise we return
    the original so the API surfaces a clear "not found".
    """
    p = os.path.expanduser(os.path.expandvars(path))
    if os.path.exists(p):
        return os.path.abspath(p)

    home = os.path.expanduser("~")
    candidates = [
        os.path.join(home, p.lstrip("/")),       # Desktop/x  -> ~/Desktop/x
        os.path.join(os.getcwd(), p),            # relative to CWD
    ]
    if "/Users/user/" in p:                      # restore redacted username
        candidates.append(p.replace("/Users/user/", home + "/"))
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return p


def _src(path: str | None, url: str | None) -> dict[str, str]:
    if path:
        return {"file_path": _resolve_path(path)}
    if url:
        return {"url": url}
    raise UnsiloedError("Provide either a local 'path' or a remote 'url'.")


# --------------------------------------------------------------------------- #
# arg schemas
# --------------------------------------------------------------------------- #


class ParseArgs(BaseModel):
    path: str | None = Field(None, description="Local path to a PDF/image/Office file.")
    url: str | None = Field(None, description="Public URL to the document, if no local file.")
    segment_filter: str | None = Field(
        None,
        description="Comma-separated segment types to keep, e.g. 'table' or 'table,picture'. Omit for all.",
    )
    pages: str | None = Field(None, description="Page subset like '1-5' or '2,4,6'.")


class ExtractArgs(BaseModel):
    path: str | None = Field(None, description="Local path to a PDF file.")
    url: str | None = Field(None, description="Public URL to the PDF, if no local file.")
    extraction_schema: str = Field(
        ...,
        description=(
            "A JSON Schema (as a string) describing the fields to extract. "
            "Each property should have a 'description' written like an instruction."
        ),
    )
    model: str = Field("gamma", description="Extraction tier: alpha, beta, gamma, or delta.")


class ClassifyArgs(BaseModel):
    path: str | None = Field(None, description="Local path to a PDF file.")
    url: str | None = Field(None, description="Public URL to the PDF, if no local file.")
    categories: list[dict] = Field(
        ...,
        description="List of {name, description?} category objects to choose from.",
    )


class SplitArgs(BaseModel):
    path: str | None = Field(None, description="Local path to a PDF file.")
    url: str | None = Field(None, description="Public URL to the PDF, if no local file.")
    categories: list[dict] = Field(
        ...,
        description="List of {name, description?} categories; one PDF is emitted per detected type.",
    )


class EmptyArgs(BaseModel):
    pass


# --------------------------------------------------------------------------- #
# tool implementations
# --------------------------------------------------------------------------- #


def build_tools(client: UnsiloedClient) -> list[StructuredTool]:
    def _tick(op: str):
        def cb(attempt: int, status: str) -> None:
            # Update the spinner in place instead of printing a line per poll.
            ui.set_progress(f"{op}… {status.lower()} ({attempt * 5}s)")
        return cb

    def parse_tool(path=None, url=None, segment_filter=None, pages=None) -> str:
        opts: dict[str, str] = {}
        if segment_filter:
            opts["segment_filter"] = segment_filter
        if pages:
            opts["pages"] = pages
        result = client.parse(**_src(path, url), options=opts, on_tick=_tick("parse"))
        chunks = result.get("chunks", [])
        markdown = "\n\n".join(c.get("embed", "") for c in chunks)
        md_path = os.path.join(OUTPUT_DIR, "parsed.md")
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(md_path, "w") as f:
            f.write(markdown)
        json_path = _save("parsed.json", result)
        preview = markdown[:1500]
        return (
            f"Parsed {result.get('file_name')} · {result.get('page_count')} pages · "
            f"{result.get('total_chunks')} chunks · {result.get('credit_used')} credits.\n"
            f"Full Markdown -> {md_path}\nFull JSON -> {json_path}\n\n"
            f"--- markdown preview ---\n{preview}"
        )

    def extract_tool(extraction_schema, path=None, url=None, model="gamma") -> str:
        try:
            schema = json.loads(extraction_schema)
        except json.JSONDecodeError as e:
            return f"Invalid extraction_schema: {e}"
        # Normalise a flat {field: {...}} map into a proper JSON Schema. Without
        # the {type, properties} envelope the API returns values but won't
        # localise them, so page_no/bboxes come back empty.
        if "properties" not in schema and "type" not in schema:
            schema = {"type": "object", "properties": schema}
        result = client.extract(
            schema=schema,
            model=model,
            enable_citations=True,
            **_src(path, url),
            on_tick=_tick("extract"),
        )
        json_path = _save("extracted.json", result)
        fields = result.get("result", {})

        lines, has_pages = [], False
        for name, info in fields.items():
            if not isinstance(info, dict):
                lines.append(f"  · {name}: {info}")
                continue
            val = info.get("value")

            # score is either a flat float or {grounding_score, extraction_score}.
            score = info.get("score")
            if isinstance(score, dict):
                g, e = score.get("grounding_score"), score.get("extraction_score")
                sc = f" [grounding {g}, extraction {e}]"
            elif score is not None:
                sc = f" [score {score}]"
            else:
                sc = ""

            # citation is a singular {page, bbox, ...} dict; older docs said
            # page_no/bboxes, so fall back to those if present.
            page = None
            citation = info.get("citation")
            if isinstance(citation, dict):
                page = citation.get("page")
            if page is None:
                page = info.get("page_no")
            cite = ""
            if page is not None:
                cite, has_pages = f" — p.{page}", True

            lines.append(f"  · {name}: {val}{sc}{cite}")

        note = (
            ""
            if has_pages
            else "\n(Note: the API returned no page_no/bboxes for these fields — "
            "report that honestly; do NOT re-run hoping for different output.)"
        )
        return (
            f"Extraction complete (model={model}, citations on). Full result -> {json_path}\n"
            + "\n".join(lines)
            + note
        )

    def classify_tool(categories, path=None, url=None) -> str:
        result = client.classify(categories=categories, **_src(path, url), on_tick=_tick("classify"))
        r = result.get("result", {})
        json_path = _save("classified.json", result)
        return (
            f"Classification: {r.get('classification')} "
            f"(confidence {r.get('confidence')}). Full result -> {json_path}"
        )

    def split_tool(categories, path=None, url=None) -> str:
        result = client.split(categories=categories, **_src(path, url), on_tick=_tick("split"))
        files = result.get("files", [])
        json_path = _save("split.json", result)
        listing = "\n".join(
            f"  · {f.get('name')} ({f.get('classification', '?')}, conf {f.get('confidence_score')})"
            for f in files
        )
        return f"Split into {len(files)} document(s). Manifest -> {json_path}\n{listing}"

    def usage_tool() -> str:
        return json.dumps(client.usage(), indent=2)

    return [
        StructuredTool.from_function(
            func=parse_tool,
            name="unsiloed_parse_document",
            description=(
                "Convert a document (PDF, image, or Office file) into Markdown chunks "
                "with layout-aware segments (tables, figures, headers). Use for RAG, "
                "'PDF to markdown', or extracting tables. Returns a Markdown preview and "
                "writes full output to disk."
            ),
            args_schema=ParseArgs,
        ),
        StructuredTool.from_function(
            func=extract_tool,
            name="unsiloed_extract_data",
            description=(
                "Extract specific typed fields from a PDF using a JSON Schema you provide. "
                "Returns each field with a confidence score and citations. Use for invoices, "
                "contracts, forms, KYC — anytime you know exactly which fields you need."
            ),
            args_schema=ExtractArgs,
        ),
        StructuredTool.from_function(
            func=classify_tool,
            name="unsiloed_classify_document",
            description=(
                "Classify a PDF into one of a set of categories you define (each with an "
                "optional description). Returns the top category and a confidence score."
            ),
            args_schema=ClassifyArgs,
        ),
        StructuredTool.from_function(
            func=split_tool,
            name="unsiloed_split_document",
            description=(
                "Split a merged/scanned batch PDF into separate documents by category. "
                "Returns one downloadable PDF per detected document type."
            ),
            args_schema=SplitArgs,
        ),
        StructuredTool.from_function(
            func=usage_tool,
            name="unsiloed_get_usage",
            description="Check remaining Unsiloed API credits and usage.",
            args_schema=EmptyArgs,
        ),
    ]
