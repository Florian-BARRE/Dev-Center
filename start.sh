#!/usr/bin/env bash
# Dev Center startup helper.
#
# Usage:
#   ./start.sh         # production: backend + code-server
#   ./start.sh --dev   # development: backend reload + frontend Vite + code-server

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEV-CENTER]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

DEV_MODE=false
for arg in "$@"; do
    case "$arg" in
        --dev) DEV_MODE=true ;;
        *) err "Unknown argument: $arg. Usage: ./start.sh [--dev]" ;;
    esac
done

# Step 1: Ensure required env files exist.
log "Checking service env files ..."
MISSING=false
for svc in common dev-center-app vscode; do
    ENV_SRC="services/$svc/.env.example"
    ENV_DST="services/$svc/.env"

    if [ ! -f "$ENV_DST" ]; then
        cp "$ENV_SRC" "$ENV_DST"
        warn "  $ENV_DST created from example. Fill required values and rerun."
        MISSING=true
    fi
done

if [ "$MISSING" = true ]; then
    err "One or more env files were created. Edit them, then rerun ./start.sh."
fi

# Step 2: Load and validate common configuration.
log "Loading configuration ..."
# shellcheck disable=SC1091
source services/common/.env

[ -z "${DATA_ROOT:-}" ] && err "DATA_ROOT is required in services/common/.env"

DEV_CENTER_PORT="${DEV_CENTER_PORT:-8000}"
CODE_SERVER_PORT="${CODE_SERVER_PORT:-8443}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

log "  DATA_ROOT       = ${DATA_ROOT}"
log "  DEV_CENTER_PORT = ${DEV_CENTER_PORT}"
log "  CODE_SERVER_PORT= ${CODE_SERVER_PORT}"
log "  FRONTEND_PORT   = ${FRONTEND_PORT}"

# Step 3: Validate path edge cases on Windows and pre-create data folders.
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "mingw"* ]] || [[ "$OSTYPE" == "cygwin"* ]]; then
    ABS_DATA_ROOT=$(realpath -m "${DATA_ROOT}" 2>/dev/null || echo "${PWD}/${DATA_ROOT#./}")
    WIN_PATH=$(echo "$ABS_DATA_ROOT" | sed 's|/|\\|g')

    BAD_PATH=false
    REASON=""

    if [[ "$WIN_PATH" == *"'"* ]]; then
        BAD_PATH=true
        REASON="contains an apostrophe (Windows CreateFile API rejects it)"
    elif echo "$WIN_PATH" | grep -qiE '\\[fntrba0v]'; then
        BAD_PATH=true
        REASON="contains a backslash + control escape pattern (for example \\f or \\n)"
    fi

    if [ "$BAD_PATH" = true ]; then
        err "Docker Desktop cannot mount DATA_ROOT.
Path   : ${WIN_PATH}
Reason : ${REASON}
Fix    : choose a root-level path (for example C:/dev-data/dev-center), then rerun ./start.sh."
    fi
fi

log "Creating data directories at ${DATA_ROOT} ..."
mkdir -p "${DATA_ROOT}/workspaces" "${DATA_ROOT}/data"

# Step 4: Check Claude authentication availability.
log "Checking Claude authentication ..."
CLAUDE_CREDS="$HOME/.claude/.credentials.json"
CLAUDE_OK=false

if [ -f "$CLAUDE_CREDS" ] && grep -q '"accessToken"' "$CLAUDE_CREDS" 2>/dev/null; then
    EXPIRES=$(grep -o '"expiresAt":[0-9]*' "$CLAUDE_CREDS" 2>/dev/null | grep -o '[0-9]*$' || echo "0")
    NOW_MS=$(( $(date +%s) * 1000 ))

    if [ "${EXPIRES:-0}" -gt "$NOW_MS" ] 2>/dev/null; then
        CLAUDE_OK=true
        log "  [OK] Claude credentials are valid."
    else
        warn "  Claude token is expired. Re-authenticate in Settings > Auth or run 'claude' on host."
    fi
else
    warn "  Claude credentials not found. Sessions will not work until authenticated."
fi

if [ ! -f "$HOME/.claude.json" ]; then
    warn "  ~/.claude.json not found on host. Claude may prompt for workspace trust on first run."
fi

# Step 5: Check SSH key presence for private git repositories.
log "Checking SSH key ..."
SSH_DIR="${SSH_KEY_PATH:-$HOME/.ssh}"
SSH_DIR="${SSH_DIR%/}"
[[ "$SSH_DIR" == "~"* ]] && SSH_DIR="$HOME${SSH_DIR:1}"

SSH_KEY_FILE=""
for candidate in "$SSH_DIR/id_ed25519" "$SSH_DIR/id_rsa" "$SSH_DIR/id_ecdsa" "$SSH_DIR/id_dsa"; do
    if [ -f "$candidate" ]; then
        SSH_KEY_FILE="$candidate"
        break
    fi
done

if [ -n "$SSH_KEY_FILE" ]; then
    log "  [OK] SSH key found: $SSH_KEY_FILE"
else
    warn "  No SSH key found in ${SSH_DIR}."
    warn "  Private git clones over SSH will fail; HTTPS public clones still work."
fi

# Step 6: Start Docker Compose.
if [ "$DEV_MODE" = true ]; then
    log "Starting in development mode ..."
    COMPOSE_CMD="docker compose --env-file services/common/.env -f docker-compose.yml -f docker-compose.dev.yml"
else
    log "Starting in production mode ..."
    COMPOSE_CMD="docker compose --env-file services/common/.env -f docker-compose.yml"
fi

$COMPOSE_CMD up -d --build

# Step 7: Wait for backend health endpoint.
log "Waiting for backend health check ..."
HEALTHY=false
for _ in {1..30}; do
    if curl -sf "http://localhost:${DEV_CENTER_PORT}/api/health" > /dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    sleep 3
done

[ "$HEALTHY" = true ] || err "Backend did not become healthy after 90s. Check logs with: docker compose logs dev-center-app"

# Step 8: Print URLs.
log "Dev Center is running."
log "  Backend : http://localhost:${DEV_CENTER_PORT}"
log "  VS Code : http://localhost:${CODE_SERVER_PORT}"
if [ "$DEV_MODE" = true ]; then
    log "  Frontend: http://localhost:${FRONTEND_PORT}"
fi

if [ "$CLAUDE_OK" = false ]; then
    warn "Action required: authenticate Claude from Settings > Auth in the UI."
fi
