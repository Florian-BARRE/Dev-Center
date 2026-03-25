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

log "  DATA_ROOT        = ${DATA_ROOT}"
log "  DEV_CENTER_PORT  = ${DEV_CENTER_PORT:-8000}"
log "  CODE_SERVER_PORT = ${CODE_SERVER_PORT:-8443}"

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
# Step 4 — Check Claude Code authentication
#
# Validates ~/.claude/.credentials.json (OAuth token + expiry) or
# ~/.claude.json (legacy token). Sessions won't work without this.
# ─────────────────────────────────────────────────────────────
log "Checking Claude Code authentication ..."

CLAUDE_DIR="$HOME/.claude"
CLAUDE_CREDS="$CLAUDE_DIR/.credentials.json"
CLAUDE_JSON_FILE="$HOME/.claude.json"
CLAUDE_OK=false

if [ -f "$CLAUDE_CREDS" ]; then
    if grep -q '"accessToken"' "$CLAUDE_CREDS" 2>/dev/null; then
        # Check token expiry if possible (expiresAt is milliseconds since epoch).
        EXPIRES=$(grep -o '"expiresAt":[0-9]*' "$CLAUDE_CREDS" 2>/dev/null \
                  | grep -o '[0-9]*$' || echo "0")
        NOW_MS=$(( $(date +%s) * 1000 ))
        if [ "${EXPIRES:-0}" -gt "$NOW_MS" ] 2>/dev/null; then
            CLAUDE_OK=true
            log "  [OK] Claude credentials valid (.credentials.json)."
        else
            warn "  [!!] Claude OAuth token has EXPIRED."
            warn "       Use the Settings > Auth tab in the app to re-authenticate,"
            warn "       or run 'claude' on the host first."
        fi
    else
        warn "  [!!] ~/.claude/.credentials.json exists but has no accessToken."
    fi
elif [ -f "$CLAUDE_JSON_FILE" ]; then
    if grep -qE '"oauthToken"|"accessToken"' "$CLAUDE_JSON_FILE" 2>/dev/null; then
        CLAUDE_OK=true
        log "  [OK] Claude credentials found (~/.claude.json legacy format)."
    else
        warn "  [!!] ~/.claude.json exists but contains no token."
    fi
else
    CLAUDE_OK=false
fi

if [ "$CLAUDE_OK" = false ]; then
    warn "  [!!] Claude authentication not found — sessions will NOT work."
    warn "       Run 'claude' on the host to authenticate, then re-run ./start.sh."
    warn "       You can also use Settings > Auth in the app once it is running."
fi

# ─────────────────────────────────────────────────────────────
# Step 5 — Check SSH key for private repo cloning
#
# Resolves SSH_KEY_PATH from services/common/.env (defaults to ~/.ssh).
# If a key exists, pre-seeds GitHub into known_hosts so git clone
# never prompts inside the container.
# ─────────────────────────────────────────────────────────────
log "Checking SSH key ..."

SSH_DIR="${SSH_KEY_PATH:-$HOME/.ssh}"
# Strip trailing slash and resolve ~ if needed
SSH_DIR="${SSH_DIR%/}"
[[ "$SSH_DIR" == "~"* ]] && SSH_DIR="$HOME${SSH_DIR:1}"

SSH_KEY_FILE=""
for candidate in \
        "$SSH_DIR/id_ed25519" \
        "$SSH_DIR/id_rsa" \
        "$SSH_DIR/id_ecdsa" \
        "$SSH_DIR/id_dsa"; do
    if [ -f "$candidate" ]; then
        SSH_KEY_FILE="$candidate"
        break
    fi
done

if [ -n "$SSH_KEY_FILE" ]; then
    log "  [OK] SSH key found: $SSH_KEY_FILE"
    log "       Private repos via SSH (git@github.com:...) will work."

    # Pre-seed GitHub in known_hosts on the host so the container inherits it.
    KNOWN_HOSTS="$SSH_DIR/known_hosts"
    if ! grep -q "github.com" "$KNOWN_HOSTS" 2>/dev/null; then
        log "       Adding GitHub to $KNOWN_HOSTS ..."
        if ssh-keyscan -H github.com >> "$KNOWN_HOSTS" 2>/dev/null; then
            log "       [OK] github.com added to known_hosts."
        else
            warn "       ssh-keyscan failed — run manually:"
            warn "       ssh-keyscan -H github.com >> $KNOWN_HOSTS"
        fi
    else
        log "       GitHub already in known_hosts."
    fi
else
    warn "  [--] No SSH key found in ${SSH_DIR}."
    warn "       Private repo clones via SSH (git@github.com:...) will NOT work."
    if [ -n "${SSH_KEY_PATH:-}" ]; then
        warn "       SSH_KEY_PATH is set to '${SSH_KEY_PATH}' but no key file found there."
        warn "       Check the path is correct in services/common/.env."
    else
        warn "       Generate one: ssh-keygen -t ed25519 -C 'your@email.com'"
        warn "       Then re-run ./start.sh to add GitHub to known_hosts."
    fi
    warn "       HTTPS public repos will still work without an SSH key."
fi

# ─────────────────────────────────────────────────────────────
# Step 6 — Summary of readiness before starting
# ─────────────────────────────────────────────────────────────
echo ""
log "Pre-flight summary:"
log "  Claude auth    : $( [ "$CLAUDE_OK" = true ] && echo 'OK' || echo 'MISSING — sessions will fail')"
log "  SSH key        : $( [ -n "$SSH_KEY_FILE" ] && echo "OK ($SSH_KEY_FILE)" || echo 'MISSING — SSH clone unavailable')"
log "  Data root      : ${DATA_ROOT}"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 7 — Build and start Docker Compose
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
# Step 8 — Wait for dev-center-app to become healthy
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
echo ""
log "Dev Center is running!"
log "   Dev Center App : http://localhost:${DEV_CENTER_PORT:-8000}"
log "   VS Code Server : http://localhost:${CODE_SERVER_PORT:-8443}"
echo ""
if [ "$CLAUDE_OK" = false ]; then
    warn "ACTION REQUIRED: Claude is not authenticated."
    warn "  Open http://localhost:${DEV_CENTER_PORT:-8000} → Settings → Auth → Re-authenticate"
fi
