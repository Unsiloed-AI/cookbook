"""A callback handler that surfaces every tool call in the terminal.

The LangChain file tools don't print anything on their own, so we hook
``on_tool_start`` to render a uniform ``⚙ tool_name(args)`` line for every tool
the agent invokes — file ops and Unsiloed ops alike.
"""

from __future__ import annotations

from typing import Any

from langchain_core.callbacks import BaseCallbackHandler

from . import ui


def _summarise(inputs: Any) -> str:
    text = ui.redact(str(inputs))
    text = " ".join(text.split())  # collapse whitespace/newlines
    return text[:80] + ("…" if len(text) > 80 else "")


class ToolLogger(BaseCallbackHandler):
    def on_tool_start(self, serialized, input_str, **kwargs) -> None:
        name = (serialized or {}).get("name") or kwargs.get("name") or "tool"
        detail = _summarise(kwargs.get("inputs", input_str))
        ui.tool_event(name, detail)
