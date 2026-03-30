#!/usr/bin/env bash
# Dev Center — start VS Code Server.
#
# Usage:
#   ./start.sh        start (or restart) the VS Code Server container
#   ./start.sh --stop stop the container

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEV-CENTER]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

# ── Parse flags ────────────────────────────────────────────────────────────────
STOP=false
for arg in "$@"; do
    case "$arg" in
        --stop) STOP=true ;;
        *) err "Unknown argument: $arg. Usage: ./start.sh [--stop]" ;;
    esac
done

# ── Check .env exists ──────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    cp .env.example .env
    warn ".env created from .env.example — edit it, then re-run ./start.sh."
    exit 1
fi

# ── Load .env ─────────────────────────────────────────────────────────────────
# shellcheck disable=SC1091
source .env

[ -z "${WORKSPACE_DIR:-}" ]   && err "WORKSPACE_DIR is not set in .env"
[ -z "${VSCODE_PASSWORD:-}" ] && err "VSCODE_PASSWORD is not set in .env"

# ── Stop mode ─────────────────────────────────────────────────────────────────
if [ "$STOP" = true ]; then
    log "Stopping VS Code Server ..."
    docker compose down
    log "Stopped."
    exit 0
fi

# ── Ensure workspace directory exists ─────────────────────────────────────────
log "Workspace: ${WORKSPACE_DIR}"
mkdir -p "${WORKSPACE_DIR}"
log "  [OK] Directory ready."

# ── Start ─────────────────────────────────────────────────────────────────────
log "Starting VS Code Server ..."
docker compose pull --quiet
docker compose up -d

# ── Wait for container to be healthy ──────────────────────────────────────────
log "Waiting for VS Code Server to be ready ..."
PORT="${VSCODE_PORT:-8443}"
for _ in {1..20}; do
    if curl -sk "https://localhost:${PORT}" -o /dev/null 2>&1; then
        break
    fi
    sleep 2
done

echo ""
log "VS Code Server is running."
log "  Open: http://localhost:${PORT}"
log "  Password: ${VSCODE_PASSWORD}"
