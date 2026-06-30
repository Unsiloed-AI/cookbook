"""Configuration — loads the demo's settings from `.env` (or the environment).

Single place that owns config, so the other modules just receive what they need.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

_HERE = Path(__file__).resolve().parent

# Load .env from the package dir first, then the parent (dev convenience). Existing
# environment variables always win (override=False).
for _candidate in (_HERE / ".env", _HERE.parent / ".env"):
    if _candidate.exists():
        load_dotenv(_candidate, override=False)

# Credentials
UNSILOED_API_KEY = os.getenv("UNSILOED_API_KEY")        # Unsiloed REST (api-key header)
DAYTONA_API_KEY = os.getenv("DAYTONA_API_KEY")          # hosts the PDF (app.daytona.io)

# Where to read the document from (in priority order; see review.read_contract)
DOC_URL = os.getenv("DOC_URL")                          # use this public URL directly
USE_UPLOAD = os.getenv("UNSILOED_USE_UPLOAD") == "1"    # upload bytes instead of hosting

# The Hermes Agent install that provides the MoA SDK.
HERMES_HOME = os.path.expanduser(os.getenv("HERMES_HOME", "~/.hermes/hermes-agent"))


def require(name: str) -> str:
    """Return the named credential or exit with a clear message."""
    value = globals().get(name)
    if not value:
        raise SystemExit(f"{name} is required — set it in .env or the environment.")
    return value