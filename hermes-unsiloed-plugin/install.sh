#!/usr/bin/env bash
# Install the Unsiloed plugin into Hermes Agent:
#   1. symlink (or copy) the ./unsiloed package into $HERMES_HOME/plugins/unsiloed
#   2. add "unsiloed" to plugins.enabled in $HERMES_HOME/config.yaml (with a backup)
#
# Usage:
#   ./install.sh            # symlink the package (dev-friendly; edits take effect live)
#   ./install.sh --copy     # copy instead of symlink
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/unsiloed"
DEST_DIR="$HERMES_HOME/plugins/unsiloed"
CONFIG="$HERMES_HOME/config.yaml"
PYTHON="${PYTHON:-$HERMES_HOME/hermes-agent/venv/bin/python}"
[ -x "$PYTHON" ] || PYTHON="python3"

MODE="symlink"
[ "${1:-}" = "--copy" ] && MODE="copy"

echo "== Unsiloed plugin installer"
echo "   HERMES_HOME : $HERMES_HOME"
echo "   source      : $SRC_DIR"
echo "   destination : $DEST_DIR ($MODE)"

[ -f "$SRC_DIR/plugin.yaml" ] || { echo "ERROR: $SRC_DIR/plugin.yaml not found" >&2; exit 1; }

mkdir -p "$HERMES_HOME/plugins"

# 1. link/copy the package
if [ -e "$DEST_DIR" ] || [ -L "$DEST_DIR" ]; then
  echo "   (removing existing $DEST_DIR)"
  rm -rf "$DEST_DIR"
fi
if [ "$MODE" = "copy" ]; then
  cp -r "$SRC_DIR" "$DEST_DIR"
else
  ln -s "$SRC_DIR" "$DEST_DIR"
fi
echo "   installed package."

# 2. enable it in config.yaml (user plugins are opt-in via plugins.enabled)
if [ -f "$CONFIG" ]; then
  cp "$CONFIG" "$CONFIG.bak.$(date +%Y%m%d_%H%M%S)"
fi
"$PYTHON" - "$CONFIG" <<'PY'
import sys, io
from pathlib import Path
try:
    import yaml
except Exception:
    print("   NOTE: PyYAML not available; add this to config.yaml manually:")
    print("       plugins:\n         enabled:\n           - unsiloed")
    sys.exit(0)

cfg = Path(sys.argv[1])
data = yaml.safe_load(cfg.read_text()) if cfg.exists() else {}
if not isinstance(data, dict):
    data = {}
plugins = data.get("plugins")
if not isinstance(plugins, dict):
    plugins = {}
    data["plugins"] = plugins
enabled = plugins.get("enabled")
if not isinstance(enabled, list):
    enabled = []
    plugins["enabled"] = enabled
if "unsiloed" not in enabled:
    enabled.append("unsiloed")
    cfg.write_text(yaml.dump(data, sort_keys=False, default_flow_style=False))
    print("   added 'unsiloed' to plugins.enabled.")
else:
    print("   'unsiloed' already in plugins.enabled.")
PY

echo
echo "Done. Restart Hermes (or 'hermes plugins reload'), then verify:"
echo "   hermes tools | grep -E 'unsiloed|document_search'"
echo "   hermes  ->  /unsiloed status"
echo
echo "Set UNSILOED_API_KEY in \$HERMES_HOME/.env (or the project ./.env) before ingesting."
