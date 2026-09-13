"""Build confidence_calibration.ipynb. Run once; the notebook itself is what's committed.

Kept as a script rather than hand-edited JSON so the notebook's structure stays reviewable
as a diff, the same reasoning as the rest of this recipe.
"""

import nbformat as nbf
from nbformat.v4 import new_code_cell, new_markdown_cell

OUT = "confidence_calibration.ipynb"

cells = []


def md(text):
    cells.append(new_markdown_cell(text.strip()))


def code(text):
    cells.append(new_code_cell(text.strip()))


md(
    """
# Confidence Calibration: Does the Threshold Hold?

Unsiloed's own blog, [*Confidence Score Reliability: The Missing Metric*](https://www.unsiloed.ai/blog/confidence-score-reliability-the-missing-metric-in-document-extraction),
tells buyers to ask every extraction vendor three questions:

1. Show me your confidence-versus-true-accuracy curve.
2. At what threshold do I hit sub-1% error on auto-accepted fields?
3. How stable is this across document variability?

And the cookbook itself ships four different answers to a question it never quite asks out loud —
what confidence counts as "trust this value":

| Where | Threshold |
|---|---|
| `skills/unsiloed/SKILL.md` | `score >= 0.85` |
| `skills/unsiloed-hitl-extract/SKILL.md` | `0.97`, called "deliberately stricter" |
| `kyc-app/app.py` | `LOW_CONF = 0.85` |
| `skills/unsiloed-hitl-extract/SKILL.md` | gate on `min(grounding_score, extraction_score)` |

None of the four is derived from data. The HITL skill even names the risk itself, at line 162:
if scores bunch in a narrow band around a threshold, picking a cutoff inside that band
"selects an arbitrary slice of near-identical scores, not the risky fields."

This notebook answers the three questions, measured rather than guessed. It generates a
corpus with known-correct values, degrades it from a clean PDF down to a phone photo, and
watches what happens to the confidence scores as the document gets harder to read.

---

### What it found

| | |
|---|---|
| **0.85 is safe on clean documents and not on degraded ones** | 0% error on a clean PDF (288 fields accepted). 43% on a phone photo, where it accepts 30. |
| **0.97 does not fix that; it stops answering** | 0% error on degraded tiers, but from 4 accepted fields out of 294. The interval on 0-of-4 reaches 49%. |
| **The two scores are interchangeable** | Separation 0.862 / 0.859 / 0.855, intervals overlapping. `min()` of the pair, which the HITL skill gates on, is no better. |
| **Degradation flips the bias, not just the noise** | Scanned-and-noisy is *under*confident (-0.26), photographed is *over*confident (+0.07). Only one of those costs you accuracy. |
| **Money fields break first, text survives** | On a phone photo: money 19% correct, IDs 35%, free text 84%. The fields worth extracting for are the ones that fail. |

Every rate below is reported with a 95% interval, and anything resting on fewer than 30
observations is marked as such. One consequence worth stating plainly up front: **no tier in
this corpus demonstrates sub-1% error at 95% confidence**, so question 2 does not get the
tidy number it asks for.
"""
)

md(
    """
## 1. Setup

Everything here reads cached results by default, so the notebook runs top to bottom with no
API key and no wait. Cells that would call Unsiloed's API are marked, and skipped unless you
delete the cache.
"""
)

code(
    """
%pip install pandas numpy matplotlib pillow pymupdf reportlab python-dotenv requests -q
"""
)

code(
    """
import json
import pathlib

import matplotlib.pyplot as plt
from PIL import Image

ROOT = pathlib.Path(".")
RESULTS = ROOT / "results"
DOCS = ROOT / "documents"
SAMPLES = ROOT / "samples"

print("Setup complete.")
"""
)

md(
    """
## 2. The Problem With Measuring Calibration

To know whether a confidence score is honest, you need the *right* answer for every field, to
compare against. Hand-labelling documents is slow, error-prone, and the results usually
cannot be published.

So the corpus is generated rather than collected. `corpus/generate.py` writes the values
first — an invoice number, a due date, a line-item table — and lays the document out second.
The ground truth is exact by construction, because we wrote it ourselves, and the whole
corpus is reproducible from a fixed seed.

Twelve documents: five invoices, four bank statements, three ID cards. Enough field variety
(money, dates, IDs, free text, table rows) that a finding has to hold across types, not just
happen to be true of one.
"""
)

code(
    """
truth = json.loads((DOCS / "invoice_01.truth.json").read_text())
print(json.dumps(truth, indent=2)[:600])
"""
)

md(
    """
## 3. The Difficulty Ladder

A fixed corpus cannot show how a threshold *should* move as quality drops, because every
document in it differs in content as well as condition. So the same generated document is
put through four tiers, holding content constant and varying only how hard it is to read:

| Tier | What happens | Simulates |
|---|---|---|
| **T0** | Nothing — the original PDF | downloaded from a portal |
| **T1** | Rasterised at 150dpi, text layer gone | printed and scanned |
| **T2** | + skew, sensor noise, soft blur | a tired office scanner |
| **T3** | + perspective tilt, glare, a hand shadow, heavy JPEG | photographed on a phone |

`samples/degradation_ladder.png` shows one invoice through all four. Look at the right-hand
edge of T3: the glare has wiped out the entire unit-price column, while the descriptions
next to it are still readable. That is deliberate — a tier that is uniformly unreadable
would test nothing, and a tier that damages nothing would show no curve.
"""
)

code(
    """
ladder = Image.open(SAMPLES / "degradation_ladder.png")
ladder
"""
)

md(
    """
## 4. The Real Half: CORD Receipts

The generated ladder isolates *how quality affects scores*, but it cannot say whether
Unsiloed's scores are honest on documents from the wild — every generated document is, in
the end, a document we designed to be extractable.

For that, this notebook also scores 92 real receipts from [CORD](https://github.com/clovaai/cord),
a benchmark of photographed Indonesian receipts released by NAVER CLOVA AI Research under
CC-BY-4.0, with ground truth published by the researchers who built it. Three examples are
committed under `samples/cord/`; the rest are downloaded by `corpus/cord.py`.
"""
)

code(
    """
sample_receipt = SAMPLES / "cord" / "receipt_002.jpg"
truth = json.loads((SAMPLES / "cord" / "receipt_002.truth.json").read_text())
print(json.dumps(truth, indent=2, ensure_ascii=False))
Image.open(sample_receipt)
"""
)

md(
    """
This receipt is photographed in poor light with a hand's shadow falling across the totals —
the SUB TOTAL line is barely legible even to a person. That is exactly the kind of document
a reliability measurement needs: one that can actually defeat an extractor, some of the time.
"""
)

md(
    """
## 5. Running the Extraction (skipped if cached)

140 extraction calls total: 12 documents × 4 tiers, plus 92 CORD receipts. Every response is
cached under `results/extractions/`, so this cell does nothing if the cache already exists —
which it does in this repo, so the notebook reproduces every figure below with zero API spend.

To run it fresh: delete `results/extractions/` and run `python -m calibration.run` from a
terminal (takes a few minutes, needs `UNSILOED_API_KEY` in `.env`).
"""
)

code(
    """
cached = list((RESULTS / "extractions").glob("*.json")) if (RESULTS / "extractions").exists() else []
print(f"{len(cached)} extraction responses cached. Re-run calibration.run to refresh.")
"""
)

md(
    """
## 6. Scoring: What Counts as Correct

Every extracted field is compared to ground truth with a normalisation rule specific to its
type — spelled out in `calibration/compare.py` rather than hidden in analysis code, because a
calibration result is only as honest as its definition of "correct":

- **money** — currency symbols and thousands separators stripped, compared as a decimal
- **date** — parsed to a date object, so `21/07/2026` and `2026-07-21` match
- **id** — spaces, dashes, and case folded
- **text** — case and whitespace folded

A comparison that stayed strict about formatting too would count a display choice Unsiloed
never claimed to preserve as an extraction failure — which would measure the wrong thing.
"""
)

code(
    """
import pandas as pd
import sys
sys.path.insert(0, "..")

from calibration.analyse import load_rows  # noqa: E402

frame = load_rows()
print(f"{len(frame)} scored fields across {frame['document'].nunique()} documents")
frame.groupby("tier")["correct"].agg(accuracy="mean", n="size")
"""
)

md(
    """
## 7. Finding 1 — Which Score Actually Predicts Correctness?

Unsiloed's own HITL skill gates on `min(grounding_score, extraction_score)`. Is that better
than using either score alone? Measured as separation: given one correct field and one
incorrect field, how often does the correct one score higher?

Note the scope: this finding uses **both corpora together** (1,176 generated fields and 1,096
CORD fields), because ranking two scores against each other benefits from every observation
available and should not depend on one corpus. Findings 2 through 5 below use the generated
corpus only, since they turn on the degradation tiers, which CORD does not have.
"""
)

code(
    """
Image.open(RESULTS / "figures" / "01_score_discrimination.png")
"""
)

md(
    """
**All three are equivalent.** The point estimates differ (0.862, 0.859, 0.855) but the 95%
bootstrap intervals overlap almost entirely: [0.834, 0.887], [0.833, 0.885], [0.827, 0.882].
Ranking them on those point estimates would be reading noise.

`grounding_score` and `extraction_score` answer different questions — was the value located,
was it read correctly once located — but neither is more trustworthy than the other for the
single decision that matters operationally: should this value be trusted without a human
looking at it? Notably `min(grounding, extraction)`, which the HITL skill gates on, is not
better than either score alone.
"""
)

md(
    """
## 8. Finding 2 — Are the Scores Calibrated?

A confidence score is calibrated if 0.9 confidence really does mean "90% of the time, this
is correct." The right panel plots mean confidence in a bucket against how often fields in
that bucket were actually correct. A perfectly calibrated score sits on the diagonal.

The left panel has to come first, though, because it explains why two of the four tiers have
no curve at all.
"""
)

code(
    """
Image.open(RESULTS / "figures" / "02_reliability_grounding.png")
"""
)

md(
    """
The left panel is the whole finding in one picture. Grey is how sure the score said it was;
pink is how often it was actually right. On the first three tiers pink is at least as tall as
grey, which is fine — the score is either honest or too modest. On T3 grey is taller. It
claimed 60% and delivered 52%.

**On T0 and T1 the score barely varies at all.** 288 of 294 clean-document fields land in a
single 0.9-1.0 bucket, and 289 of 294 scanned ones do. There is no calibration *curve* for
those tiers because there is nothing to curve, which is why they show up as single markers on
the right panel rather than lines. The score is trivially honest there: it says ~0.99 and it
is right ~99% of the time.

The scores only start to spread once the document degrades, and when they do, they are wrong
in two different directions:

- **T2 sits above the diagonal** — it is *under*confident. Fields scoring 0.57 were correct
  96% of the time. Trusting the number costs you coverage you did not need to give up.
- **T3 sits below it** — it is *over*confident. Fields scoring 0.86 were correct 69% of the
  time, and the Wilson intervals are wide enough that even that estimate is loose.

So degradation does not just add noise to the score. It flips the direction of the bias. A
0.86 means "better than it claims" on a noisy scan and "worse than it claims" on a phone
photo, which is precisely why one global threshold cannot serve both.

That direction is also why `results/calibration_error.csv` needs reading with care. Expected
calibration error takes an absolute value, so it scores T2 at 0.26 and T3 at 0.10 — ranking
T2 as the worse tier. But T2's gap is underconfidence, which costs coverage you did not need
to give up, while T3's smaller gap is overconfidence, which ships wrong values as correct.
The `signed_error` column is in that table for exactly this reason: for an accept/reject
decision, only one sign actually hurts you.
"""
)

md(
    """
## 9. Finding 3 — What Threshold Actually Gets Sub-1% Error?

For every possible threshold, what fraction of fields does it auto-accept, and what's the
error rate among what it accepts?
"""
)

code(
    """
Image.open(RESULTS / "figures" / "03_threshold_sweep.png")
"""
)

code(
    """
pd.read_csv(RESULTS / "sub_1pct_thresholds.csv")
"""
)

md(
    """
The honest answer to Unsiloed's second question is: **this corpus cannot demonstrate sub-1%
error on any tier**, and saying otherwise would be reading the point estimate and ignoring
the interval.

On **T0 and T1**, a threshold of 0.5 accepts ~99% of fields and gets zero errors out of 291.
That is as clean as this corpus gets, and its 95% upper bound is still 1.3%. Bounding error
under 1% needs roughly 300 error-free observations (rule of three), so we are just short.
Read it as "consistent with sub-1%, not proof of it."

On **T2**, no threshold reaches ≤1% observed error with at least 30 fields accepted. A filter
that only checked the observed rate would report 0.92 here, but that rests on 13 accepted
fields out of 294 — enough to look clean, nowhere near enough to support the claim. This is
why `sub_1pct_thresholds.csv` carries `n_accepted` and a `demonstrated` flag rather than a
bare threshold.

On **T3**, nothing comes close at any threshold. The overconfidence from Finding 2 means
there is no safe cutoff on badly degraded documents, only a trade-off between coverage and
risk.

The useful finding here is not a number. It is that the question "what threshold gets sub-1%
error" has no answer on degraded documents, and a corpus this size cannot honestly answer it
even on clean ones.
"""
)

md(
    """
## 10. Finding 4 — Do the Shipped Thresholds Survive?

The cookbook ships 0.85 and 0.97. Applied to each tier:
"""
)

code(
    """
Image.open(RESULTS / "figures" / "04_fixed_thresholds.png")
"""
)

code(
    """
pd.read_csv(RESULTS / "fixed_thresholds.csv")
"""
)

md(
    """
**0.85 is safe on T0 and T1 and unsafe everywhere else.** 0% error on clean and scanned
documents, out of 288 and 289 accepted fields respectively, so those zeros are real. Then 9%
on T2 and 43% on T3.

Two caveats on that 43%, both visible in the figure. It is 13 wrong out of 30 accepted, so
the 95% interval runs from 27% to 61% — the precise number is soft, though even the floor is
27 times the 1% target. And 0.85 only accepted 10% of T3 fields in the first place, so this
is the error rate among the fields it was *most* confident about.

**0.97 cannot be called safe on degraded documents.** It shows 0% error on T2 and T3, but
from 4 accepted fields out of 294. The Wilson interval on 0-out-of-4 runs to **49%** — those
are the two tall whiskers rising from nothing on the left panel, where the bar itself has no
height because the observed error is zero. The data is entirely consistent with 0.97 being as
dangerous as 0.85 here; there is simply not enough accepted to tell. What the measurement does
show is that 0.97 stops answering: 1.4% coverage, against 89% on a clean PDF.

So the contrast that matters is not 0.85 versus 0.97. It is that the same printed "0% error"
means *genuinely safe* at n=288 and *no information at all* at n=4. Treating 0.85 as a
universal bar, the way the `unsiloed` skill currently does, is the actual bug — not the
number itself.
"""
)

md(
    """
## 11. Finding 5 — Which Fields Break First?

Every finding so far treats a document as one number. It isn't. The damage lands very
unevenly across field types, and the pattern is the opposite of convenient.
"""
)

code(
    """
Image.open(RESULTS / "figures" / "05_field_type_accuracy.png")
"""
)

code(
    """
pd.read_csv(RESULTS / "field_type_accuracy.csv").pivot(
    index="field_type", columns="tier", values="accuracy"
).mul(100).round(1)
"""
)

md(
    """
On a phone photo, **money fields are read correctly 19% of the time while free text holds at
84%.** IDs land at 35%, dates at 75%. Currency codes never fail at all.

The ordering follows redundancy. `Pellham & Rowe` misread as `Pelham & Rowe` is still
recognisably the same company, and a currency code has a vocabulary of a few dozen options so
a damaged glyph is recoverable. An amount has none of that: `2578.64` read as `2578.84` is a
different number, silently, with nothing in the string to contradict it. Both appear in the
sample of misses if you inspect `scored_fields.csv`.

This inverts the usual intuition. The fields worth extracting an invoice *for* — the amounts,
the account numbers — are precisely the ones that degrade first, while the descriptive text
you care least about survives. An accuracy figure averaged over all fields hides this
completely: T3 looks like 52% overall, which is neither the 84% you get on text nor the 19%
you get on money.

**One more thing the data says:** across all four tiers, every one of the 294 ground-truth
fields came back with a value and a score. The extractor never declined. The only fields it
left empty were 14 cases across the whole corpus, and it scored every one of those 0.0, so
they fail any threshold. Total misses are signalled honestly. The danger is entirely in the
confident-but-wrong middle, which is exactly where a fixed threshold operates.
"""
)

md(
    """
## 12. What This Suggests

- **Route by document quality, not just by score.** A scanned or photographed document
  needs a stricter threshold than a clean PDF at the *same* nominal confidence — the number
  means less the worse the source image is.
- **`grounding_score` and `extraction_score` can be used interchangeably** for the
  accept/reject decision (Finding 1); the meaningful choice is the threshold and how it
  varies by document condition, not which of the two scores to read.
- **A single global default (0.85 or 0.97) cannot be correct for every input.** The
  cookbook's own skills should probably ask what kind of document is being processed before
  picking one.
- **Gate by field type as well as by document.** Money and ID fields on a degraded document
  are a different risk from free text on the same page (19% vs 84% correct on T3). A skill
  that routes every field through one number is throwing away the cheapest signal it has, and
  the field type is known before the call is even made.

## Limitations

- **The generated corpus is synthetic.** Exact ground truth and a controlled difficulty
  ladder are not possible with real, unlabelled documents — this is the trade made to get
  them. The degradation tiers were tuned by eye: T3 is meant to be genuinely hard but still
  legible to a person (see the sample above); a tier no one could read would be measuring an
  impossible task, not calibration.
- **CORD receipts are real but narrow** — Indonesian retail receipts, thermal-printed. They
  validate that miscalibration on hard documents is a real phenomenon, not an artefact of
  synthetic degradation, but the specific numbers may not transfer to, say, financial filings.
- **Some cells are thin, and the intervals are the honest part.** A high threshold on a
  degraded tier accepts very little: 0.85 on T3 accepts 30 fields, 0.97 accepts 4. Rates
  built on those are reported with Wilson intervals and marked unreliable below 30
  observations (dotted lines in Finding 3) rather than hidden. Read the direction of these
  findings as solid and the second decimal place as noise. Nothing here demonstrates sub-1%
  error at 95% confidence on *any* tier — see Finding 3.
- **Thresholds here are specific to this corpus.** The methodology — generate, degrade,
  measure — is the reusable part; a team should run it against their own documents rather
  than adopt these exact numbers.
- **Three CORD receipts are missing.** 95 were downloaded, 92 extracted; `receipt_048`
  through `receipt_050` failed API-side and were never retried. `calibration/run.py` reports
  failures and is resumable, so re-running retries only those. Counts here say 92 because
  that is what was measured.
- **Scores move between runs** as Unsiloed's models change in production. Treat the figures
  as indicative of the *shape* of the finding (thresholds do not travel across document
  quality) rather than as fixed targets. Results here are as of **2026-09-13**. This recipe
  doesn't set its own re-run cadence — that's a maintainer call — it just puts the date on
  record so the numbers don't quietly go stale unlabeled.

## Reproducing This

```bash
cd confidence-calibration
python -m corpus.generate     # 12 documents, ~5s
python -m corpus.degrade      # four tiers, ~10s
python -m corpus.cord         # 95 receipts, ~3min, needs no API key
python -m calibration.run     # 140 extractions, ~5min, needs UNSILOED_API_KEY
python -m calibration.analyse # figures + tables, ~30s, no API calls
```

## Related

- [Unsiloed extract API reference](https://docs.unsiloed.ai/api-reference/extraction/extract-data)
- [Confidence Score Reliability: The Missing Metric](https://www.unsiloed.ai/blog/confidence-score-reliability-the-missing-metric-in-document-extraction)
- [Claude + Unsiloed tool use](../claude/tool-use/) and [Gemini function calling](../gemini/function-calling/) — the two scores this notebook measures were first described there
"""
)

nb = nbf.v4.new_notebook()
nb["cells"] = cells
nb["metadata"] = {
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python", "version": "3.13"},
}
nbf.write(nb, OUT)
print(f"Wrote {OUT} with {len(cells)} cells")
