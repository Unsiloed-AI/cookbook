"""Configuration + path resolution for the Unsiloed Hermes plugin.

Deliberately free of Hermes internals so the modules can also be exercised
standalone (``demo_local.py``) with the same behaviour they get inside the
agent. Environment is resolved from the real process env first, then from
``$HERMES_HOME/.env`` and the project-local ``./.env`` (loaded but never
allowed to clobber a value already set in the real environment).
"""

from __future__ import annotations

import os
import threading
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional

# --------------------------------------------------------------------------
# HERMES_HOME + .env loading
# --------------------------------------------------------------------------


def hermes_home() -> Path:
    """Resolve HERMES_HOME the same way the host does for the common case."""
    env = os.environ.get("HERMES_HOME")
    if env:
        return Path(env).expanduser()
    return Path.home() / ".hermes"


_env_lock = threading.Lock()
_dotenv_cache: Optional[Dict[str, str]] = None


def _parse_dotenv(path: Path) -> Dict[str, str]:
    out: Dict[str, str] = {}
    try:
        raw = path.read_text(encoding="utf-8")
    except Exception:
        return out
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        # strip optional `export ` prefix and surrounding quotes
        if key.startswith("export "):
            key = key[len("export "):].strip()
        val = val.strip().strip('"').strip("'")
        if key:
            out[key] = val
    return out


def _dotenv() -> Dict[str, str]:
    """Merged view of $HERMES_HOME/.env and ./.env (project wins over home)."""
    global _dotenv_cache
    if _dotenv_cache is not None:
        return _dotenv_cache
    with _env_lock:
        if _dotenv_cache is not None:
            return _dotenv_cache
        merged: Dict[str, str] = {}
        merged.update(_parse_dotenv(hermes_home() / ".env"))
        merged.update(_parse_dotenv(Path.cwd() / ".env"))
        _dotenv_cache = merged
        return merged


def getenv(name: str, default: Optional[str] = None) -> Optional[str]:
    """Real env first, then the merged .env files, then *default*."""
    val = os.environ.get(name)
    if val is not None and val != "":
        return val
    val = _dotenv().get(name)
    if val is not None and val != "":
        return val
    return default


def reset_env_cache() -> None:
    global _dotenv_cache
    with _env_lock:
        _dotenv_cache = None


# --------------------------------------------------------------------------
# Unsiloed API
# --------------------------------------------------------------------------


def unsiloed_base_url() -> str:
    return getenv("UNSILOED_BASE_URL", "https://prod.visionapi.unsiloed.ai") or ""


def unsiloed_api_key() -> Optional[str]:
    return getenv("UNSILOED_API_KEY")


def has_unsiloed_key() -> bool:
    return bool(unsiloed_api_key())


# --------------------------------------------------------------------------
# Storage locations
# --------------------------------------------------------------------------


def plugin_home() -> Path:
    """Where the plugin keeps its cross-session state (search DB, etc.)."""
    override = getenv("UNSILOED_PLUGIN_HOME")
    p = Path(override).expanduser() if override else hermes_home() / "unsiloed"
    p.mkdir(parents=True, exist_ok=True)
    return p


def db_path() -> Path:
    return plugin_home() / "documents.db"


def workspace_dir() -> Path:
    """Where parsed Markdown + JSON land. Defaults to ``<cwd>/ingested``.

    This is the user-facing "workspace" copy: plain files they can open,
    grep, or hand to another tool, independent of the wiki and the index.
    """
    override = getenv("UNSILOED_WORKSPACE")
    p = Path(override).expanduser() if override else Path.cwd() / "ingested"
    p.mkdir(parents=True, exist_ok=True)
    return p


def wiki_path() -> Path:
    """Karpathy LLM-Wiki root. ``$WIKI_PATH`` or ``~/wiki`` (skill default)."""
    override = getenv("WIKI_PATH")
    return Path(override).expanduser() if override else Path.home() / "wiki"


def home_relative(path_str) -> str:
    """Abbreviate the home dir to ``~`` so absolute paths never leak the OS
    username into tool output / stored files (e.g. ``/Users/<user>/x`` -> ``~/x``)."""
    try:
        p = str(path_str)
        home = str(Path.home())
        if p == home:
            return "~"
        if p.startswith(home + "/"):
            return "~" + p[len(home):]
        return p
    except Exception:
        return str(path_str)


def memory_dir() -> Path:
    """Where MEMORY.md lives — matches tools/memory_tool.get_memory_dir().

    ``UNSILOED_MEMORY_DIR`` overrides it (used by the demo to isolate writes
    without moving HERMES_HOME, which also holds the Nous login for embeddings).
    """
    override = getenv("UNSILOED_MEMORY_DIR")
    if override:
        return Path(override).expanduser()
    return hermes_home() / "memories"


# --------------------------------------------------------------------------
# Embeddings
# --------------------------------------------------------------------------


def embed_provider() -> str:
    """Backend selector: `auto` (default) | `nous` | `openrouter` | `openai` | `hash`.

    ``auto`` tries, in order: an explicit custom endpoint (UNSILOED_EMBED_API_KEY),
    the Nous host login (no key), an OpenRouter key, then the hashing fallback.
    """
    return (getenv("UNSILOED_EMBED_PROVIDER", "auto") or "auto").lower()


def embed_model() -> str:
    # Available on both Nous and OpenRouter gateways (OpenAI-compatible id).
    return getenv("UNSILOED_EMBED_MODEL", "openai/text-embedding-3-small") or ""


def embed_base_url() -> str:
    """Base URL for a fully custom OpenAI-compatible endpoint (provider=openai)."""
    return getenv("UNSILOED_EMBED_BASE_URL", "https://api.openai.com/v1") or ""


def embed_api_key() -> Optional[str]:
    """Key for a custom OpenAI-compatible endpoint (UNSILOED_EMBED_API_KEY / OPENAI_API_KEY)."""
    return getenv("UNSILOED_EMBED_API_KEY") or getenv("OPENAI_API_KEY")


def openrouter_api_key() -> Optional[str]:
    return getenv("OPENROUTER_API_KEY")


def openrouter_base_url() -> str:
    return getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1") or ""


def nous_base_url() -> str:
    """Nous inference base URL — from the auth store, else the known default."""
    from_env = getenv("NOUS_INFERENCE_BASE_URL")
    if from_env:
        return from_env.rstrip("/")
    try:
        import json
        data = json.loads((hermes_home() / "auth.json").read_text(encoding="utf-8"))
        url = (((data.get("providers") or {}).get("nous") or {}).get("inference_base_url"))
        if isinstance(url, str) and url.strip():
            return url.rstrip("/")
    except Exception:
        pass
    return "https://inference-api.nousresearch.com/v1"


def nous_logged_in() -> bool:
    """True when the Hermes auth store has Nous credentials to (re)fresh from."""
    try:
        import json
        data = json.loads((hermes_home() / "auth.json").read_text(encoding="utf-8"))
        nous = ((data.get("providers") or {}).get("nous") or {})
        return bool(nous.get("access_token") or nous.get("refresh_token"))
    except Exception:
        return False


@lru_cache(maxsize=1)
def hash_embed_dim() -> int:
    try:
        return max(64, int(getenv("UNSILOED_HASH_EMBED_DIM", "512") or "512"))
    except ValueError:
        return 512
