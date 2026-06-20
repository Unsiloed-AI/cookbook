"""Due-diligence AI agent — Unsiloed (read) + LangChain agent on Opus 4.8 (reason) + E2B (compute).

Works on any PDF. Unsiloed Parse turns the document into clean Markdown (its strength:
dense tables, multi-column legal text, scans), auto-slicing anything over ~40 pages.
A LangChain agent (`create_agent`) running on Claude Opus 4.8 then acts as a diligence
analyst over that text. It is given one tool — a Python sandbox running in E2B — so it
can actually *compute* and *verify* the numbers (growth rates, margins, leverage and
coverage ratios, CAGRs) rather than doing arithmetic in its head, which LLMs get wrong.
The figures come from Unsiloed (no hallucinated source numbers); every derived figure is
checked in real code; the risk synthesis, red flags and follow-ups are the LLM's judgment.

This module is the engine (imported by app.py, the web UI) and is also the command-line
runner. From the command line:

    python cli.py                       # bundled SpaceX sample, first 3 pages
    python cli.py 1                     # sample, first 1 page (fastest)
    python cli.py path/to/doc.pdf       # any PDF, all pages
    python cli.py path/to/doc.pdf 5     # any PDF, first 5 pages
"""

import os
import sys
import json
import html
import pathlib
import tempfile
import contextlib

from pypdf import PdfReader, PdfWriter

from langchain.agents import create_agent
from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool
from e2b_code_interpreter import Sandbox

import unsiloed

HERE = pathlib.Path(__file__).resolve().parent
REPORTS = HERE / "reports"
MODEL = "claude-opus-4-8"
MAX_TOKENS = 20_000
PARSE_PAGE_LIMIT = 40    # Unsiloed is most reliable at <= ~40 pages/call
MAX_PAGES = 120          # cap how much of a large doc we read, to bound demo latency
MAX_CONTEXT_CHARS = 160_000

MEMO_SCHEMA = {
    "title": "diligence_memo",
    "description": "Structured due-diligence memo for a decision-maker.",
    "type": "object",
    "properties": {
        "target": {"type": "string", "description": "The company / entity being diligenced"},
        "doc_type": {"type": "string", "description": "What kind of document this is, e.g. IPO prospectus, 10-K, merger agreement"},
        "deal_context": {"type": "string", "description": "What transaction or decision this diligence supports, if discernible"},
        "business_summary": {"type": "string", "description": "2-3 sentences: what the entity does and how it makes money"},
        "financial_highlights": {
            "type": "array",
            "items": {"type": "object", "properties": {
                "metric": {"type": "string"}, "value": {"type": "string"}, "note": {"type": "string"},
            }, "required": ["metric", "value"], "additionalProperties": False},
        },
        "strengths": {"type": "array", "items": {"type": "string"}},
        "key_risks": {
            "type": "array", "description": "Material risks, most severe first",
            "items": {"type": "object", "properties": {
                "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                "category": {"type": "string", "description": "e.g. Financial, Regulatory, Operational, Governance, Market, Legal"},
                "finding": {"type": "string"},
                "evidence": {"type": "string", "description": "What in the document supports this"},
            }, "required": ["severity", "category", "finding"], "additionalProperties": False},
        },
        "red_flags": {
            "type": "array", "description": "Issues that could materially change or condition the decision",
            "items": {"type": "object", "properties": {
                "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                "finding": {"type": "string"}, "why_it_matters": {"type": "string"},
            }, "required": ["severity", "finding"], "additionalProperties": False},
        },
        "open_questions": {"type": "array", "items": {"type": "string"},
                           "description": "Follow-up diligence requests for management / the data room"},
        "recommendation": {"type": "string", "description": "Overall analyst recommendation and conditions"},
    },
    "required": ["target", "business_summary", "key_risks", "red_flags", "recommendation"],
    "additionalProperties": False,
}

SYSTEM = """You are a senior investment due-diligence analyst. You are given the text of a \
company or transaction document (read out of the file by a document-AI system — treat the \
figures as faithful to the source). Produce a rigorous, skeptical diligence memo for a \
decision-maker (investor, acquirer, or lender).

You have a tool, run_python, that executes Python in a secure sandbox. USE IT for every
calculation — do not do arithmetic in your head. Pull the raw figures out of the document
text, then compute and verify derived metrics in code (year-over-year growth, CAGR, gross/
operating/net margins, current ratio, debt-to-equity, interest coverage, burn/runway, dilution).
print() the results you rely on. Treat a derived figure as trustworthy only after the tool returns it.

Rules:
- Ground every finding in the provided text. Do not invent figures, dates, parties, or facts.
- Be specific and quantitative where the text allows (cite the actual numbers).
- Every ratio, growth rate or other derived number in the memo must come from a run_python computation.
- Rank risks by genuine materiality, not by how many words the document spends on them.
- Red flags are issues that would change or condition the decision (concentration, liquidity \
or going-concern strain, control/governance, dilution, leverage/covenants, litigation, key-person \
dependence, regulatory exposure, related-party or common-control transactions). Only flag what the text supports.
- open_questions are the follow-ups you would send to management or request in the data room.
- If the document is not a company/transaction document, do your best and say so in deal_context."""

CHAT_SYSTEM = """You are a due-diligence analyst assistant. Answer the user's questions about the \
document strictly from the provided document text and the memo. Be concise and specific, cite \
figures from the text, and if something is not covered by the provided text, say so plainly \
rather than guessing. You have a run_python tool — use it for any calculation the user asks for \
(ratios, growth, totals) instead of computing in your head."""


# ── reading ──────────────────────────────────────────────────────────────────

def _slice(reader: PdfReader, start: int, end: int) -> str:
    writer = PdfWriter()
    for p in reader.pages[start:end]:
        writer.add_page(p)
    fd, path = tempfile.mkstemp(suffix=".pdf")
    with os.fdopen(fd, "wb") as fh:
        writer.write(fh)
    return path


def parse_pdf(path: str, progress=print) -> str:
    """Parse a PDF to Markdown via Unsiloed, auto-slicing anything over the page limit."""
    reader = PdfReader(path)
    n = min(len(reader.pages), MAX_PAGES)
    if len(reader.pages) <= PARSE_PAGE_LIMIT:
        progress(f"Reading {len(reader.pages)} pages with Unsiloed…")
        return unsiloed.parse(path)

    parts = []
    for start in range(0, n, PARSE_PAGE_LIMIT):
        end = min(start + PARSE_PAGE_LIMIT, n)
        progress(f"Reading pages {start+1}–{end} with Unsiloed…")
        slice_path = _slice(reader, start, end)
        try:
            text = unsiloed.parse(slice_path)
        except Exception as exc:
            progress(f"  (skipped pages {start+1}–{end}: {exc})")
            text = ""
        finally:
            pathlib.Path(slice_path).unlink(missing_ok=True)
        if text:
            parts.append(f"\n\n===== PAGES {start+1}–{end} =====\n\n{text}")
    if len(reader.pages) > MAX_PAGES:
        parts.append(f"\n\n[Note: document has {len(reader.pages)} pages; first {MAX_PAGES} read.]")
    return "".join(parts)


# ── reasoning (LangChain agent on Opus 4.8, with an E2B Python sandbox tool) ───

def _model() -> ChatAnthropic:
    unsiloed.load_env()  # also loads ANTHROPIC_API_KEY / E2B_API_KEY from the project .env
    return ChatAnthropic(model=MODEL, max_tokens=MAX_TOKENS, max_retries=6)


@contextlib.contextmanager
def _calc_tool():
    """Yield a LangChain `run_python` tool backed by a live E2B sandbox.

    The sandbox is created once and reused across every tool call in an agent run,
    then torn down on exit. Stateful: variables persist between calls within the run.
    """
    unsiloed.load_env()  # ensures E2B_API_KEY is in the environment
    with Sandbox.create() as sandbox:

        @tool
        def run_python(code: str) -> str:
            """Execute Python in a secure sandbox and return its output.

            Use this for ALL arithmetic and financial calculations — growth rates, CAGR,
            margins, current ratio, debt-to-equity, interest coverage, burn/runway, dilution.
            State persists between calls. print() any value you want to see; the return string
            contains stdout, then any error.
            """
            execution = sandbox.run_code(code)
            return _format_execution(execution)

        yield run_python


def _format_execution(execution) -> str:
    """Flatten an E2B execution into plain text (stdout + stderr + error)."""
    parts = []
    logs = getattr(execution, "logs", None)
    if logs is not None:
        parts += list(getattr(logs, "stdout", []) or [])
        parts += [f"[stderr] {line}" for line in (getattr(logs, "stderr", []) or [])]
    if not parts and getattr(execution, "text", None):
        parts.append(execution.text)
    error = getattr(execution, "error", None)
    if error:
        parts.append(f"[error] {getattr(error, 'name', '')}: {getattr(error, 'value', error)}")
    return "".join(parts).strip() or "(no output)"


FORMAT_SYSTEM = """Convert the analyst's diligence findings into the required JSON memo. \
Preserve every figure, risk, red flag and recommendation exactly as the analyst stated them — \
do not invent, add, soften or drop anything. Map the content faithfully onto the schema fields."""


def run_analyst(context: str, subject: str) -> dict:
    """Two stages: (1) the agent reasons over the doc and verifies figures via the E2B
    sandbox, producing a free-text memo; (2) one native json_schema call shapes that into
    the structured memo. Splitting these keeps the structured output reliable."""
    prompt = f"Diligence subject: {subject}.\n\nDocument text:\n{context[:MAX_CONTEXT_CHARS]}"

    # Stage 1 — agent loop with the E2B Python tool. No response_format here; let it think
    # and compute freely, then write its memo as text.
    with _calc_tool() as run_python:
        agent = create_agent(model=_model(), tools=[run_python], system_prompt=SYSTEM)
        result = agent.invoke({"messages": [{"role": "user", "content": prompt}]})
    analysis = _message_text(result["messages"][-1])
    if not analysis.strip():
        raise RuntimeError("Agent produced no analysis.")

    # Stage 2 — reliable native structured output (same json_schema path the SDK used before).
    structurer = _model().with_structured_output(MEMO_SCHEMA, method="json_schema")
    memo = structurer.invoke([
        {"role": "system", "content": FORMAT_SYSTEM},
        {"role": "user", "content":
            f"Document text (for reference):\n{context[:MAX_CONTEXT_CHARS]}\n\n"
            f"Analyst findings to structure:\n{analysis}"},
    ])
    return memo


def chat(context: str, memo: dict, history: list) -> str:
    """Answer a follow-up question grounded in the parsed document + memo (can compute via E2B)."""
    grounding = (
        "DOCUMENT TEXT:\n" + context[:MAX_CONTEXT_CHARS] +
        "\n\nMEMO (your prior analysis):\n" + json.dumps(memo)[:20000]
    )
    messages = [
        {"role": "user", "content": grounding},
        {"role": "assistant", "content": "Understood. Ask me anything about this document."},
        *history,
    ]
    with _calc_tool() as run_python:
        agent = create_agent(model=_model(), tools=[run_python], system_prompt=CHAT_SYSTEM)
        result = agent.invoke({"messages": messages})
    return _message_text(result["messages"][-1])


def _message_text(message) -> str:
    """Extract plain text from a LangChain message whose content may be blocks."""
    content = getattr(message, "content", message)
    if isinstance(content, str):
        return content.strip()
    parts = []
    for block in content or []:
        if isinstance(block, str):
            parts.append(block)
        elif isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "".join(parts).strip()


def analyze_pdf(path: str, subject: str = None, progress=print):
    """Full pipeline for one PDF → (parsed_context, memo)."""
    context = parse_pdf(path, progress)
    if not context.strip():
        raise RuntimeError("No text could be read from this PDF.")
    progress(f"Analyzing with Opus 4.8…")
    memo = run_analyst(context, subject or pathlib.Path(path).stem)
    return context, memo


# ── HTML report fragment (used by app.py and the CLI) ────────────────────────

SEV = {"high": "#d6493f", "medium": "#c4881e", "low": "#1f9d57"}
SEV_BG = {"high": "#fdeceb", "medium": "#fbf3e1", "low": "#e8f6ee"}


def _esc(s):
    return html.escape(str(s or ""))


def render_memo_html(memo: dict) -> str:
    """Inner HTML for the memo (no <html> wrapper) — embedded by the report page."""
    def pill(sv):
        sv = sv.lower() if isinstance(sv, str) else "low"
        sv = sv if sv in SEV else "low"
        return f'<span class="sev" style="color:{SEV[sv]};background:{SEV_BG[sv]}">{sv}</span>'

    fin = "".join(
        f'<tr><td class="m">{_esc(f.get("metric"))}</td><td class="v">{_esc(f.get("value"))}</td>'
        f'<td class="n">{_esc(f.get("note"))}</td></tr>'
        for f in memo.get("financial_highlights", []))
    strengths = "".join(f"<li>{_esc(s)}</li>" for s in memo.get("strengths", []))
    risks = "".join(
        f'<div class="item"><div class="head">{pill(r.get("severity","low"))}'
        f'<span class="cat">{_esc(r.get("category"))}</span></div>'
        f'<div class="find">{_esc(r.get("finding"))}</div>'
        f'<div class="eq">{_esc(r.get("evidence"))}</div></div>'
        for r in memo.get("key_risks", []))
    flags = "".join(
        f'<div class="item"><div class="head">{pill(r.get("severity","low"))}</div>'
        f'<div class="find">{_esc(r.get("finding"))}</div>'
        f'<div class="eq">{_esc(r.get("why_it_matters"))}</div></div>'
        for r in memo.get("red_flags", []))
    questions = "".join(f"<li>{_esc(q)}</li>" for q in memo.get("open_questions", []))

    return f"""
  <h1>Due Diligence Memo — {_esc(memo.get('target'))}</h1>
  <p class="ctx">{_esc(memo.get('doc_type'))}{' · ' if memo.get('deal_context') else ''}{_esc(memo.get('deal_context'))}</p>
  <div class="rec"><b>Recommendation</b>{_esc(memo.get('recommendation'))}</div>
  <h2>Business</h2><p class="lead">{_esc(memo.get('business_summary'))}</p>
  {f'<h2>Financial highlights</h2><table>{fin}</table>' if fin else ''}
  {f'<h2>Strengths</h2><ul>{strengths}</ul>' if strengths else ''}
  <h2>Key risks</h2>{risks or '<p class="lead">None identified.</p>'}
  <h2>Red flags</h2>{flags or '<p class="lead">None identified.</p>'}
  {f'<h2>Open questions for management</h2><ul>{questions}</ul>' if questions else ''}
"""


# ── CLI ──────────────────────────────────────────────────────────────────────

def _parse_args(argv):
    """argv -> (pdf_path, pages|None, subject). A bare integer means 'sample, N pages'."""
    path, pages = None, None
    for a in argv:
        if a.isdigit():
            pages = int(a)
        else:
            path = a
    if path is None:
        path = HERE / "data_room" / "spacex_sample.pdf"
        subject = "SpaceX (Space Exploration Technologies Corp.)"
        if pages is None:
            pages = 3   # keep the bundled-sample run fast by default
    else:
        path = pathlib.Path(path)
        subject = path.stem
    return path, pages, subject


def main():
    unsiloed.load_env()
    for v in ("UNSILOED_API_KEY", "ANTHROPIC_API_KEY", "E2B_API_KEY"):
        if not os.environ.get(v):
            raise SystemExit(f"{v} not set — copy .env.example to .env and fill it in.")

    path, pages, subject = _parse_args(sys.argv[1:])
    if not path.exists():
        raise SystemExit(f"PDF not found: {path}")

    # Optionally slice to the first N pages (faster Unsiloed parse for demos).
    target = str(path)
    if pages is not None:
        target = _slice(PdfReader(str(path)), 0, pages)
        print(f"Sliced {path.name} to first {pages} page(s).")

    try:
        context, memo = analyze_pdf(target, subject=subject)
    finally:
        if pages is not None:
            pathlib.Path(target).unlink(missing_ok=True)

    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "memo.json").write_text(json.dumps(memo, indent=2))

    print("\n=== MEMO ===")
    print("Target:        ", memo.get("target"))
    print("Recommendation:", memo.get("recommendation", "")[:200])
    print(f"{len(memo.get('financial_highlights', []))} financial highlights · "
          f"{len(memo.get('key_risks', []))} key risks · "
          f"{len(memo.get('red_flags', []))} red flags")
    for f in memo.get("financial_highlights", []):
        print(f"  • {f.get('metric')}: {f.get('value')}  {f.get('note', '')}")
    print("\nFull memo written to reports/memo.json")


if __name__ == "__main__":
    main()