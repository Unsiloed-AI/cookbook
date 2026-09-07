"""Renders Unsiloed extraction citations as boxes on the source document.

Works on anything pymupdf can open, so a PDF page and a photographed ID card are
handled the same way. For images the API returns citation coordinates in pixels
rather than PDF points; scaling by the ratio of rendered size to the reported
page_width/page_height covers both without special cases.

Unsiloed's docs give no threshold for what counts as a "safe" confidence score, so
this draws the raw grounding_score/extraction_score numbers next to each box instead
of inventing a color-coded verdict the API itself doesn't make.

Fields that could not be drawn are listed in a footer instead of being dropped: a
field the API declined to ground is the one a reviewer most needs to see.
"""
from __future__ import annotations

import pymupdf
from PIL import Image, ImageDraw, ImageFont


# Every page is rendered to this width. PDFs and images arrive in very different
# coordinate spaces (a PDF page is ~612 points wide, a photo can be several thousand
# pixels), and pymupdf treats an image as a 72dpi page, so rendering both at a fixed
# dpi would upscale photos past their real detail and leave the labels below
# unreadably small on the result.
RENDER_WIDTH = 1700


def _overlaps(a, b) -> bool:
    return a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]


def _iter_leaves(node, path=""):
    """Recursively yield (label, leaf) for every extraction leaf under node.

    A leaf is any dict carrying a "score" alongside its value -- either the plain
    {"value": ..., "score": ...} shape, or the {"__value__": ..., "score": ...}
    wrapper Unsiloed uses for items inside an array of primitives.
    """
    if isinstance(node, dict):
        if "score" in node and ("value" in node or "__value__" in node):
            yield path, node
            return
        for key, child in node.items():
            yield from _iter_leaves(child, f"{path}.{key}" if path else key)
    elif isinstance(node, list):
        for i, child in enumerate(node):
            yield from _iter_leaves(child, f"{path}[{i}]")


def render_extraction_audit(pdf_path: str, extraction_result: dict, page: int | None = None) -> Image.Image:
    """Render one page of pdf_path with every extraction citation drawn on it.

    Boxes are drawn for fields cited on the rendered page: the page given explicitly,
    or the first page any citation points to. Anything not drawn is listed in a footer
    under the page rather than dropped silently, since a field the API could not ground
    is exactly what a reviewer needs to see. Fields carry no citation when
    enable_citations was off, or when the value was not found in the document at all
    (in which case grounding_score is 0.0 and value is null).
    """
    all_leaves = list(_iter_leaves(extraction_result))
    grounded = [(label, leaf) for label, leaf in all_leaves if leaf.get("citation")]
    ungrounded = [label for label, leaf in all_leaves if not leaf.get("citation")]
    if not grounded:
        raise ValueError("extraction_result has no citations to render (was enable_citations=true?)")

    target_page = page or grounded[0][1]["citation"]["page"]
    leaves = [(label, leaf) for label, leaf in grounded if leaf["citation"]["page"] == target_page]
    elsewhere = [
        f"{label} (page {leaf['citation']['page']})"
        for label, leaf in grounded
        if leaf["citation"]["page"] != target_page
    ]

    doc = pymupdf.open(pdf_path)
    pdf_page = doc[target_page - 1]
    zoom = RENDER_WIDTH / pdf_page.rect.width
    pix = pdf_page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
    page_image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    doc.close()

    try:
        font = ImageFont.load_default(size=14)
        footer_font = ImageFont.load_default(size=18)
    except TypeError:
        font = footer_font = ImageFont.load_default()

    footer_lines = []
    if ungrounded:
        footer_lines.append("Not grounded, no citation returned: " + ", ".join(ungrounded))
    if elsewhere:
        footer_lines.append("Cited on other pages, pass page= to view: " + ", ".join(elsewhere))

    # Grow the canvas rather than printing the footer over the document itself.
    footer_height = (len(footer_lines) * 26 + 20) if footer_lines else 0
    image = Image.new("RGB", (pix.width, pix.height + footer_height), "white")
    image.paste(page_image, (0, 0))

    draw = ImageDraw.Draw(image)
    for i, line in enumerate(footer_lines):
        draw.text((20, pix.height + 10 + i * 26), line, fill="red", font=footer_font)

    placed_labels = []
    for label, leaf in leaves:
        citation = leaf["citation"]
        scale_x = pix.width / citation["page_width"]
        scale_y = pix.height / citation["page_height"]
        left, top, right, bottom = citation["bbox"]
        box = (left * scale_x, top * scale_y, right * scale_x, bottom * scale_y)
        draw.rectangle(box, outline="red", width=2)

        score = leaf.get("score") or {}
        caption = f"{label}  grounding={score.get('grounding_score')} extraction={score.get('extraction_score')}"
        text_y = box[1] - 16 if box[1] > 16 else box[3] + 2
        text_pos = [box[0], text_y]
        caption_rect = draw.textbbox(text_pos, caption, font=font)

        # Fields close together on the page (e.g. two values on the same line) can
        # produce labels that would overlap; push a colliding one down until clear
        # rather than let two captions render on top of each other illegibly.
        while any(_overlaps(caption_rect, placed) for placed in placed_labels):
            text_pos[1] += (caption_rect[3] - caption_rect[1]) + 2
            caption_rect = draw.textbbox(text_pos, caption, font=font)
        placed_labels.append(caption_rect)

        # A background behind the label keeps it readable regardless of what
        # document text happens to sit underneath it.
        draw.rectangle(caption_rect, fill="white")
        draw.text(text_pos, caption, fill="red", font=font)

    return image
