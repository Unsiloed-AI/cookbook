"""The difficulty ladder: one document, four levels of physical damage, identical content.

The real corpus tells us whether confidence scores hold up on documents from the wild. It
cannot tell us how a threshold should move as quality drops, because every receipt in it
differs in content as well as condition, and the two cannot be separated after the fact.

This does separate them. The same generated document is put through four tiers, so any change
in the scores is attributable to condition alone. That is the only way to ask whether a fixed
cutoff like 0.85 means the same thing on a clean PDF as it does on a phone photo.

    T0  the original digital PDF, as downloaded from a portal
    T1  rasterised at 150 dpi, the text layer gone, OCR now compulsory
    T2  plus a 1.5 degree skew, sensor noise and soft focus, a tired office scanner
    T3  plus JPEG compression, glare and a hand shadow, photographed on a phone

Tier parameters are fixed constants rather than random draws, so the ladder is identical on
every machine and a reviewer can reproduce a figure exactly.

Run: python -m corpus.degrade          (from confidence-calibration/)
"""

from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageEnhance, ImageFilter

DOCS_DIR = Path(__file__).resolve().parent.parent / "documents"
OUT_DIR = DOCS_DIR / "degraded"

RASTER_DPI = 150  # a common office scanner default

# Tier parameters were tuned against a readability target rather than picked for looks. What
# breaks OCR in practice is not resolution on its own but small glyphs combined with blur,
# compression and uneven light, so each tier is set by the x-height it leaves behind: roughly
# 16px at T1, 11px at T2 and 7px at T3, the last being about where character shapes stop being
# separable. A ladder whose bottom rung is still trivially readable measures nothing.
T2 = {"skew": 2.5, "blur": 1.4, "noise": 16.0, "scale": 0.70, "contrast": 0.86}
T3 = {"skew": 1.2, "blur": 1.25, "noise": 18.0, "scale": 0.60, "contrast": 0.80, "jpeg": 32}

# Tuned down from a first pass that blew the amounts out entirely. A tier no person can read
# stops measuring whether confidence tracks correctness and starts measuring an impossible
# task, which would make every score on it meaningless rather than interesting.
GLARE_STRENGTH = 0.50
SHADOW_STRENGTH = 0.40

TIERS = ("t0", "t1", "t2", "t3")


def render(pdf_path: Path, dpi: int = RASTER_DPI) -> Image.Image:
    """Rasterise page one. The text layer does not survive, which is the point of T1."""
    with pymupdf.open(pdf_path) as doc:
        pix = doc[0].get_pixmap(dpi=dpi)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def add_skew(image: Image.Image, degrees: float) -> Image.Image:
    """Rotate on a white ground, as a page sitting crooked on the glass would scan."""
    return image.rotate(
        degrees, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255)
    )


def add_noise(image: Image.Image, sigma: float, seed: int = 7) -> Image.Image:
    """Gaussian sensor noise, seeded so the ladder is identical on every machine."""
    rng = np.random.default_rng(seed)
    array = np.asarray(image, dtype=np.float32)
    noisy = array + rng.normal(0.0, sigma, array.shape)
    return Image.fromarray(np.clip(noisy, 0, 255).astype(np.uint8))


def _perspective_coefficients(source: list, target: list) -> list:
    """Solve the eight coefficients PIL needs to map output corners back to input corners."""
    matrix = []
    for (sx, sy), (tx, ty) in zip(source, target, strict=True):
        matrix.append([tx, ty, 1, 0, 0, 0, -sx * tx, -sx * ty])
        matrix.append([0, 0, 0, tx, ty, 1, -sy * tx, -sy * ty])
    a = np.array(matrix, dtype=np.float64)
    b = np.array([c for point in source for c in point], dtype=np.float64)
    return np.linalg.solve(a, b).tolist()


def add_perspective(image: Image.Image, strength: float = 0.035) -> Image.Image:
    """Tilt the page away from the lens, the way a photo taken over a desk sees it.

    Rotation alone is what a scanner does. A phone held at an angle also foreshortens one
    edge, so glyph height varies down the page and a single deskew cannot put it right.
    """
    width, height = image.size
    dx, dy = width * strength, height * strength * 0.45
    corners = [(0, 0), (width, 0), (width, height), (0, height)]
    tilted = [(dx, dy * 0.6), (width - dx * 0.35, 0), (width, height - dy), (dx * 0.5, height)]
    coefficients = _perspective_coefficients(corners, tilted)
    return image.transform(
        (width, height),
        Image.PERSPECTIVE,
        coefficients,
        resample=Image.BICUBIC,
        fillcolor=(255, 255, 255),
    )


def content_box(image: Image.Image) -> tuple[float, float, float, float]:
    """Normalised bounds of the inked area, so lighting can be aimed at text not margins."""
    grey = np.asarray(image.convert("L"), dtype=np.float32)
    inked = grey < 200
    rows, columns = np.any(inked, axis=1), np.any(inked, axis=0)
    if not rows.any() or not columns.any():
        return 0.0, 0.0, 1.0, 1.0
    y0, y1 = np.flatnonzero(rows)[[0, -1]]
    x0, x1 = np.flatnonzero(columns)[[0, -1]]
    height, width = grey.shape
    return x0 / width, y0 / height, x1 / width, y1 / height


def add_glare_and_shadow(image: Image.Image) -> Image.Image:
    """A blown highlight and a hand shadow, both aimed at the text rather than the margins.

    Modelled on how the real receipts in CORD actually look: photographed under a ceiling
    light with the photographer's own hand throwing a shadow across the totals. Glare
    saturates toward white and loses the glyphs entirely, shadow only compresses contrast, so
    the two fail differently and a document carrying both is harder than one carrying either.

    Both are positioned inside the inked region. Lighting that lands on an empty margin looks
    dramatic in a contact sheet and costs the extractor nothing.
    """
    width, height = image.size
    x0, y0, x1, y1 = content_box(image)
    ys, xs = np.mgrid[0:height, 0:width]
    u, v = xs / max(width - 1, 1), ys / max(height - 1, 1)

    # Highlight over the right-hand columns, where amounts sit on most documents.
    gx, gy = x0 + (x1 - x0) * 0.74, y0 + (y1 - y0) * 0.36
    glare = np.exp(-(((u - gx) ** 2) / 0.020 + ((v - gy) ** 2) / 0.028))

    # Shadow as a soft diagonal band over the lower half of the content.
    sx, sy = x0 + (x1 - x0) * 0.34, y0 + (y1 - y0) * 0.72
    band = (u - sx) * 0.8 + (v - sy) * 0.6
    shadow = np.exp(-(band**2) / 0.030)

    array = np.asarray(image, dtype=np.float32)
    darkened = array * (1.0 - SHADOW_STRENGTH * shadow[..., None])
    lit = darkened + 255.0 * GLARE_STRENGTH * glare[..., None]
    return Image.fromarray(np.clip(lit, 0, 255).astype(np.uint8))


def _rescale(image: Image.Image, factor: float) -> Image.Image:
    """Shrink then keep it shrunk. Detail lost here is what the extractor never sees."""
    return image.resize(
        (max(1, int(image.width * factor)), max(1, int(image.height * factor))), Image.LANCZOS
    )


def build_tiers(pdf_path: Path, out_dir: Path) -> dict[str, Path]:
    """Write T1 to T3 for one PDF and return every tier path, T0 being the PDF itself."""
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = pdf_path.stem
    paths = {"t0": pdf_path}

    flat = render(pdf_path)
    t1 = out_dir / f"{stem}_t1.png"
    flat.save(t1)
    paths["t1"] = t1

    scanned = _rescale(add_skew(flat, T2["skew"]), T2["scale"])
    scanned = scanned.filter(ImageFilter.GaussianBlur(T2["blur"]))
    scanned = ImageEnhance.Contrast(scanned).enhance(T2["contrast"])
    scanned = add_noise(scanned, T2["noise"])
    t2 = out_dir / f"{stem}_t2.png"
    scanned.save(t2)
    paths["t2"] = t2

    # T3 starts from the clean raster, not from T2, so the two tiers stay independent
    # samples of the same page rather than one being a strictly worse copy of the other.
    photographed = _rescale(add_perspective(add_skew(flat, T3["skew"])), T3["scale"])
    photographed = photographed.filter(ImageFilter.GaussianBlur(T3["blur"]))
    photographed = ImageEnhance.Contrast(photographed).enhance(T3["contrast"])
    photographed = add_glare_and_shadow(add_noise(photographed, T3["noise"], seed=11))
    t3 = out_dir / f"{stem}_t3.jpg"
    photographed.save(t3, quality=T3["jpeg"])
    paths["t3"] = t3

    return paths


def contact_sheet(pdf_path: Path, out_path: Path, height: int = 900) -> Image.Image:
    """Put all four tiers side by side, for judging by eye whether T3 is still readable.

    A tier that a person cannot read is not measuring calibration any more, it is measuring
    an impossible task, so this gets looked at before any quota is spent.
    """
    paths = build_tiers(pdf_path, OUT_DIR)
    frames = []
    for tier in TIERS:
        image = render(paths[tier]) if tier == "t0" else Image.open(paths[tier]).convert("RGB")
        scale = height / image.height
        frames.append(image.resize((max(1, int(image.width * scale)), height), Image.LANCZOS))

    gap = 14
    sheet = Image.new(
        "RGB", (sum(f.width for f in frames) + gap * (len(frames) - 1), height), (255, 255, 255)
    )
    x = 0
    for frame in frames:
        sheet.paste(frame, (x, 0))
        x += frame.width + gap
    sheet.save(out_path)
    return sheet


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(p for p in DOCS_DIR.glob("*.pdf"))
    for pdf in pdfs:
        build_tiers(pdf, OUT_DIR)
    print(f"Built {len(TIERS) - 1} degraded tiers for {len(pdfs)} documents in {OUT_DIR}")
    print(f"T0 stays the original PDF, so the corpus is {len(pdfs) * len(TIERS)} extractions.")


if __name__ == "__main__":
    main()
