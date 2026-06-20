"""Due-diligence web app — upload any PDF, get a risk-flagged memo, then chat about it.

    pip install -r due-diligence/requirements.txt
    python due-diligence/app.py        # http://127.0.0.1:5000  (5058 if 5000 is taken)

Flow: upload PDF -> Unsiloed Parse reads it -> Opus 4.8 writes the memo -> chat panel
lets you ask follow-ups grounded in the parsed document. Needs UNSILOED_API_KEY and
ANTHROPIC_API_KEY in the project-root .env.
"""

import uuid
import pathlib
import tempfile
import traceback

from flask import Flask, render_template, request, jsonify, abort

import unsiloed
import cli

HERE = pathlib.Path(__file__).resolve().parent
SAMPLE = HERE / "data_room" / "spacex_sample.pdf"

app = Flask(__name__)

# in-memory store for the demo: analysis_id -> {context, memo, subject, history}
STORE = {}


@app.route("/")
def index():
    return render_template("index.html", has_sample=SAMPLE.exists())


@app.route("/analyze", methods=["POST"])
def analyze():
    use_sample = request.form.get("sample") == "1"
    if use_sample:
        path = SAMPLE
        subject = "SpaceX (Space Exploration Technologies Corp.)"
        tmp = None
    else:
        upload = request.files.get("document")
        if not upload or not upload.filename:
            abort(400, "No PDF provided")
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        upload.save(tmp.name)
        tmp.close()
        path = pathlib.Path(tmp.name)
        subject = pathlib.Path(upload.filename).stem

    try:
        context, memo = cli.analyze_pdf(str(path), subject=subject)
    except Exception as exc:
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500
    finally:
        if tmp:
            pathlib.Path(tmp.name).unlink(missing_ok=True)

    aid = uuid.uuid4().hex[:12]
    STORE[aid] = {"context": context, "memo": memo, "subject": subject, "history": []}
    return jsonify({"id": aid, "memo_html": cli.render_memo_html(memo),
                    "target": memo.get("target", subject)})


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    aid = data.get("id")
    question = (data.get("message") or "").strip()
    if aid not in STORE:
        return jsonify({"error": "Session expired — re-run the analysis."}), 404
    if not question:
        return jsonify({"error": "Empty message"}), 400
    sess = STORE[aid]
    sess["history"].append({"role": "user", "content": question})
    try:
        answer = cli.chat(sess["context"], sess["memo"], sess["history"])
    except Exception as exc:
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500
    sess["history"].append({"role": "assistant", "content": answer})
    return jsonify({"answer": answer})


if __name__ == "__main__":
    unsiloed.load_env()
    app.run(port=5058, debug=False)