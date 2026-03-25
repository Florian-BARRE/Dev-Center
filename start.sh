#!/usr/bin/env bash
# dev-center — Start script.
#
# Smart start: fully idempotent on every run.
#
#   First run  → full setup: creates data directories, builds images,
#                waits for health check.
#   Later runs → picks up changed env vars, rebuilds if source changed,
#                restarts containers. Skips steps that are already done.
#
# Usage:
#   ./start.sh           — production  (docker-compose.yml only)
#   ./start.sh --dev     — development (docker-compose.yml + docker-compose.dev.yml)

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEV-CENTER]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

# ─────────────────────────────────────────────────────────────
# Parse flags
# ─────────────────────────────────────────────────────────────
DEV_MODE=false
for arg in "$@"; do
    case "$arg" in
        --dev) DEV_MODE=true ;;
        *) err "Unknown argument: $arg. Usage: ./start.sh [--dev]" ;;
    esac
done

# ─────────────────────────────────────────────────────────────
# Step 1 — Ensure all .env files exist
#
# If a .env is missing, copy from its .env.example and stop so
# the user can fill in the required values before proceeding.
# ─────────────────────────────────────────────────────────────
log "Checking service .env files ..."

MISSING=false
for svc in common dev-center-app vscode; do
    ENV_SRC="services/$svc/.env.example"
    ENV_DST="services/$svc/.env"
    if [ ! -f "$ENV_DST" ]; then
        cp "$ENV_SRC" "$ENV_DST"
        warn "  $ENV_DST created from example — open it and fill in the required values."
        MISSING=true
    fi
done

if [ "$MISSING" = true ]; then
    echo ""
    err "One or more .env files were just created. Fill them in, then re-run ./start.sh."
fi

log "  [OK] All .env files present."

# ─────────────────────────────────────────────────────────────
# Step 2 — Load configuration and validate required variables
# ─────────────────────────────────────────────────────────────
log "Loading configuration ..."

# shellcheck disable=SC1091
source services/common/.env

[ -z "${DATA_ROOT:-}" ] && err "DATA_ROOT is not set in services/common/.env"

log "  DATA_ROOT = ${DATA_ROOT}"

# ─────────────────────────────────────────────────────────────
# Step 3 — Validate DATA_ROOT (Windows path safety checks)
#          + create data directories before Docker runs
#
# Docker Desktop on Windows calls CreateFile on the host path when
# it tries to auto-create a missing bind-mount target directory.
# Two known failure modes:
#
#   1. Apostrophe in path → Windows CreateFile API rejects it.
#      e.g. "Florian's Laptop" in the path → instant failure.
#
#   2. Backslash + escape letter in the Windows path → Docker's JSON
#      serialization turns it into a control character. The daemon
#      receives a corrupted path and returns ERROR_INVALID_NAME.
#      Examples: \f (form-feed), \n (newline), \t (tab).
#      Common victims: usernames starting with f, n, t, r, b, a, v, 0.
#
# Fix: pre-create all directories here so Docker never needs to create
# them itself. The mkdir calls below eliminate the CreateFile trigger.
# ─────────────────────────────────────────────────────────────
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "mingw"* ]] || [[ "$OSTYPE" == "cygwin"* ]]; then
    ABS_DATA_ROOT=$(realpath -m "${DATA_ROOT}" 2>/dev/null || echo "${PWD}/${DATA_ROOT#./}")

    # Convert POSIX path to Windows-style backslash path for escape-sequence detection.
    WIN_PATH=$(echo "$ABS_DATA_ROOT" | sed 's|/|\\|g')

    BAD_PATH=false
    REASON=""

    if [[ "$WIN_PATH" == *"'"* ]]; then
        BAD_PATH=true
        REASON="contains an apostrophe (Windows CreateFile API rejects it)"
    elif echo "$WIN_PATH" | grep -qiE '\\[fntrba0v]'; then
        BAD_PATH=true
        REASON="contains a backslash + letter that Docker's JSON layer treats as a control character (e.g. \\f = form-feed, \\n = newline)"
    fi

    if [ "$BAD_PATH" = true ]; then
        echo ""
        err "Docker Desktop cannot mount this path:
     Path   : ${WIN_PATH}
     Reason : ${REASON}
     Fix    : set DATA_ROOT to a root-level path that avoids C:\\Users\\<username>.
     Example: DATA_ROOT=C:/dev-data/dev-center
     Edit services/common/.env, then re-run ./start.sh."
    fi
fi

log "Creating data directories at ${DATA_ROOT} ..."
mkdir -p \
    "${DATA_ROOT}/workspaces" \
    "${DATA_ROOT}/data"
log "  [OK] Data directories ready."

# ─────────────────────────────────────────────────────────────
# Step 4 — Check host auth credentials
# ─────────────────────────────────────────────────────────────
log "Checking host auth credentials ..."

# Claude Code (~/.claude) — required for claude remote-control sessions.
if [ -d "$HOME/.claude" ]; then
    log "  [OK] ~/.claude found — Claude Code auth available."
else
    warn "  [--] ~/.claude not found — Claude Code sessions will not work."
    warn "       Run 'claude' on the host to authenticate before starting sessions."
fi

# SSH key (~/.ssh/id_*) — required for git clone/push via SSH.
if ls "$HOME/.ssh"/id_* > /dev/null 2>&1; then
    log "  [OK] SSH key found — git clone via SSH available."
    # Pre-populate GitHub in known_hosts so git clone never prompts inside containers.
    if ! grep -q "github.com" "$HOME/.ssh/known_hosts" 2>/dev/null; then
        log "       Adding GitHub to ~/.ssh/known_hosts ..."
        ssh-keyscan github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
    fi
else
    warn "  [--] No SSH key found in ~/.ssh/ — git clone via SSH will not work."
    warn "       Generate one: ssh-keygen -t ed25519 -C 'your@email.com'"
fi

# ─────────────────────────────────────────────────────────────
# Step 5 — Build and start Docker Compose
#
# --build: rebuilds dev-center-app if source code changed since last run.
# --env-file: injects DATA_ROOT and port vars for volume interpolation.
# In dev mode: overlays docker-compose.dev.yml for source mounts + hot reload.
# ─────────────────────────────────────────────────────────────
if [ "$DEV_MODE" = true ]; then
    log "Starting in DEV mode (source mounts + hot reload) ..."
    COMPOSE_CMD="docker compose --env-file services/common/.env -f docker-compose.yml -f docker-compose.dev.yml"
else
    log "Starting in PRODUCTION mode ..."
    COMPOSE_CMD="docker compose --env-file services/common/.env"
fi

log "Building and starting containers ..."
$COMPOSE_CMD up -d --build

# ─────────────────────────────────────────────────────────────
# Step 6 — Wait for dev-center-app to become healthy
#
# Polls /api/v1/health every 3 s for up to 90 s.
# ─────────────────────────────────────────────────────────────
log "Waiting for dev-center-app to become healthy ..."
APP_PORT="${DEV_CENTER_PORT:-8000}"
HEALTHY=false
for i in {1..30}; do
    if curl -sf "http://localhost:${APP_PORT}/api/v1/health" > /dev/null 2>&1; then
        log "  [OK] dev-center-app is healthy."
        HEALTHY=true
        break
    fi
    sleep 3
done
[ "$HEALTHY" = true ] || err "dev-center-app did not become healthy after 90s — check: docker compose logs dev-center-app"

# ─────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────
log ""
log "Dev Center is running!"
log "   Dev Center App : http://localhost:${DEV_CENTER_PORT:-8000}"
log "   VS Code Server : http://localhost:${CODE_SERVER_PORT:-8443}"
log ""
log "Open the dashboard to add projects and manage Claude Code sessions."
