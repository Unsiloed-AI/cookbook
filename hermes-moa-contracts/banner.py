"""Hermes Agent intro banner — the caduceus art from the real Hermes banner,
without the tools/skills/MCP panel that makes the full welcome screen huge.
"""

import os
import sys


def show(hermes_home: str) -> None:
    """Print the Hermes caduceus + title to stderr. Falls back to a plain box
    if the Hermes art can't be imported."""
    sys.path.append(hermes_home)
    try:
        from rich.console import Console
        from hermes_cli.banner import HERMES_CADUCEUS
        console = Console(stderr=True)
        console.print()
        console.print(HERMES_CADUCEUS, justify="center")
        console.print("[bold #FFBF00]⚕  Hermes Agent[/]", justify="center")
        console.print("[#B8860B]Mixture-of-Agents · contract-risk panel[/]", justify="center")
        console.print()
    except Exception:
        _fallback()


def _fallback() -> None:
    bz, gold, sub, R = ("\033[38;2;205;127;50m", "\033[1;38;2;218;165;32m",
                        "\033[2;38;2;184;134;11m", "\033[0m")
    width = 50

    def row(text="", color=""):
        pad = width - len(text)
        left = pad // 2
        return f"{bz}│{R}{' ' * left}{color}{text}{R}{' ' * (pad - left)}{bz}│{R}"

    print("\n".join([
        "",
        f"{bz}╭{'─' * width}╮{R}",
        row("⬡  Hermes Agent", gold),
        row("Mixture-of-Agents · contract-risk panel", sub),
        f"{bz}╰{'─' * width}╯{R}",
        "",
    ]), file=sys.stderr, flush=True)