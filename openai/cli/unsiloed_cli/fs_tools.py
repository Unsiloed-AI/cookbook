"""Filesystem tools for the agent, via LangChain's FileManagementToolkit.

This gives the agent a full, unrestricted set of local file tools so it can find
and work with documents anywhere on disk:

    read_file, write_file, list_directory, file_search (recursive glob),
    copy_file, move_file, file_delete

Access is unrestricted by default (``root_dir=None`` → absolute paths anywhere).
Set ``UNSILOED_FILE_ROOT`` to sandbox the agent to a single directory tree.
"""

from __future__ import annotations

import os

from langchain_community.agent_toolkits import FileManagementToolkit
from langchain_core.tools import BaseTool


def build_file_tools() -> list[BaseTool]:
    root = os.environ.get("UNSILOED_FILE_ROOT")  # None → no sandbox
    return FileManagementToolkit(root_dir=root).get_tools()
