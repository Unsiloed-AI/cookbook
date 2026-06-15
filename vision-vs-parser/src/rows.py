"""Turn a pipe-delimited markdown table into the scorer's row format.

Both extractors are normalized to the same intermediate: lines that look like

    | Description | Currency | Par Value | Cost ($) | Fair Value ($) | % of Net Assets |

Unsiloed returns this natively (its Table segments are markdown). Sonnet is
prompted to emit exactly this shape. One parser handles both, so the comparison
turns only on the *values*, never on output-format wrangling.
"""
from __future__ import annotations

import re
from html.parser import HTMLParser

_SEP = re.compile(r"^:?-{2,}:?$")


def _split_pipes(line: str) -> list[str]:
    s = line.strip()
    # Accept both real markdown tables ("| a | b |") and bare pipe-separated
    # rows ("a | b | c"). Six columns need at least five separators.
    if s.count("|") < 5:
        return []
    parts = s.split("|")
    # A leading/trailing pipe produces an empty first/last element — drop those,
    # but keep genuinely blank interior cells.
    if parts and parts[0].strip() == "":
        parts = parts[1:]
    if parts and parts[-1].strip() == "":
        parts = parts[:-1]
    return [p.strip() for p in parts]


def parse_pipe_rows(text: str) -> dict:
    """Parse all pipe table rows in `text` into {description: [5 cells]}.

    Header rows (`Description | ...`) and separator rows (`--- | ---`) are
    skipped, as is any row that doesn't have at least 6 columns. The first
    column is the holding description; the next five are the scored cells.
    """
    rows: dict = {}
    for line in text.splitlines():
        cells = _split_pipes(line)
        if len(cells) < 6:
            continue
        if all(_SEP.match(c) for c in cells if c):
            continue  # markdown separator row
        desc = cells[0]
        if not desc or desc.lower().startswith("description"):
            continue
        # First five cells after the description: Currency, Par, Cost, Fair, %.
        rows[desc] = cells[1:6]
    return rows


class _TableParser(HTMLParser):
    """Collect <table> rows as lists of cell text. Robust to <br>, entities."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.table_rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.table_rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def parse_html_rows(html: str) -> dict:
    """Parse one or more HTML <table>s into {description: [5 cells]}.

    The first column is the holding description; the next five are the scored
    cells. Header rows and short rows are skipped.
    """
    p = _TableParser()
    p.feed(html)
    rows: dict = {}
    for cells in p.table_rows:
        if len(cells) < 6:
            continue
        desc = cells[0].strip()
        if not desc or desc.lower().startswith("description"):
            continue
        rows[desc] = [c.strip() for c in cells[1:6]]
    return rows
