"""Turn two Unsiloed reads into one list of reviewable changes, with flags where they need a closer look."""
import re

LOW_SCORE = 0.5  # flag changes whose handwriting scores below this

# A second-read change counts as "near" a disputed first-read change when it sits within
# NEAR characters of it in the printed text, or within RELATED characters and shares a word.
NEAR = 12
RELATED = 120

# CriticMarkup: {~~old~>new~~} substitution, {--old--} deletion, {++new++} insertion, {>>note<<} comment
TAG = re.compile(
    r"\{~~(?P<old>[\s\S]*?)~>(?P<new>[\s\S]*?)~~\}"
    r"|\{--(?P<deleted>[\s\S]*?)--\}"
    r"|\{\+\+(?P<inserted>[\s\S]*?)\+\+\}"
    r"|\{>>(?P<note>[\s\S]*?)<<\}"
)


def value(field):
    """Unsiloed wraps every extracted field as {"value", "score", "citation"}; return the value."""
    return field.get("value") if isinstance(field, dict) and "value" in field else field


def normalise(text: str) -> str:
    text = (text or "").replace("-\n", "")  # rejoin words hyphenated across a line break
    words = re.sub(r"[^\w]+", " ", text.lower()).strip()
    return words or text.strip()  # keep punctuation-only marks such as "[" distinguishable


def key(change: dict) -> tuple:
    return change["kind"], normalise(change["printed"]), normalise(change["handwriting"])


# ---- Parse the redline -------------------------------------------------------------

def parse_redline(text: str) -> list[dict]:
    """Split the redline into plain-text segments and change segments."""
    segments, last, position = [], 0, 0
    for match in TAG.finditer(text):
        if match.start() > last:
            plain = text[last:match.start()]
            segments.append({"text": plain})
            position += len(plain)
        if match["old"] is not None:
            change = {"kind": "substitution", "printed": match["old"], "handwriting": match["new"]}
        elif match["deleted"] is not None:
            change = {"kind": "deletion", "printed": match["deleted"], "handwriting": ""}
        elif match["inserted"] is not None:
            change = {"kind": "insertion", "printed": "", "handwriting": match["inserted"]}
        else:
            change = {"kind": "comment", "printed": "", "handwriting": match["note"]}
        change["position"] = position  # offset in the printed text, used to line the two reads up
        segments.append({"change": change})
        position += len(change["printed"])
        last = match.end()
    if last < len(text):
        segments.append({"text": text[last:]})
    return segments


# ---- Attach boxes and scores from the changes array ---------------------------------

def located_changes(read: dict) -> list[dict]:
    """Flatten the `changes` array, keeping each entry's bounding box and lowest score."""
    located = []
    for entry in value(read["result"]["changes"]) or []:
        handwriting, printed = entry.get("handwritten_text", {}), entry.get("printed_text", {})
        scores = [f["score"]["extraction_score"] for f in (handwriting, printed) if value(f) and f.get("score")]
        located.append({
            "kind": value(entry.get("kind")),
            "printed": value(printed) or "",
            "handwriting": value(handwriting) or "",
            "anchor": value(entry.get("anchor")) or "",
            "needs_review": bool(value(entry.get("needs_review"))),
            "score": min(scores) if scores else None,
            "citation": handwriting.get("citation") or printed.get("citation") or entry.get("anchor", {}).get("citation"),
        })
    return located


def box(citation):
    """Convert a citation's point coordinates to fractions of the page, which is all the viewer needs."""
    if not citation:
        return None
    x0, y0, x1, y1 = citation["bbox"]
    w, h = citation["page_width"], citation["page_height"]
    return {"page": citation.get("page", 1), "left": x0 / w, "top": y0 / h, "width": (x1 - x0) / w, "height": (y1 - y0) / h}


def attach(changes: list[dict], located: list[dict]) -> None:
    """Give each inline change the box and score of the matching `changes` entry."""
    unused = list(range(len(located)))
    for change in changes:
        best, best_score = None, 0
        for i in unused:
            entry, score = located[i], 0
            score += 2 if entry["kind"] == change["kind"] else 0
            score += 3 if normalise(entry["handwriting"]) == normalise(change["handwriting"]) else 0
            score += 3 if entry["printed"] and normalise(entry["printed"]) == normalise(change["printed"]) else 0
            if score > best_score:
                best, best_score = i, score
        # Notes often come back with empty handwriting in `changes`, so a kind match is enough for them
        good_enough = best_score >= 3 or (change["kind"] == "comment" and best_score >= 2)
        entry = located[best] if best is not None and good_enough else {}
        if entry:
            unused.remove(best)
        change.update({
            "target": entry.get("printed", "") if change["kind"] == "comment" else "",
            "anchor": entry.get("anchor", ""),
            "needs_review": entry.get("needs_review", False),
            "score": entry.get("score"),
            "box": box(entry.get("citation")),
        })


def changes_of(segments):
    return [s["change"] for s in segments if "change" in s]


# ---- Compare the two reads and flag --------------------------------------------------

def build_review(reads: list[dict]) -> dict:
    """Return {"segments", "changes"}: the first read's transcript plus every change, with flags."""
    parsed = []
    for read in reads:
        segments = parse_redline(value(read["result"]["redline"]) or "")
        attach(changes_of(segments), located_changes(read))
        parsed.append(segments)

    segments = parsed[0]
    changes = changes_of(segments)
    for number, change in enumerate(changes, start=1):
        change["id"] = f"c{number}"
        change["flags"] = []
        change["second_read"] = None
        change["in_transcript"] = True
        if change["needs_review"]:
            change["flags"].append("Model marked unsure")
        if change["score"] is not None and change["score"] < LOW_SCORE:
            change["flags"].append(f"Low confidence ({change['score']:.2f})")
        if not change["box"]:
            change["flags"].append("No location returned")

    if len(parsed) > 1:
        compare(changes, changes_of(parsed[1]))

    return {"segments": [{"text": s["text"]} if "text" in s else {"change": s["change"]["id"]} for s in segments],
            "changes": changes}


def merge_pages(pages: list[dict]) -> dict:
    """Combine one review per page into a single review. Change IDs and boxes get their page number."""
    segments, changes = [], []
    for number, review in enumerate(pages, start=1):
        if number > 1:
            segments.append({"text": "\n\n"})
        ids = {}
        for change in review["changes"]:
            ids[change["id"]] = f"p{number}-{change['id']}"
            box = change["box"] and {**change["box"], "page": number}
            changes.append({**change, "id": ids[change["id"]], "box": box})
        segments += [s if "text" in s else {"change": ids[s["change"]]} for s in review["segments"]]
    return {"segments": segments, "changes": changes}


def compare(first: list[dict], second: list[dict]) -> None:
    """Flag changes the reads disagree on, and show the second read's version next to them.

    A first-read change with an identical second-read change agrees. Any other first-read change
    is disputed. Each leftover second-read change is then attached to the nearest disputed change
    as its alternative: for example, the first read's "thes → this" and the second read's
    "this → the" sit at the same spot, so the reviewer sees both. A leftover with nothing nearby
    is a mark only the second read saw, and is listed separately.
    """
    unmatched = list(second)
    disputed = []
    for change in first:
        match = next((c for c in unmatched if key(c) == key(change)), None)
        if match:
            unmatched.remove(match)
        else:
            disputed.append(change)

    # Positions are offsets in each read's printed text, which can differ slightly in length
    scale = printed_length(first) / printed_length(second)
    only_second = 0
    for other in unmatched:
        position = other["position"] * scale
        nearby = [c for c in disputed if c["second_read"] is None and is_near(c, other, position)]
        if nearby:
            host = min(nearby, key=lambda c: abs(c["position"] - position))
            host["second_read"] = {k: other[k] for k in ("kind", "printed", "handwriting")}
        else:
            only_second += 1
            first.append({**other, "id": f"s{only_second}", "flags": ["Only the second read found this"],
                          "second_read": None, "in_transcript": False})

    for change in disputed:
        change["flags"].insert(0, "Reads disagree" if change["second_read"] else "Only the first read found this")


def printed_length(changes: list[dict]) -> int:
    return max([c["position"] + len(c["printed"]) for c in changes] + [1])


def words(change: dict) -> set[str]:
    return set(normalise(change["handwriting"]).split()) | set(normalise(change["printed"]).split())


def is_near(change: dict, other: dict, position: float) -> bool:
    distance = abs(change["position"] - position)
    return distance < NEAR or (distance < RELATED and bool(words(change) & words(other)))


# ---- Apply the reviewer's decisions ---------------------------------------------------

def apply(change: dict, decision: dict) -> str:
    """The text a change contributes to the clean result.

    A decision is {"state", "handwriting", "kind", "before"}. The reviewer can correct the
    handwriting, and the change type, for example when a caret insertion was read as a
    replacement. Only accepted changes alter the printed text.
    """
    printed = change["printed"]
    if decision.get("state") != "accepted":
        return printed
    kind = decision.get("kind") or change["kind"]
    handwriting = decision.get("handwriting", change["handwriting"]).strip()
    if kind == "substitution":
        return handwriting
    if kind == "deletion":
        return ""
    if kind == "insertion" and printed:
        return f"{handwriting} {printed}" if decision.get("before") else f"{printed} {handwriting}"
    if kind == "insertion":
        return handwriting
    return printed  # notes never change the text


def clean_text(review: dict, decisions: dict) -> str:
    """Apply accepted changes. Pending and rejected changes keep the printed text."""
    changes = {c["id"]: c for c in review["changes"]}
    parts = [segment["text"] if "text" in segment else apply(changes[segment["change"]], decisions.get(segment["change"], {}))
             for segment in review["segments"]]
    text = re.sub(r"[ \t]{2,}", " ", "".join(parts))
    return re.sub(r" +([,.;:!?])", r"\1", text)


def review_log(review: dict, decisions: dict) -> list[dict]:
    """One entry per change for the export: what was printed, what was decided, and why it was flagged."""
    log = []
    for change in review["changes"]:
        decision = decisions.get(change["id"], {})
        kind = decision.get("kind") or change["kind"]
        log.append({
            "id": change["id"],
            "kind": kind,
            # Where an insertion goes relative to the printed words it sits next to, if any
            "placement": ("before" if decision.get("before") else "after") if kind == "insertion" and change["printed"] else None,
            "printed": change["printed"] or change.get("target", ""),
            "handwriting": decision.get("handwriting", change["handwriting"]),
            "decision": decision.get("state", "pending"),
            "edited": any(k in decision for k in ("handwriting", "kind", "before")),
            "flags": change["flags"],
            "box": change["box"],
        })
    return log
