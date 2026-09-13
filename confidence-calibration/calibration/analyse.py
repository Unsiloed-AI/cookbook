"""The four outputs: which score to trust, the reliability diagram, the threshold sweep,
and whether a single global threshold survives document quality.

Reads every cached response in `results/extractions/`, scores each field against its ground
truth with `compare.py`, and writes the combined table plus four figures to `results/`. This
is the only module a reader needs to rerun to reproduce every number in the notebook, once
`run.py` has populated the cache.

Run: python -m calibration.analyse          (from confidence-calibration/)
"""

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from calibration.compare import score_rows  # noqa: E402
from corpus.cord import FIELD_TYPES as CORD_FIELD_TYPES  # noqa: E402
from corpus.degrade import TIERS  # noqa: E402
from corpus.schemas import FIELD_TYPES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = ROOT / "results"
EXTRACTIONS_DIR = RESULTS_DIR / "extractions"
FIGURES_DIR = RESULTS_DIR / "figures"
DOCS_DIR = ROOT / "documents"
CORD_DIR = DOCS_DIR / "cord"

TIER_LABELS = {"t0": "T0 clean PDF", "t1": "T1 scanned", "t2": "T2 scanned+noisy", "t3": "T3 photographed"}
# Sampled from unsiloed.ai and its own kyc-app demo rather than picked freehand. The site has
# no true red anywhere on it (checked): its most alarming tone is a rust that sits at the dark
# end of its own orange, #FC8108. So degradation is drawn as an intensity ramp within their
# actual palette (charcoal -> grey -> brand orange -> that rust) instead of a borrowed
# stoplight red/amber/green that doesn't exist in their identity.
TIER_COLOR = {"t0": "#242424", "t1": "#8a8a8a", "t2": "#FC8108", "t3": "#C44A0F"}
# T0 and T1 land on almost identical curves. Without distinct dash patterns one is drawn
# entirely underneath the other and the figure silently shows three lines for four tiers.
TIER_STYLE = {"t0": "-", "t1": (0, (4, 2)), "t2": "-", "t3": "-"}

# Reserved palettes. TIER_COLOR means document quality and nothing else, so figures whose
# subject is not a tier (the three scores, the two thresholds) use these instead. Reusing the
# tier colours there made green/blue/gold read as T0/T1/T2 on charts that have no tier axis.
# #F861A8 is unsiloed.ai's own primary brand accent (their homepage hero, ~90 uses).
SCORE_COLOR = "#F861A8"
THRESHOLD_COLOR = {0.85: "#F861A8", 0.97: "#F8A9C8"}

# Below this many observations a rate is noise, not a measurement. At threshold 0.96 the
# T3 accepted set is 4 fields; plotting its 0% error the same weight as an n=291 point is
# what made the right-hand edge of the sweep look like a cliff rather than exhausted data.
MIN_N = 30


def wilson_interval(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson score interval for a binomial proportion.

    Preferred over the normal approximation because it stays inside [0, 1] and keeps
    meaningful width at the small n and near-0/near-1 rates this harness runs into.
    """
    if n == 0:
        return (float("nan"), float("nan"))
    p = successes / n
    denominator = 1 + z**2 / n
    centre = (p + z**2 / (2 * n)) / denominator
    half_width = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / denominator
    return (max(0.0, centre - half_width), min(1.0, centre + half_width))

plt.rcParams.update(
    {
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        # #242424 is unsiloed.ai's own text colour; #969696 and #E9E9E9 are real neutrals
        # from the same page rather than generic matplotlib greys.
        "axes.edgecolor": "#969696",
        "axes.labelcolor": "#242424",
        "text.color": "#242424",
        "xtick.color": "#6b6b6b",
        "ytick.color": "#6b6b6b",
        "font.size": 11,
        "axes.grid": True,
        "grid.color": "#E9E9E9",
        "grid.linewidth": 0.7,
    }
)


def load_rows() -> pd.DataFrame:
    """Score every cached extraction against its ground truth and return one long table."""
    records = []

    for truth_file in sorted(DOCS_DIR.glob("*.truth.json")):
        stem = truth_file.name.removesuffix(".truth.json")
        truth = json.loads(truth_file.read_text(encoding="utf-8"))
        for tier in TIERS:
            cache = EXTRACTIONS_DIR / f"{stem}__{tier}.json"
            if not cache.exists():
                continue
            result = json.loads(cache.read_text(encoding="utf-8"))["response"]["result"]
            context = {
                "corpus": "generated",
                "document": stem,
                "doc_type": truth["doc_type"],
                "tier": tier,
            }
            records.extend(
                score_rows(result, truth["fields"], FIELD_TYPES[truth["doc_type"]], context)
            )

    for truth_file in sorted(CORD_DIR.glob("*.truth.json")):
        stem = truth_file.name.removesuffix(".truth.json")
        cache = EXTRACTIONS_DIR / f"cord_{stem}.json"
        if not cache.exists():
            continue
        truth = json.loads(truth_file.read_text(encoding="utf-8"))
        result = json.loads(cache.read_text(encoding="utf-8"))["response"]["result"]
        context = {"corpus": "cord", "document": stem, "doc_type": "receipt", "tier": "real"}
        records.extend(score_rows(result, truth["fields"], CORD_FIELD_TYPES, context))

    frame = pd.DataFrame(records)
    frame = frame[frame["correct"].notna()].copy()
    frame["correct"] = frame["correct"].astype(bool)
    frame["min_score"] = frame[["grounding_score", "extraction_score"]].min(axis=1)
    return frame


# ---------------------------------------------------------------------------
# Output 1: which score predicts correctness
# ---------------------------------------------------------------------------


def score_discrimination(frame: pd.DataFrame) -> pd.DataFrame:
    """AUC-style separation: for each candidate score, P(correct row scores higher than
    incorrect row). 0.5 is a coin flip, 1.0 perfectly separates the two."""
    rows = []
    for label, column in [
        ("grounding_score", "grounding_score"),
        ("extraction_score", "extraction_score"),
        ("min(grounding, extraction)", "min_score"),
    ]:
        correct = frame.loc[frame["correct"], column].dropna().to_numpy()
        wrong = frame.loc[~frame["correct"], column].dropna().to_numpy()
        counts = {"n_correct": len(correct), "n_wrong": len(wrong)}
        if len(correct) == 0 or len(wrong) == 0:
            rows.append({"score": label, "separation": float("nan"), **counts})
            continue
        # Vectorised Mann-Whitney U / n1*n2: the AUC of using this score as a
        # correct-vs-wrong classifier.
        wins = (correct[:, None] > wrong[None, :]).mean()
        ties = (correct[:, None] == wrong[None, :]).mean()
        separation = wins + 0.5 * ties

        # Bootstrap the separation so the three scores can be compared honestly. Printed bare,
        # 0.835 vs 0.823 invites the reader to pick a winner; the intervals overlap almost
        # entirely, which is the actual finding.
        rng = np.random.default_rng(0)
        boot = []
        for _ in range(400):
            c = rng.choice(correct, size=len(correct), replace=True)
            w = rng.choice(wrong, size=len(wrong), replace=True)
            boot.append((c[:, None] > w[None, :]).mean() + 0.5 * (c[:, None] == w[None, :]).mean())
        low, high = np.percentile(boot, [2.5, 97.5])

        rows.append(
            {"score": label, "separation": separation, "ci_low": low, "ci_high": high, **counts}
        )
    return pd.DataFrame(rows)


def plot_score_discrimination(table: pd.DataFrame, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(8, 4))
    # One colour for all three: the finding is that they are interchangeable, and three
    # different colours invite the reader to pick a winner the intervals do not support.
    colors = [SCORE_COLOR] * len(table)
    xerr = np.array([
        table["separation"] - table["ci_low"],
        table["ci_high"] - table["separation"],
    ])
    bars = ax.barh(
        table["score"], table["separation"], color=colors,
        xerr=xerr, capsize=4,
        error_kw={"ecolor": "#333333", "elinewidth": 1.2},
    )
    ax.axvline(0.5, color="#999999", linewidth=1, linestyle="--")
    ax.set_xlim(0.4, 1.0)
    # Two lines: the single-line version was clipped at the figure edge.
    ax.set_xlabel(
        "Separation: P(a correct field scores higher than an incorrect one)\n"
        "0.5 = coin flip, 1.0 = perfect. Bars are 95% bootstrap intervals."
    )
    ax.set_title("Which score actually predicts correctness?")
    for bar, row in zip(bars, table.itertuples(), strict=True):
        ax.text(row.ci_high + 0.012, bar.get_y() + bar.get_height() / 2,
                f"{row.separation:.3f}", va="center", fontsize=9)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Output 2: reliability diagram
# ---------------------------------------------------------------------------


def reliability_table(frame: pd.DataFrame, column: str, n_bins: int = 10) -> pd.DataFrame:
    working = frame.dropna(subset=[column]).copy()
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    working["bin"] = pd.cut(working[column], edges, include_lowest=True)
    grouped = working.groupby(["tier", "bin"], observed=True).agg(
        confidence=(column, "mean"), accuracy=("correct", "mean"), n=("correct", "size")
    )
    return grouped.reset_index()


def expected_calibration_error(frame: pd.DataFrame, column: str, n_bins: int = 10) -> pd.DataFrame:
    """ECE plus the signed error it throws away.

    ECE takes an absolute value, so it ranks a large safe miscalibration above a small
    dangerous one. T2 here is underconfident by 0.26 and T3 overconfident by 0.07: ECE calls
    T2 the worse tier, while the tier that actually ships wrong values as correct is T3.
    The signed column keeps that direction visible, because only one sign costs you accuracy.
    """
    rows = []
    for tier, group in frame.dropna(subset=[column]).groupby("tier"):
        table = reliability_table(group.assign(tier=tier), column, n_bins)
        total = table["n"].sum()
        if total == 0:
            continue
        gap = table["confidence"] - table["accuracy"]
        ece = (table["n"] * gap.abs()).sum() / total
        signed = (table["n"] * gap).sum() / total
        rows.append(
            {
                "tier": tier,
                "score": column,
                "ece": ece,
                "signed_error": signed,
                "direction": "overconfident" if signed > 0 else "underconfident",
                "n": total,
            }
        )
    return pd.DataFrame(rows)


def plot_reliability_diagram(frame: pd.DataFrame, column: str, path: Path, title: str) -> None:
    """Plain-language claim-vs-reality on the left, the technical reliability curve on the right.

    The left panel is the one a reader with no context should be able to read unaided: what the
    score claimed on average, next to how often it was actually right. An earlier version put a
    score histogram here, which showed the same underlying fact (T0/T1 have almost no spread)
    but required the reader to already know what they were looking for.
    """
    fig, (ax_plain, ax) = plt.subplots(1, 2, figsize=(13.5, 5.5))
    tiers = [t for t in TIERS if t in frame["tier"].unique()]

    claimed, actual = [], []
    for tier in tiers:
        sub = frame[frame["tier"] == tier].dropna(subset=[column])
        claimed.append(sub[column].mean() * 100)
        actual.append(sub["correct"].mean() * 100)

    x = np.arange(len(tiers))
    width = 0.36
    # Neutral grey for the claim, brand pink for the measured outcome: pink is the thing this
    # whole recipe is actually checking, so it gets the colour that draws the eye.
    ax_plain.bar(x - width / 2, claimed, width, color="#969696", label="How sure the score said it was")
    ax_plain.bar(x + width / 2, actual, width, color=SCORE_COLOR, label="How often it was actually right")

    for xi, (c, a) in enumerate(zip(claimed, actual, strict=True)):
        ax_plain.text(xi - width / 2, c + 1.5, f"{c:.0f}%", ha="center", fontsize=9)
        ax_plain.text(xi + width / 2, a + 1.5, f"{a:.0f}%", ha="center", fontsize=9)
        # Only overconfidence is dangerous: it means wrong values get accepted. Underconfidence
        # (T2) just costs coverage you didn't need to give up. Both get a label so the reader
        # sees the asymmetry rather than noticing only the alarming half.
        # Anchor to the tier's own bars: centred free text drifted between neighbouring tiers
        # and read as if it might belong to either.
        if c - a > 2:
            ax_plain.annotate(
                "over-promises\n(dangerous)", xy=(xi, max(c, a)), xytext=(xi, max(c, a) + 14),
                ha="center", fontsize=8, color=TIER_COLOR["t3"], fontweight="bold",
                arrowprops={"arrowstyle": "->", "color": TIER_COLOR["t3"], "linewidth": 1.2},
            )
        elif a - c > 2:
            ax_plain.annotate(
                "under-promises\n(safe, just costly)", xy=(xi, max(c, a)), xytext=(xi, max(c, a) + 14),
                # Grey, not green: the brand has no green, and "safe" here just means "no alarm needed",
                # which the neutral T0 tone says better than an implied stoplight would.
                ha="center", fontsize=8, color=TIER_COLOR["t0"], fontweight="bold",
                arrowprops={"arrowstyle": "->", "color": TIER_COLOR["t0"], "linewidth": 1.2},
            )

    ax_plain.set_xticks(x, [TIER_LABELS[t] for t in tiers], fontsize=8.5, rotation=12)
    ax_plain.set_ylabel("Percent")
    # Headroom for the two-line callouts, which sit 14 above the taller bar (so ~110 on T2)
    # and need room for the text itself. Tight limits collided with the title; 148 left a
    # third of the panel empty.
    ax_plain.set_ylim(0, 128)
    ax_plain.set_title("What the score promised vs what it delivered")
    ax_plain.legend(fontsize=8.5, loc="lower left")

    ax.plot([0, 1], [0, 1], color="#999999", linestyle="--", linewidth=1, label="perfect calibration")

    for tier in tiers:
        table = reliability_table(frame[frame["tier"] == tier], column)
        table = table[table["n"] >= MIN_N]
        if table.empty:
            continue

        # One surviving bucket cannot describe a curve, so it is drawn as a lone marker rather
        # than a one-point "line" that reads as a missing series. T0 and T1 land within 0.0003
        # of each other, so hollow markers at different radii keep both visible without nudging
        # either off its measured position.
        single_bucket = len(table) == 1
        ax.plot(
            table["confidence"], table["accuracy"],
            marker="D" if single_bucket else "o",
            markersize=10 - 3 * TIERS.index(tier) if single_bucket else 6,
            markerfacecolor="none" if single_bucket else TIER_COLOR[tier],
            markeredgewidth=2 if single_bucket else 1,
            linestyle="none" if single_bucket else TIER_STYLE[tier],
            color=TIER_COLOR[tier],
            label=f"{TIER_LABELS[tier]} (one bucket only)" if single_bucket else TIER_LABELS[tier],
            zorder=5 if single_bucket else 3,
        )
        # T0 and T1 land within 0.0003 of each other, so their single-bucket labels start from
        # nearly the same pixel. Send them in opposite directions, not just different amounts,
        # so they clear each other regardless of font metrics.
        # These markers sit at x≈0.99, hard against the right spine, so a positive x offset
        # puts the label outside the axes. Anchor them to the left of the marker instead.
        if single_bucket:
            label_offset = (-10, 10) if tier == "t1" else (-10, -20)
        else:
            label_offset = (4, -10)
        label_align = "right" if single_bucket else "left"
        for _, row in table.iterrows():
            successes = int(round(row["n"] * row["accuracy"]))
            lower, upper = wilson_interval(successes, int(row["n"]))
            ax.vlines(row["confidence"], lower, upper,
                      color=TIER_COLOR[tier], alpha=0.3, linewidth=1.5)
            ax.annotate(f"n={int(row['n'])}", (row["confidence"], row["accuracy"]),
                        fontsize=7, color=TIER_COLOR[tier], ha=label_align,
                        xytext=label_offset, textcoords="offset points")

    # x stays near [0, 1]: this axis is a score, and padding it out reads as if scores could
    # exceed 1. The labels already point left (toward lower x), so only y needs headroom: the
    # T1 label sits above a point at y~0.99 and was landing close enough to the top frame to
    # look clipped.
    ax.set_xlim(-0.02, 1.04)
    ax.set_ylim(-0.02, 1.18)
    ax.set_xlabel("Score it gave (averaged within each band)")
    ax.set_ylabel("How often those were right")
    ax.set_title("Same data, in detail (on the dashed line = honest)")
    ax.legend(loc="lower right", fontsize=8)

    fig.suptitle(title, fontsize=13)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)

# ---------------------------------------------------------------------------
# Output 3: threshold sweep
# ---------------------------------------------------------------------------


def threshold_sweep(frame: pd.DataFrame, column: str, thresholds=None) -> pd.DataFrame:
    thresholds = thresholds if thresholds is not None else np.round(np.arange(0.5, 1.0, 0.02), 2)
    rows = []
    for tier in [t for t in TIERS if t in frame["tier"].unique()]:
        tier_frame = frame[frame["tier"] == tier].dropna(subset=[column])
        total = len(tier_frame)
        if total == 0:
            continue
        for threshold in thresholds:
            accepted = tier_frame[tier_frame[column] >= threshold]
            error_rate = 1.0 - accepted["correct"].mean() if len(accepted) else float("nan")
            n_wrong = int((~accepted["correct"]).sum()) if len(accepted) else 0
            ci_low, ci_high = wilson_interval(n_wrong, len(accepted))
            rows.append(
                {
                    "tier": tier,
                    "threshold": threshold,
                    "coverage": len(accepted) / total,
                    "error_rate": error_rate,
                    "error_ci_low": ci_low,
                    "error_ci_high": ci_high,
                    "n_accepted": len(accepted),
                }
            )
    return pd.DataFrame(rows)


def sub_1pct_thresholds(sweep: pd.DataFrame) -> pd.DataFrame:
    """Lowest threshold whose accepted set has under 1% observed error, with the caveat.

    The observed rate is not the same as a demonstrated rate. Bounding error below 1% at 95%
    confidence needs roughly 300 clean observations (rule of three: the upper bound on 0/n is
    about 3/n). Nothing in this corpus reaches that — T0 at 0.5 accepts 291 fields with zero
    errors and still carries a 1.3% upper bound. So `error_ci_high` ships alongside, and
    `demonstrated` says whether the bound actually clears 1% rather than just the point
    estimate. Answering Unsiloed's "what threshold gets sub-1% error" honestly means saying
    that this corpus is consistent with sub-1% on clean documents but cannot prove it.
    """
    rows = []
    for tier, group in sweep.groupby("tier"):
        safe = group[(group["error_rate"] <= 0.01) & (group["n_accepted"] >= MIN_N)]
        if safe.empty:
            rows.append(
                {
                    "tier": tier, "threshold": float("nan"), "coverage": float("nan"),
                    "n_accepted": 0, "error_ci_high": float("nan"), "demonstrated": False,
                    "note": f"no threshold reached <=1% observed error with n>={MIN_N}",
                }
            )
            continue
        best = safe.sort_values("threshold").iloc[0]
        ci_high = best["error_ci_high"] if "error_ci_high" in best else float("nan")
        demonstrated = bool(ci_high <= 0.01)
        rows.append(
            {
                "tier": tier,
                "threshold": best["threshold"],
                "coverage": best["coverage"],
                "n_accepted": int(best["n_accepted"]),
                "error_ci_high": ci_high,
                "demonstrated": demonstrated,
                "note": "" if demonstrated else "observed <=1%, but interval does not exclude 1%",
            }
        )
    return pd.DataFrame(rows)


def plot_threshold_sweep(sweep: pd.DataFrame, path: Path) -> None:
    fig, (ax_cov, ax_err) = plt.subplots(1, 2, figsize=(12, 4.5))
    for tier in [t for t in TIERS if t in sweep["tier"].unique()]:
        table = sweep[sweep["tier"] == tier]
        label, color, style = TIER_LABELS[tier], TIER_COLOR[tier], TIER_STYLE[tier]
        # Coverage is a fraction of a fixed denominator, so it stays meaningful at every
        # threshold and is drawn unbroken.
        # Percent, to match the error panel beside it and the coverage panel in figure 4.
        ax_cov.plot(table["threshold"], table["coverage"] * 100, color=color, label=label,
                    linestyle=style)

        # Error rate is only as trustworthy as the accepted set is large. Draw it solid while
        # n >= MIN_N and dotted below, rather than truncating: a line that simply stops reads
        # as broken data, while a dotted continuation reads as "still here, no longer reliable".
        solid = table[table["n_accepted"] >= MIN_N]
        ax_err.plot(
            solid["threshold"], solid["error_rate"] * 100,
            color=color, label=label, linestyle=style, linewidth=2,
        )
        if not solid.empty:
            # Start the dotted run at the last solid point so the segments join up.
            thin = table[table["threshold"] >= solid["threshold"].max()]
            ax_err.plot(
                thin["threshold"], thin["error_rate"] * 100,
                color=color, linestyle=":", linewidth=1.5, alpha=0.6,
            )

    ax_cov.set_xlabel("Threshold")
    ax_cov.set_ylabel("Coverage (fields auto-accepted), %")
    ax_cov.set_title("How much gets auto-accepted")
    ax_cov.set_ylim(0, 102)

    ax_err.axhline(1.0, color="#999999", linestyle="--", linewidth=1)
    ax_err.plot([], [], color="#666666", linestyle=":", linewidth=1.5,
                label=f"fewer than {MIN_N} fields accepted")
    ax_err.set_xlabel("Threshold")
    ax_err.set_ylabel("Error rate among accepted, %")
    ax_err.set_ylim(-2, 50)
    ax_err.set_title("Error rate among what gets through")
    ax_err.legend(fontsize=8, loc="upper left")

    fig.suptitle("Is there one threshold that works everywhere?", fontsize=13)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Output 4: does one global threshold survive quality
# ---------------------------------------------------------------------------


def fixed_threshold_table(frame: pd.DataFrame, column: str, thresholds=(0.85, 0.97)) -> pd.DataFrame:
    rows = []
    for tier in [t for t in TIERS if t in frame["tier"].unique()]:
        tier_frame = frame[frame["tier"] == tier].dropna(subset=[column])
        for threshold in thresholds:
            accepted = tier_frame[tier_frame[column] >= threshold]
            error_rate = 1.0 - accepted["correct"].mean() if len(accepted) else float("nan")
            # Wilson bounds on the error rate. Without them a 0% built from 4 accepted fields
            # reads as "safe", when its upper bound is ~49% and the tier is simply abstaining.
            n_wrong = int((~accepted["correct"]).sum())
            lower, upper = wilson_interval(n_wrong, len(accepted))
            rows.append(
                {
                    "tier": tier,
                    "threshold": threshold,
                    "coverage": len(accepted) / len(tier_frame) if len(tier_frame) else float("nan"),
                    "error_rate": error_rate,
                    "error_ci_low": lower,
                    "error_ci_high": upper,
                    "n_accepted": len(accepted),
                    "n": len(tier_frame),
                }
            )
    return pd.DataFrame(rows)


def plot_fixed_thresholds(table: pd.DataFrame, path: Path) -> None:
    """Error rate and coverage side by side.

    Error rate alone makes 0.97 look like a free fix, because it reaches 0% on every tier.
    It only gets there by accepting 4 fields out of 294. Coverage is the half of the story
    that turns "0.97 is safe" into "0.97 declines to answer", so both panels ship together.
    """
    fig, (ax_err, ax_cov) = plt.subplots(1, 2, figsize=(12, 4.8))
    tiers = [t for t in TIERS if t in table["tier"].unique()]
    x = np.arange(len(tiers))
    width = 0.35
    thresholds = sorted(table["threshold"].unique())
    colors = {t: THRESHOLD_COLOR.get(t, "#7d3c98") for t in thresholds}

    for offset, threshold in zip((-width / 2, width / 2), thresholds, strict=True):
        rows = [table[(table["tier"] == t) & (table["threshold"] == threshold)].iloc[0] for t in tiers]
        errors = [r["error_rate"] * 100 for r in rows]
        coverage = [r["coverage"] * 100 for r in rows]
        accepted = [int(r["n_accepted"]) for r in rows]

        # Asymmetric Wilson bars. The 0.97 bars are zero-height, so without these they read as
        # certain zeros rather than as four fields that happened to come out right.
        yerr = np.array([
            [r["error_rate"] * 100 - r["error_ci_low"] * 100 for r in rows],
            [r["error_ci_high"] * 100 - r["error_rate"] * 100 for r in rows],
        ])
        bars = ax_err.bar(x + offset, errors, width, color=colors[threshold],
                          label=f"threshold {threshold:g}",
                          yerr=yerr, capsize=3,
                          error_kw={"ecolor": "#555555", "elinewidth": 1, "alpha": 0.7})
        # Label with fields actually accepted, not the tier total: a 0% error bar built from
        # 4 accepted fields and one built from 288 mean completely different things. Anchor
        # above the interval's top, not the bar's, so the text never sits on the whisker.
        ci_highs = [r["error_ci_high"] * 100 for r in rows]
        for bar, value, n, top in zip(bars, errors, accepted, ci_highs, strict=True):
            ax_err.text(bar.get_x() + bar.get_width() / 2, top + 1.2,
                        f"{value:.0f}%\nn={n}", ha="center", va="bottom", fontsize=7.5)

        cov_bars = ax_cov.bar(x + offset, coverage, width, color=colors[threshold],
                              label=f"threshold {threshold:g}")
        for bar, value in zip(cov_bars, coverage, strict=True):
            ax_cov.text(bar.get_x() + bar.get_width() / 2, value + 1.5,
                        f"{value:.0f}%", ha="center", va="bottom", fontsize=7.5)

    ax_err.axhline(1.0, color=TIER_COLOR["t3"], linestyle="--", linewidth=1.2, label="1% error target")
    # The whisker reaching to 49% on the 4-field bars is the point of this chart. A reader
    # sharing just the PNG, with no surrounding prose, needs the legend to say what it is.
    ax_err.errorbar([], [], yerr=1, fmt="none", ecolor="#555555", capsize=3,
                    label="95% interval (Wilson)")
    ax_err.set_xticks(x, [TIER_LABELS[t] for t in tiers], rotation=15, ha="right")
    ax_err.set_ylabel("Error rate among accepted, %")
    # Derived from the data, never hardcoded. A fixed cap silently truncated the T3 0.85
    # interval, whose upper bound is 60.8%, which made the headline 43% look more precise
    # than it is: the opposite of what plotting intervals is for. Headroom for the labels,
    # which now sit above each interval's top.
    ax_err.set_ylim(0, table["error_ci_high"].max() * 100 + 14)
    ax_err.set_title("Error rate among what gets accepted")
    ax_err.legend(fontsize=8)

    ax_cov.set_xticks(x, [TIER_LABELS[t] for t in tiers], rotation=15, ha="right")
    ax_cov.set_ylabel("Coverage (fields auto-accepted), %")
    ax_cov.set_ylim(0, 112)
    ax_cov.set_title("How much it actually accepts")
    ax_cov.legend(fontsize=8)

    fig.suptitle("Do the shipped thresholds (0.85 / 0.97) hold up as quality drops?", fontsize=13)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Output 5: which kinds of field break first
# ---------------------------------------------------------------------------


def field_type_accuracy(frame: pd.DataFrame) -> pd.DataFrame:
    """Accuracy per field type per tier, long form."""
    rows = []
    for (tier, field_type), group in frame.groupby(["tier", "field_type"]):
        successes = int(group["correct"].sum())
        low, high = wilson_interval(successes, len(group))
        rows.append(
            {
                "tier": tier,
                "field_type": field_type,
                "accuracy": group["correct"].mean(),
                "ci_low": low,
                "ci_high": high,
                "n": len(group),
            }
        )
    return pd.DataFrame(rows)


def plot_field_type_accuracy(table: pd.DataFrame, path: Path) -> None:
    """Which field types survive degradation, ordered by how badly they fall.

    A single headline accuracy per tier hides the thing an integrator most needs: the damage
    is not spread evenly. Digits carry no redundancy, so a one-character misread is
    unrecoverable, while a misread word is usually still recognisable.
    """
    tiers = [t for t in TIERS if t in table["tier"].unique()]
    pivot = table.pivot(index="field_type", columns="tier", values="accuracy")
    pivot = pivot.reindex(columns=tiers).sort_values(tiers[-1], ascending=False)

    fig, ax = plt.subplots(figsize=(9, 5))
    x = np.arange(len(pivot.index))
    width = 0.8 / len(tiers)
    for offset_index, tier in enumerate(tiers):
        offset = (offset_index - (len(tiers) - 1) / 2) * width
        values = pivot[tier].to_numpy() * 100
        bars = ax.bar(x + offset, values, width, color=TIER_COLOR[tier], label=TIER_LABELS[tier])
        if tier == tiers[-1]:
            for bar, value in zip(bars, values, strict=True):
                ax.text(bar.get_x() + bar.get_width() / 2, value + 1.5,
                        f"{value:.0f}%", ha="center", fontsize=8, fontweight="bold")

    ax.set_xticks(x, pivot.index, fontsize=10)
    ax.set_ylabel("Fields read correctly, %")
    ax.set_ylim(0, 112)
    ax.set_title("Which kinds of field survive a phone photo?")
    ax.legend(fontsize=8.5, ncol=2)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def main() -> None:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    frame = load_rows()
    frame.to_csv(RESULTS_DIR / "scored_fields.csv", index=False)
    print(f"Scored {len(frame)} fields across {frame['document'].nunique()} documents")
    print(frame.groupby("tier")["correct"].agg(["mean", "size"]))

    discrimination = score_discrimination(frame)
    discrimination.to_csv(RESULTS_DIR / "score_discrimination.csv", index=False)
    plot_score_discrimination(discrimination, FIGURES_DIR / "01_score_discrimination.png")
    print("\n[1] score discrimination:\n", discrimination)

    generated = frame[frame["corpus"] == "generated"]
    plot_reliability_diagram(
        generated, "grounding_score", FIGURES_DIR / "02_reliability_grounding.png",
        "Does the confidence score tell the truth as documents get worse?",
    )
    ece = expected_calibration_error(generated, "grounding_score")
    ece.to_csv(RESULTS_DIR / "calibration_error.csv", index=False)
    print("\n[2] expected calibration error (grounding_score):\n", ece)

    sweep = threshold_sweep(generated, "grounding_score")
    sweep.to_csv(RESULTS_DIR / "threshold_sweep.csv", index=False)
    plot_threshold_sweep(sweep, FIGURES_DIR / "03_threshold_sweep.png")
    safe = sub_1pct_thresholds(sweep)
    safe.to_csv(RESULTS_DIR / "sub_1pct_thresholds.csv", index=False)
    print("\n[3] sub-1% threshold per tier:\n", safe)

    fixed = fixed_threshold_table(generated, "grounding_score")
    fixed.to_csv(RESULTS_DIR / "fixed_thresholds.csv", index=False)
    plot_fixed_thresholds(fixed, FIGURES_DIR / "04_fixed_thresholds.png")
    print("\n[4] shipped thresholds (0.85 / 0.97) across tiers:\n", fixed)

    by_type = field_type_accuracy(generated)
    by_type.to_csv(RESULTS_DIR / "field_type_accuracy.csv", index=False)
    plot_field_type_accuracy(by_type, FIGURES_DIR / "05_field_type_accuracy.png")
    print("\n[5] accuracy by field type:\n",
          (by_type.pivot(index="field_type", columns="tier", values="accuracy") * 100).round(1))

    print(f"\nFigures written to {FIGURES_DIR}")


if __name__ == "__main__":
    main()
