"""Terminal presentation layer — oh-my-logo banner + Claude-Code chrome.

The "UNSILOED CLI" wordmark uses oh-my-logo's ANSI Shadow font
(https://github.com/shinshin86/oh-my-logo), shown beside an ASCII rendering of
the Unsiloed brand mark, all in the brand white→pink gradient.

By default we draw the embedded wordmark and apply the gradient ourselves in
Python (zero runtime deps beyond `rich`). If the real `oh-my-logo` binary is on
PATH and ``UNSILOED_NATIVE_LOGO=1`` is set, we shell out to it instead for the
authentic render.
"""

from __future__ import annotations

import os
import shutil
import subprocess

from rich.align import Align
from rich.console import Console, Group
from rich.panel import Panel
from rich.rule import Rule
from rich.status import Status
from rich.table import Table
from rich.text import Text

# Unsiloed brand: white + pink.
PINK = "#ff4fa3"
PINK_SOFT = "#ff8ac4"
DIM = "grey62"

# White-to-pink block shading — light at the top fading to brand pink at the
# bottom, giving the block letters a 3-D sheen.
LOGO_PALETTE = ["#ffffff", "#ffd6ec", "#ffabd6", "#ff7bbd", "#ff4fa3", "#e63a8f"]

console = Console()

# oh-my-logo ANSI Shadow font, captured for "UNSILOED" and "CLI".
_UNSILOED = r"""
 ██╗   ██╗ ███╗   ██╗ ███████╗ ██╗ ██╗       ██████╗  ███████╗ ██████╗
 ██║   ██║ ████╗  ██║ ██╔════╝ ██║ ██║      ██╔═══██╗ ██╔════╝ ██╔══██╗
 ██║   ██║ ██╔██╗ ██║ ███████╗ ██║ ██║      ██║   ██║ █████╗   ██║  ██║
 ██║   ██║ ██║╚██╗██║ ╚════██║ ██║ ██║      ██║   ██║ ██╔══╝   ██║  ██║
 ╚██████╔╝ ██║ ╚████║ ███████║ ██║ ███████╗ ╚██████╔╝ ███████╗ ██████╔╝
  ╚═════╝  ╚═╝  ╚═══╝ ╚══════╝ ╚═╝ ╚══════╝  ╚═════╝  ╚══════╝ ╚═════╝
"""

_CLI = r"""
  ██████╗ ██╗      ██╗
 ██╔════╝ ██║      ██║
 ██║      ██║      ██║
 ██║      ██║      ██║
 ╚██████╗ ███████╗ ██║
  ╚═════╝ ╚══════╝ ╚═╝
"""

# Unsiloed "U + sparkle" brand mark, traced from the logo via half-block OCR.
_ICON = (
    "     ▄\n"
    "     ██\n"
    "     ██  ▄          ▄\n"
    "     ██  ██        ██\n"
    "     ██  ██  ▄  ▄▄█████▄\n"
    "     ██  ██  ██   ▀██▀\n"
    "     ██  ██  ██    ▀▀\n"
    "     ██  ██  ██  ██\n"
    "     ██  ██  ██  ██ ▄██\n"
    "     ██  ██  ██ ▄██ ███\n"
    "     ███ ▀██▄▄▄▄██▀ ███\n"
    "      ███▄ ▀▀██▀▀ ▄███\n"
    "       ▀███▄▄▄▄▄▄███▀\n"
    "          ▀▀████▀▀"
)


def _lerp(a: str, b: str, t: float) -> str:
    ar, ag, ab = int(a[1:3], 16), int(a[3:5], 16), int(a[5:7], 16)
    br, bg, bb = int(b[1:3], 16), int(b[3:5], 16), int(b[5:7], 16)
    r = round(ar + (br - ar) * t)
    g = round(ag + (bg - ag) * t)
    bl = round(ab + (bb - ab) * t)
    return f"#{r:02x}{g:02x}{bl:02x}"


def _gradient_color(t: float) -> str:
    """Sample the logo palette at position t in [0, 1]."""
    if t <= 0:
        return LOGO_PALETTE[0]
    if t >= 1:
        return LOGO_PALETTE[-1]
    span = len(LOGO_PALETTE) - 1
    pos = t * span
    i = int(pos)
    return _lerp(LOGO_PALETTE[i], LOGO_PALETTE[i + 1], pos - i)


def _gradient_block(art: str) -> Text:
    """Apply a top-to-bottom white→pink gradient across the lines of ASCII art."""
    lines = [ln for ln in art.splitlines() if ln.strip("")]
    # keep blank framing lines out, but preserve internal structure
    lines = art.strip("\n").splitlines()
    n = max(len(lines) - 1, 1)
    out = Text()
    for i, line in enumerate(lines):
        out.append(line + "\n", style=f"bold {_gradient_color(i / n)}")
    return out


def _native_logo() -> str | None:
    """Render via the real oh-my-logo binary, if opted in and installed."""
    if os.environ.get("UNSILOED_NATIVE_LOGO") != "1":
        return None
    if not shutil.which("oh-my-logo"):
        return None
    try:
        out = subprocess.run(
            ["oh-my-logo", "UNSILOED CLI", "mono", "--filled"],
            capture_output=True,
            text=True,
            timeout=20,
        )
        return out.stdout if out.returncode == 0 else None
    except Exception:
        return None


def print_banner() -> None:
    console.print()
    native = _native_logo()
    if native:
        # oh-my-logo emits its own ANSI colour; print it raw.
        print(native)
    else:
        # Icon beside the wordmark, both gradient-shaded, vertically centred.
        wordmark = Group(_gradient_block(_UNSILOED), _gradient_block(_CLI))
        lockup = Table.grid(padding=(0, 3))
        lockup.add_column(vertical="middle")
        lockup.add_column(vertical="middle")
        lockup.add_row(_gradient_block(_ICON), wordmark)
        console.print(lockup)

    tagline = Text.assemble(
        ("✦ ", PINK),
        ("agentic OCR & document processing", f"bold {PINK_SOFT}"),
    )
    subtitle = Text("type /help for commands · /exit to quit", style=DIM)
    console.print(
        Panel(
            Group(tagline, subtitle),
            border_style=PINK,
            padding=(0, 2),
            expand=False,
        )
    )


def print_help() -> None:
    rows = [
        ("/parse <file|url>", "document → Markdown chunks (RAG)"),
        ("/extract <file|url>", "pull typed fields via a JSON schema"),
        ("/classify <file|url>", "route a document to a category"),
        ("/split <file|url>", "break a merged batch into separate PDFs"),
        ("/usage", "show remaining credits"),
        ("/help", "show this help"),
        ("/exit", "quit"),
    ]
    lines = [
        Text.assemble(("  ✦ ", PINK), (cmd.ljust(22), f"bold {PINK_SOFT}"), (desc, DIM))
        for cmd, desc in rows
    ]
    extra = Text(
        "\n  Or just talk to me in plain English — I'll pick the right tool.",
        style=DIM,
    )
    console.print(
        Panel(
            Group(*lines, extra),
            border_style=DIM,
            title=Text("commands", style=f"bold {PINK}"),
            title_align="left",
            padding=(1, 2),
        )
    )


def rule(label: str = "") -> None:
    console.print(Rule(Text(label, style=DIM), style=PINK))


def prompt_str() -> str:
    """The interactive prompt rendered like OG Claude Code's chevron."""
    return f"[bold {PINK}]›[/] "


def agent_text(text: str) -> None:
    console.print(Text.assemble(("✦ ", PINK), (text, "white")))


def agent_stream_start() -> None:
    """Begin a streamed answer: blank line + coral chevron, no newline."""
    console.print()
    console.print(Text("✦ ", style=PINK), end="")


def agent_stream_token(piece: str) -> None:
    """Print one streamed token inline. Text() avoids markup interpretation."""
    console.print(Text(piece, style="white"), end="")


def agent_stream_end() -> None:
    console.print("\n")


def tool_event(name: str, detail: str = "") -> None:
    suffix = f" [dim]{detail}[/dim]" if detail else ""
    console.print(f"  [bold {PINK_SOFT}]⚙ {name}[/]{suffix}")


def info(text: str) -> None:
    console.print(f"[{DIM}]{text}[/]")


def error(text: str) -> None:
    console.print(f"[bold red]✗[/] {text}")


def success(text: str) -> None:
    console.print(f"[bold green]✓[/] {text}")


_active_status: Status | None = None


def status(label: str = "thinking") -> Status:
    """A single dots spinner with a dim label (used while the agent works)."""
    global _active_status
    _active_status = console.status(
        Text(f" {label}…", style=DIM), spinner="dots", spinner_style=PINK
    )
    return _active_status


def set_progress(text: str) -> None:
    """Update the live spinner's label in place (e.g. polling progress).

    Keeps long-running jobs from spamming one printed line per poll.
    """
    if _active_status is not None:
        _active_status.update(Text(f" {text}", style=DIM))


# --- username redaction -------------------------------------------------- #

_HOME = os.path.expanduser("~")
_USER = os.path.basename(_HOME)  # login name, e.g. "composio"


def redact(text: str) -> str:
    """Keep the local home path / username out of anything we print."""
    text = text.replace(_HOME, "~")
    if _USER:
        text = text.replace(_USER, "user")
    return text


class StreamRedactor:
    """Redacts a token stream at word boundaries.

    Sensitive tokens (absolute paths, the username) never contain whitespace, so
    once a word is complete we can safely redact and emit it; we hold back the
    trailing partial word until more text (or flush) arrives.
    """

    def __init__(self) -> None:
        self._buf = ""

    def feed(self, piece: str) -> str:
        self._buf += piece
        cut = max(self._buf.rfind(" "), self._buf.rfind("\n"), self._buf.rfind("\t"))
        if cut < 0:
            return ""
        head, self._buf = self._buf[: cut + 1], self._buf[cut + 1 :]
        return redact(head)

    def flush(self) -> str:
        out, self._buf = redact(self._buf), ""
        return out
