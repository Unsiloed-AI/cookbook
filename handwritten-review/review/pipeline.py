"""Run a scan through the whole pipeline: render, read each page twice, compare."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable

from . import extract, prepare, redline


def process(src: Path, out_dir: Path, on_status: Callable[..., None] = lambda **_: None) -> dict:
    """Process `src` (a PDF or an image) and return the review.

    The redline is a single string, so each page is extracted on its own: every page becomes a
    one-page PDF that is read twice. Everything is saved in `out_dir` (page images, the submitted
    PDFs, the raw reads, and the review) so a document can be inspected or rebuilt later.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    on_status(state="preparing")
    images = prepare.page_images(src, out_dir)

    on_status(state="reading", pages=len(images))

    def read_page(number: int, image: Path) -> list[dict]:
        return extract.read_twice(prepare.to_pdf([image], out_dir / f"page-{number}.pdf"))

    with ThreadPoolExecutor(3) as pool:
        reads = list(pool.map(read_page, range(1, len(images) + 1), images))
    (out_dir / "reads.json").write_text(json.dumps(reads))  # one pair of reads per page

    review = redline.merge_pages([redline.build_review(pair) for pair in reads])
    (out_dir / "review.json").write_text(json.dumps(review))
    return review
