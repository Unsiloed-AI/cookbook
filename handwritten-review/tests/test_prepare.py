"""Tests for rendering scans into page images."""
from PIL import Image

from review import prepare


def test_multi_page_tiff_renders_every_page(tmp_path):
    pages = [Image.new("RGB", (2400, 3200), color) for color in ("white", "gray")]
    src = tmp_path / "scan.tiff"
    pages[0].save(src, save_all=True, append_images=pages[1:])
    images = prepare.page_images(src, tmp_path / "out")
    assert [p.name for p in images] == ["page-1.png", "page-2.png"]


def test_small_images_are_upscaled(tmp_path):
    src = tmp_path / "crop.png"
    Image.new("RGB", (700, 200), "white").save(src)
    [page] = prepare.page_images(src, tmp_path / "out")
    assert max(Image.open(page).size) >= prepare.MIN_LONG_SIDE
