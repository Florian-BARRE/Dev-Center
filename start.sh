#!/usr/bin/env bash
# IA-Dev-Hub — Start script.
#
# Smart start: fully idempotent on every run.
#
#   First run  → full setup: generates secrets, seeds configs and rules,
#                builds images, waits for health, installs plugin.
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

log()  { echo -e "${GREEN}[IDH]${NC} $1"; }
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
for svc in common openclaw idh-plugin vscode; do
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
# shellcheck disable=SC1091
source services/openclaw/.env
# shellcheck disable=SC1091
source services/idh-plugin/.env

[ -z "${IDH_DATA_ROOT:-}"      ] && err "IDH_DATA_ROOT is not set in services/common/.env"
[ -z "${TELEGRAM_BOT_TOKEN:-}" ] && err "TELEGRAM_BOT_TOKEN is not set in services/openclaw/.env"
[ -z "${TELEGRAM_USER_ID:-}"   ] && err "TELEGRAM_USER_ID is not set in services/openclaw/.env"

log "  IDH_DATA_ROOT = ${IDH_DATA_ROOT}"

# ─────────────────────────────────────────────────────────────
# Step 3 — Validate IDH_DATA_ROOT (Windows path safety checks)
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
    ABS_DATA_ROOT=$(realpath -m "${IDH_DATA_ROOT}" 2>/dev/null || echo "${PWD}/${IDH_DATA_ROOT#./}")

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
     Fix    : set IDH_DATA_ROOT to a root-level path that avoids C:\\Users\\<username>.
     Example: IDH_DATA_ROOT=C:/dev-data/idh
     Edit services/common/.env, then re-run ./start.sh."
    fi
fi

log "Creating data directories at ${IDH_DATA_ROOT} ..."
mkdir -p \
    "${IDH_DATA_ROOT}/config" \
    "${IDH_DATA_ROOT}/workspaces" \
    "${IDH_DATA_ROOT}/state" \
    "${IDH_DATA_ROOT}/rules"
log "  [OK] Data directories ready."

# ─────────────────────────────────────────────────────────────
# Step 4 — Auto-generate IDH_WEBHOOK_SECRET if blank
#
# First-run only: generates a random secret and writes it back to
# services/idh-plugin/.env so subsequent runs reuse the same value.
# Skipped on subsequent runs because the value is already set.
# ─────────────────────────────────────────────────────────────
if [ -z "${IDH_WEBHOOK_SECRET:-}" ]; then
    log "Generating IDH_WEBHOOK_SECRET ..."
    IDH_WEBHOOK_SECRET=$(openssl rand -hex 32)

    # perl -i is portable across macOS, Linux, and Git Bash on Windows.
    # Unlike sed -i, it handles in-place edits correctly on all platforms.
    perl -i -pe "s|^IDH_WEBHOOK_SECRET=.*|IDH_WEBHOOK_SECRET=${IDH_WEBHOOK_SECRET}|" \
        services/idh-plugin/.env

    log "  [OK] IDH_WEBHOOK_SECRET written to services/idh-plugin/.env"
else
    log "  [OK] IDH_WEBHOOK_SECRET already set."
fi

# ─────────────────────────────────────────────────────────────
# Step 5 — Check host auth credentials
# ─────────────────────────────────────────────────────────────
log "Checking host auth credentials ..."

# Claude Code (~/.claude) — required for the remote-control bridge feature.
if [ -d "$HOME/.claude" ]; then
    log "  [OK] ~/.claude found — Claude Code auth available."
else
    warn "  [--] ~/.claude not found — Claude Code bridge will not work."
    warn "       Run 'claude' on the host to authenticate before using the bridge."
fi

# Codex (~/.codex) — required for auto-summary calls.
if [ -d "$HOME/.codex" ]; then
    log "  [OK] ~/.codex found — Codex auth available."
else
    warn "  [--] ~/.codex not found — Codex auto-summaries will be unavailable."
    warn "       Run 'codex' on the host to authenticate if you want this feature."
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
# Step 6 — Seed or update openclaw.json
#
# Created on first run. Automatically regenerated when
# TELEGRAM_BOT_TOKEN or TELEGRAM_USER_ID changes between runs so
# the running container always reflects the current .env values.
# ─────────────────────────────────────────────────────────────
OPENCLAW_JSON="${IDH_DATA_ROOT}/config/openclaw.json"

# Helper: write a fresh openclaw.json from current env variables.
_write_openclaw_json() {
    cat > "$OPENCLAW_JSON" <<EOF
{
  "gateway": {
    "bind": "lan",
    "mode": "local"
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "groupPolicy": "allowlist",
      "dmPolicy": "allowlist",
      "groups": {},
      "allowFrom": ["${TELEGRAM_USER_ID}"]
    }
  }
}
EOF
}

if [ ! -f "$OPENCLAW_JSON" ]; then
    log "Generating openclaw.json (first run) ..."
    _write_openclaw_json
    log "  [OK] openclaw.json created."
else
    # Extract the stored token and user ID from the existing file and compare
    # to the current env values. Regenerate if either has changed.
    STORED_TOKEN=$(grep '"botToken"' "$OPENCLAW_JSON" 2>/dev/null \
        | sed 's/.*"botToken": *"\([^"]*\)".*/\1/' || echo "")
    STORED_USER=$(grep '"allowFrom"' "$OPENCLAW_JSON" 2>/dev/null \
        | grep -oE '"[0-9]+"' | head -1 | tr -d '"' || echo "")

    if [ "$STORED_TOKEN" != "$TELEGRAM_BOT_TOKEN" ] || [ "$STORED_USER" != "$TELEGRAM_USER_ID" ]; then
        log "Telegram credentials changed — updating botToken and allowFrom in openclaw.json ..."
        # Update only the token and allowFrom fields in-place, preserving all other settings
        # (groups allowlist, gateway config, etc.) that OpenClaw may have written.
        perl -i -pe "s|\"botToken\": *\"[^\"]*\"|\"botToken\": \"${TELEGRAM_BOT_TOKEN}\"|" "$OPENCLAW_JSON"
        perl -i -pe "s|\"allowFrom\": *\[[^\]]*\]|\"allowFrom\": [\"${TELEGRAM_USER_ID}\"]|" "$OPENCLAW_JSON"
        log "  [OK] openclaw.json credentials updated (groups and other settings preserved)."
    else
        log "  [OK] openclaw.json is up to date."
    fi
fi

# ─────────────────────────────────────────────────────────────
# Step 7 — Seed rule templates (first run only)
#
# CODING_RULES.md and COMMON_CONTEXT.md are user-editable files.
# Created if absent; never overwritten once they exist.
# ─────────────────────────────────────────────────────────────
CODING_RULES="${IDH_DATA_ROOT}/rules/CODING_RULES.md"
COMMON_CONTEXT="${IDH_DATA_ROOT}/rules/COMMON_CONTEXT.md"

if [ ! -f "$CODING_RULES" ]; then
    log "Creating CODING_RULES.md template ..."
    cat > "$CODING_RULES" <<'EOF'
# Coding Rules

<!-- Edit this file to define your coding standards. -->
<!-- These rules are injected into CLAUDE.md for each project's coding agent. -->

## General
- Write clean, readable code with clear variable names.
- Add comments for non-obvious logic.
- Prefer explicit over implicit.
EOF
    log "  [OK] CODING_RULES.md created."
fi

if [ ! -f "$COMMON_CONTEXT" ]; then
    log "Creating COMMON_CONTEXT.md template ..."
    cat > "$COMMON_CONTEXT" <<'EOF'
# Common Context

<!-- Variables substituted at project creation: -->
<!-- {{PROJECT_ID}}, {{WORKSPACE_DIR}}, {{REPO_URL}} -->

You are working on project **{{PROJECT_ID}}**.
- Workspace: `{{WORKSPACE_DIR}}`
- Repository: `{{REPO_URL}}`
- Available tools: git, standard shell utilities.

Read `SESSION_MEMORY.md` at the start of every session — it contains your working memory.
EOF
    log "  [OK] COMMON_CONTEXT.md created."
fi

# ─────────────────────────────────────────────────────────────
# Step 8 — Build and start Docker Compose
#
# --build: rebuilds idh-app if source code changed since last run.
# --env-file: injects IDH_DATA_ROOT and port vars for volume interpolation.
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
# Step 9 — Wait for idh-app to become healthy
#
# Polls the /api/v1/health/ping endpoint every 3 s for up to 90 s.
# ─────────────────────────────────────────────────────────────
log "Waiting for idh-app to become healthy ..."
IDH_APP_PORT="${IDH_APP_PORT:-8000}"
HEALTHY=false
for i in {1..30}; do
    if curl -sf "http://localhost:${IDH_APP_PORT}/api/v1/health/ping" > /dev/null 2>&1; then
        log "  [OK] idh-app is healthy."
        HEALTHY=true
        break
    fi
    sleep 3
done
[ "$HEALTHY" = true ] || err "idh-app did not become healthy after 90s — check: docker compose logs idh-app"

# ─────────────────────────────────────────────────────────────
# Step 10 — IDH plugin (handled automatically by Docker Compose)
#
# The idh-plugin-installer init container (defined in docker-compose.yml)
# runs before openclaw-gateway on every compose up. It copies the plugin
# source from ./plugin/idh into a named Docker volume (idh-plugin-ext)
# with Linux-native ownership (node:node, mode 755) so OpenClaw's
# world-writable security check passes.
#
# No manual install step needed here.
# ─────────────────────────────────────────────────────────────
log "  [OK] IDH plugin managed by idh-plugin-installer (see docker-compose.yml)."

# ─────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────
log ""
log "IA-Dev-Hub is running!"
log "   OpenClaw gateway  : http://localhost:${OPENCLAW_GATEWAY_PORT:-18789}"
log "   OpenClaw dashboard: http://localhost:${OPENCLAW_DASHBOARD_PORT:-18790}"
log "   IDH App           : http://localhost:${IDH_APP_PORT:-8000}"
log "   VS Code Server    : http://localhost:${CODE_SERVER_PORT:-8443}"
log ""
log "Test plugin: send /idh_ping in any Telegram group the bot is in."
