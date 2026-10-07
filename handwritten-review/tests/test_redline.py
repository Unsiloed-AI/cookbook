"""Tests for parsing, comparing, and applying decisions, using the saved reads of the sample letter."""
import json
from pathlib import Path

from review import redline

READS = json.loads((Path(__file__).parent.parent / "sample" / "letter-1837.reads.json").read_text())[0]  # page 1


def test_parse_redline_splits_text_and_changes():
    segments = redline.parse_redline("all {~~preparations~>passionateness~~} may {--be--}{++be++} avoided{>>sp<<}")
    changes = [s["change"] for s in segments if "change" in s]
    assert [c["kind"] for c in changes] == ["substitution", "deletion", "insertion", "comment"]
    assert changes[0]["printed"] == "preparations" and changes[0]["handwriting"] == "passionateness"
    assert changes[1]["position"] == len("all preparations may ")


def test_review_attaches_boxes_and_flags_disagreements():
    review = redline.build_review(READS)
    by_printed = {c["printed"]: c for c in review["changes"]}
    replacement = by_printed["preparations"]
    assert replacement["handwriting"] == "passionateness"
    assert replacement["box"] and 0 < replacement["box"]["left"] < 1
    assert "Reads disagree" in by_printed["thes"]["flags"]
    assert by_printed["thes"]["second_read"]["handwriting"] == "the"


def test_clean_text_applies_only_accepted_changes():
    review = redline.build_review(READS)
    change = next(c for c in review["changes"] if c["printed"] == "preparations")
    assert "all preparations may" in redline.clean_text(review, {})
    assert "all passionateness may" in redline.clean_text(review, {change["id"]: {"state": "accepted"}})
    assert "all preparations may" in redline.clean_text(review, {change["id"]: {"state": "rejected"}})


def test_reviewer_can_correct_the_type():
    change = {"kind": "substitution", "printed": "have", "handwriting": "engaging in"}
    assert redline.apply(change, {"state": "accepted"}) == "engaging in"
    assert redline.apply(change, {"state": "accepted", "kind": "insertion", "before": True}) == "engaging in have"
    assert redline.apply(change, {"state": "accepted", "kind": "deletion"}) == ""
    assert redline.apply(change, {"state": "accepted", "handwriting": "engage"}) == "engage"


def test_normalise_ignores_line_break_hyphens_and_case():
    assert redline.normalise("Con-\nsistently Be") == redline.normalise("consistently be")
    assert redline.normalise("[") == "["


def test_merge_pages_numbers_changes_and_boxes_by_page():
    page = redline.build_review(READS)
    merged = redline.merge_pages([page, page])
    assert len(merged["changes"]) == 2 * len(page["changes"])
    second = [c for c in merged["changes"] if c["id"].startswith("p2-")]
    assert second and all(c["box"] is None or c["box"]["page"] == 2 for c in second)
    ids = [s["change"] for s in merged["segments"] if "change" in s]
    assert len(ids) == len(set(ids))
