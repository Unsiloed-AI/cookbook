"""Render a scan at full resolution and package it as the PDF sent to Unsiloed."""
import io
from pathlib import Path

import pymupdf
from PIL import Image, ImageSequence

MIN_LONG_SIDE = 2000  # small scans are upscaled to at least this many pixels
MAX_LONG_SIDE = 2500  # larger scans are scaled down to this, which keeps uploads small


def zoom_for(page: pymupdf.Page) -> float:
    """Zoom factor that renders a scanned page at the resolution of the image embedded in it."""
    images = page.get_image_info()
    zoom = max(i["width"] for i in images) / page.rect.width if images else 300 / 72
    zoom = max(zoom, 300 / 72)
    return min(zoom, MAX_LONG_SIDE / max(page.rect.width, page.rect.height))


def page_images(src: Path, out_dir: Path) -> list[Path]:
    """Write one PNG per page of `src` (a PDF or an image) and return their paths."""
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    if src.suffix.lower() == ".pdf":
        for number, page in enumerate(pymupdf.open(src), start=1):
            zoom = zoom_for(page)
            path = out_dir / f"page-{number}.png"
            page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).save(path)
            paths.append(path)
        return paths

    # Image files can hold several pages (multi-page TIFFs do), so render every frame
    with Image.open(src) as source:
        for number, frame in enumerate(ImageSequence.Iterator(source), start=1):
            path = out_dir / f"page-{number}.png"
            fit(frame.convert("RGB")).save(path)
            paths.append(path)
    return paths


def fit(image: Image.Image) -> Image.Image:
    """Upscale small images and scale down very large ones."""
    long_side = max(image.size)
    scale = 1.0
    if long_side < MIN_LONG_SIDE:
        scale = min(3, MIN_LONG_SIDE / long_side)
    elif long_side > MAX_LONG_SIDE:
        scale = MAX_LONG_SIDE / long_side
    if scale == 1.0:
        return image
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)


def to_pdf(images: list[Path], out: Path) -> Path:
    """Wrap the page images in a PDF, one image per page, with no text layer."""
    pdf = pymupdf.open()
    for path in images:
        with Image.open(path) as image:
            width, height = image.size
            jpeg = io.BytesIO()
            image.convert("RGB").save(jpeg, "JPEG", quality=92)  # keeps the upload small
        page = pdf.new_page(width=width * 72 / 300, height=height * 72 / 300)
        page.insert_image(page.rect, stream=jpeg.getvalue())
    pdf.save(out)
    return out
