"""
KYC ID-Verification demo — Unsiloed AI backend.

Single-page UI + thin proxy. The Unsiloed api-key stays server-side here and
never reaches the browser. Each uploaded document is run through Unsiloed
/v2/extract with a per-type JSON schema (with citations + confidence), then a
rule-based engine cross-checks name/address across documents and renders a
PASS / REVIEW / FAIL decision.
"""
import os, io, json, time, tempfile, subprocess, re, datetime
from concurrent.futures import ThreadPoolExecutor
import requests
from flask import Flask, request, jsonify, send_from_directory, send_file

BASE = "https://prod.visionapi.unsiloed.ai"
HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(HERE, "samples")

# --- API key: env first, then ../.env ---
def _load_key():
    k = os.environ.get("UNSILOED_API_KEY")
    if k:
        return k.strip()
    envp = os.path.join(HERE, ".env")
    if os.path.exists(envp):
        for line in open(envp):
            if line.strip().startswith("UNSILOED_API_KEY"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("UNSILOED_API_KEY not found (env or ../.env)")

API_KEY = _load_key()
H = {"api-key": API_KEY}
LOW_CONF = 0.85
TODAY = datetime.date.today()

app = Flask(__name__, static_folder=None)

# --- Per-document-type extraction schemas ---
SCHEMAS = {
    "id": {
        "type": "object",
        "properties": {
            "full_name": {"type": "string", "description": "The person's full name (given names plus surname / family name) as printed on the ID"},
            "document_number": {"type": "string", "description": "The ID / passport / licence number"},
            "date_of_birth": {"type": "string", "description": "Date of birth"},
            "date_of_expiry": {"type": "string", "description": "Expiry / valid-until date of the document"},
            "nationality": {"type": "string", "description": "Nationality or issuing country"},
            "address": {"type": "string", "description": "Residential address if present on the document, else empty"},
        },
        "required": ["full_name", "date_of_birth", "date_of_expiry"],
        "additionalProperties": False,
    },
    "utility_bill": {
        "type": "object",
        "properties": {
            "account_holder_name": {"type": "string", "description": "Name of the account holder / customer"},
            "service_address": {"type": "string", "description": "Service / billing address"},
            "provider": {"type": "string", "description": "Utility provider / company name"},
            "account_number": {"type": "string", "description": "Account number"},
            "amount_due": {"type": "string", "description": "Total amount due"},
            "billing_date": {"type": "string", "description": "Invoice / billing date"},
        },
        "required": ["account_holder_name", "service_address"],
        "additionalProperties": False,
    },
    "bank_statement": {
        "type": "object",
        "properties": {
            "account_holder_name": {"type": "string", "description": "Name of the account holder"},
            "address": {"type": "string", "description": "Mailing address of the account holder"},
            "bank_name": {"type": "string", "description": "Bank / institution name"},
            "account_number": {"type": "string", "description": "Account number or IBAN"},
            "statement_period": {"type": "string", "description": "Statement period"},
            "closing_balance": {"type": "string", "description": "Closing / ending balance"},
        },
        "required": ["account_holder_name", "address"],
        "additionalProperties": False,
    },
}
NAME_FIELD = {"id": "full_name", "utility_bill": "account_holder_name", "bank_statement": "account_holder_name"}
ADDR_FIELD = {"id": "address", "utility_bill": "service_address", "bank_statement": "address"}
# Fields that actually matter for the decision (others are shown but never flagged).
# e.g. a passport has no address, so id.address being empty is not a problem.
CRITICAL = {
    "id": {"full_name", "document_number", "date_of_birth", "date_of_expiry"},
    "utility_bill": {"account_holder_name", "service_address"},
    "bank_statement": {"account_holder_name", "address"},
}


def _to_pdf_bytes(raw, filename):
    """Unsiloed /v2/extract wants a PDF. Pass PDFs through; convert images via sips."""
    if filename.lower().endswith(".pdf") or raw[:5] == b"%PDF-":
        return raw
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "in_" + os.path.basename(filename))
        out = os.path.join(d, "out.pdf")
        open(src, "wb").write(raw)
        subprocess.run(["sips", "-s", "format", "pdf", src, "--out", out],
                       check=True, capture_output=True)
        return open(out, "rb").read()


def extract_doc(raw, filename, doc_type):
    """Run one document through Unsiloed extract; return {fields, elapsed}."""
    schema = SCHEMAS[doc_type]
    pdf = _to_pdf_bytes(raw, filename)
    t0 = time.time()
    r = requests.post(f"{BASE}/v2/extract", headers=H,
                      files={"pdf_file": (os.path.basename(filename) + ".pdf", pdf, "application/pdf")},
                      data={"schema_data": json.dumps(schema), "model": "gamma", "enable_citations": "true"})
    r.raise_for_status()
    jid = r.json()["job_id"]
    result = {}
    for _ in range(180):
        res = requests.get(f"{BASE}/extract/{jid}", headers=H).json()
        st = res.get("status")
        if st == "completed":
            result = res.get("result", {})
            break
        if st == "failed":
            raise RuntimeError(res.get("message", "extract failed"))
        time.sleep(3)
    fields = {}
    for k, v in result.items():
        if isinstance(v, dict) and "value" in v:
            sc = v.get("score") or {}
            conf = sc.get("extraction_score") if isinstance(sc, dict) else sc
            ground = sc.get("grounding_score") if isinstance(sc, dict) else None
            fields[k] = {"value": v.get("value"), "confidence": conf,
                         "grounding": ground, "page": v.get("page_no")}
    return {"fields": fields, "elapsed": round(time.time() - t0, 1)}


# --- rule-based matching helpers ---
def norm_name(s):
    if not s:
        return set()
    s = re.sub(r"[^a-z\s]", " ", s.lower())
    return {t for t in s.split() if len(t) > 1}

def norm_addr(s):
    if not s:
        return ""
    s = s.lower().replace("\n", " ")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def name_match(a, b):
    A, B = norm_name(a), norm_name(b)
    if not A or not B:
        return None
    inter = A & B
    return len(inter) >= min(len(A), len(B)) and len(inter) >= 2

def addr_match(a, b):
    A, B = set(norm_addr(a).split()), set(norm_addr(b).split())
    if not A or not B:
        return None
    inter = A & B
    return len(inter) / max(1, min(len(A), len(B))) >= 0.6


@app.post("/verify")
def verify():
    docs = []  # (doc_type, filename, raw)
    for key in ("id", "utility_bill", "bank_statement"):
        f = request.files.get(key)
        sample = request.form.get(key + "_sample")
        if f and f.filename:
            docs.append((key, f.filename, f.read()))
        elif sample:
            p = os.path.join(SAMPLES, os.path.basename(sample))
            if os.path.exists(p):
                docs.append((key, os.path.basename(sample), open(p, "rb").read()))
    if not docs:
        return jsonify({"error": "no documents provided"}), 400

    # extract all docs in parallel
    out = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(extract_doc, raw, fn, dt): (dt, fn) for dt, fn, raw in docs}
        for fut, (dt, fn) in [(f, futs[f]) for f in futs]:
            try:
                out[dt] = {"filename": fn, **fut.result()}
            except Exception as e:
                out[dt] = {"filename": fn, "error": str(e), "fields": {}}

    # annotate each field with whether it's expected on this doc type, so the UI
    # can distinguish "not present" (e.g. passports have no address) from "unreadable".
    for dt, d in out.items():
        for fld, info in d.get("fields", {}).items():
            info["expected"] = fld in CRITICAL.get(dt, set())

    # gather names / addresses present
    def fval(dt, field):
        return (out.get(dt, {}).get("fields", {}).get(field, {}) or {}).get("value")

    names = {dt: fval(dt, NAME_FIELD[dt]) for dt in out if fval(dt, NAME_FIELD[dt])}
    addrs = {dt: fval(dt, ADDR_FIELD[dt]) for dt in out if fval(dt, ADDR_FIELD[dt])}

    checks = []
    dts = list(out.keys())
    for i in range(len(dts)):
        for j in range(i + 1, len(dts)):
            a, b = dts[i], dts[j]
            if a in names and b in names:
                m = name_match(names[a], names[b])
                checks.append({"type": "Name", "a": a, "b": b,
                               "va": names[a], "vb": names[b], "match": m})
            if a in addrs and b in addrs:
                m = addr_match(addrs[a], addrs[b])
                checks.append({"type": "Address", "a": a, "b": b,
                               "va": addrs[a], "vb": addrs[b], "match": m})

    # low-confidence / unreadable flags
    flags = []
    for dt, d in out.items():
        if d.get("error"):
            flags.append(f"{dt}: extraction error")
        for fld, info in d.get("fields", {}).items():
            if fld not in CRITICAL.get(dt, set()):
                continue  # non-critical field (e.g. passport has no address) — show but don't flag
            c = info.get("confidence")
            if info.get("value") in (None, "", "None") or (info.get("grounding") == 0.0):
                flags.append(f"{dt}.{fld}: unreadable (not grounded)")
            elif c is not None and c < LOW_CONF:
                flags.append(f"{dt}.{fld}: low confidence ({c})")

    # expiry check on the ID
    expired = False
    exp = fval("id", "date_of_expiry")
    if exp:
        for fmt in ("%d %m %Y", "%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y", "%d %b %Y", "%b %d, %Y"):
            try:
                if datetime.datetime.strptime(exp.strip(), fmt).date() < TODAY:
                    expired = True
                break
            except ValueError:
                continue

    any_mismatch = any(c["match"] is False for c in checks)
    if any_mismatch or expired:
        decision, reason = "FAIL", ("ID expired" if expired else "name/address mismatch across documents")
    elif flags:
        decision, reason = "REVIEW", "low-confidence or unreadable fields need manual review"
    else:
        decision, reason = "PASS", "all documents consistent and clearly read"

    return jsonify({"decision": decision, "reason": reason,
                    "documents": out, "checks": checks, "flags": flags, "expired": expired})


@app.get("/samples/<path:name>")
def sample_file(name):
    return send_from_directory(SAMPLES, name)

@app.get("/")
def index():
    return send_file(os.path.join(HERE, "index.html"))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    print(f"KYC demo on http://127.0.0.1:{port}  (Unsiloed key loaded:",
          API_KEY[:4] + "…" + API_KEY[-3:] + ")")
    app.run(host="127.0.0.1", port=port, debug=False)
