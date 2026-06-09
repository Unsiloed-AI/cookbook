"""UNSILOED CLI — interactive terminal for Unsiloed AI document processing.

Launches a Claude-Code-style REPL: an oh-my-logo banner, a `›` prompt, slash
commands for the common operations, and a LangChain agent that handles anything
typed in plain English.
"""

from __future__ import annotations

import sys

from langchain_core.messages import AIMessage, HumanMessage

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from . import ui
from .callbacks import ToolLogger
from .client import UnsiloedClient, UnsiloedError

THREAD = {
    "configurable": {"thread_id": "unsiloed-cli-session"},
    "callbacks": [ToolLogger()],
}

SLASH_TO_PROMPT = {
    "/parse": "Parse this document into Markdown chunks: {arg}",
    "/extract": "Extract structured fields from this document: {arg}. Ask me which fields if unclear.",
    "/classify": "Classify this document: {arg}. Ask me for candidate categories if I didn't give any.",
    "/split": "Split this merged document into separate files by type: {arg}.",
}


def _chunk_text(content) -> str:
    """Pull plain text out of a message chunk's content (str or block list)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(b.get("text", "") for b in content if isinstance(b, dict))
    return ""


def _run_agent(agent, text: str) -> None:
    """Stream the agent's answer token-by-token.

    `stream_mode="messages"` yields (chunk, metadata) for every LLM token across
    every turn. We spin a status until real text arrives (covering the tool-call
    turn + the API job polling), then stop it and stream the final answer. Tool
    activity prints itself via ui.tool_event from inside the tools.
    """
    started = False
    redactor = ui.StreamRedactor()
    status = ui.status()
    status.start()
    try:
        for chunk, _meta in agent.stream(
            {"messages": [HumanMessage(content=text)]}, THREAD, stream_mode="messages"
        ):
            if not isinstance(chunk, AIMessage):
                continue  # skip tool messages — they log their own events
            piece = _chunk_text(chunk.content)
            if not piece:
                continue  # tool-call deltas carry no user-facing text
            if not started:
                status.stop()
                ui.agent_stream_start()
                started = True
            out = redactor.feed(piece)
            if out:
                ui.agent_stream_token(out)
    finally:
        status.stop()
    if started:
        ui.agent_stream_token(redactor.flush())  # emit any held-back tail
        ui.agent_stream_end()
    else:
        ui.console.print()
        ui.agent_text("(no response)")
        ui.console.print()


def _handle_slash(agent, client: UnsiloedClient, line: str) -> bool:
    """Return False to exit the REPL, True to continue."""
    parts = line.split(maxsplit=1)
    cmd = parts[0].lower()
    arg = parts[1].strip() if len(parts) > 1 else ""

    if cmd in ("/exit", "/quit", "/q"):
        return False
    if cmd in ("/help", "/?"):
        ui.print_help()
        return True
    if cmd == "/usage":
        try:
            with ui.status("checking credits"):
                data = client.usage()
            ui.success(
                f"Credits remaining: {data.get('quota_remaining', data.get('credits', '?'))}"
            )
            ui.info(str(data))
        except UnsiloedError as e:
            ui.error(str(e))
        return True
    if cmd in SLASH_TO_PROMPT:
        if not arg:
            ui.error(f"Usage: {cmd} <file-path-or-url>")
            return True
        _run_agent(agent, SLASH_TO_PROMPT[cmd].format(arg=arg))
        return True

    ui.error(f"Unknown command: {cmd}  (try /help)")
    return True


def repl() -> None:
    ui.print_banner()

    try:
        client = UnsiloedClient()
    except UnsiloedError as e:
        ui.error(str(e))
        sys.exit(1)

    # Import here so a missing ANTHROPIC_API_KEY fails with a clear message
    # only once the user actually starts the agent.
    try:
        from .agent import build_agent

        agent = build_agent(client)
    except Exception as e:  # noqa: BLE001
        ui.error(f"Could not start agent: {e}")
        ui.info("Make sure OPENAI_API_KEY is set.")
        sys.exit(1)

    ui.info("Ready. Drop a file path or ask a question. /help for commands, /exit to quit.\n")

    while True:
        try:
            line = ui.console.input(ui.prompt_str()).strip()
        except (EOFError, KeyboardInterrupt):
            ui.console.print()
            break
        if not line:
            continue
        if line.startswith("/"):
            if not _handle_slash(agent, client, line):
                break
            continue
        try:
            _run_agent(agent, line)
        except UnsiloedError as e:
            ui.error(str(e))
        except KeyboardInterrupt:
            ui.console.print()
            ui.info("(interrupted)")
        except Exception as e:  # noqa: BLE001
            ui.error(str(e))

    ui.console.print(f"[{ui.PINK}]✦ goodbye[/]")


def main() -> None:
    # One-shot mode: `unsiloed "parse report.pdf"` runs a single turn.
    if len(sys.argv) > 1:
        from .agent import build_agent

        ui.print_banner()
        try:
            agent = build_agent()
        except Exception as e:  # noqa: BLE001
            ui.error(f"Could not start agent: {e}")
            sys.exit(1)
        _run_agent(agent, " ".join(sys.argv[1:]))
        return
    repl()


if __name__ == "__main__":
    main()
