#!/usr/bin/env bash
# Install the Unsiloed node into a self-hosted n8n Docker container.
# Usage: ./install.sh [container-name]   (defaults to "n8n")
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CONTAINER="${1:-n8n}"

if [ ! -d "$HERE/dist" ]; then
  echo "dist/ not found — building..."; ( cd "$HERE" && npm install && npm run build )
fi

echo "Installing Unsiloed node into container '$CONTAINER'..."
docker exec "$CONTAINER" mkdir -p /home/node/.n8n/custom
docker cp "$HERE/dist/." "$CONTAINER":/home/node/.n8n/custom/
docker exec -u root "$CONTAINER" chown -R node:node /home/node/.n8n/custom
docker restart "$CONTAINER" >/dev/null

echo "Done. The 'Unsiloed' node will appear in the node panel after n8n restarts."
echo "Next: create an 'Unsiloed API' credential (your API key) on the node."
