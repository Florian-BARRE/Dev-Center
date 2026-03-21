#!/usr/bin/env bash
# IA-Dev-Hub — First-run bootstrap script.
#
# What it does:
#   1. Checks that all services/*.env files are filled in.
#   2. Auto-generates IDH_WEBHOOK_SECRET if blank.
#   3. Creates the runtime data directory tree (IDH_DATA_ROOT).
#   4. Checks host auth credentials (~/.claude, ~/.codex, SSH key).
#   5. Seeds openclaw.json and rule templates if not present.
#   6. Builds and starts Docker Compose.
#   7. Waits for idh-app to become healthy, then installs the IDH plugin.
#
# Run once:          ./setup.sh
# Subsequent starts: docker compose --env-file services/common/.env up -d

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[IDH]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

# ─────────────────────────────────────────────────────────────
# Step 1 — Check that all .env files have been created
# ─────────────────────────────────────────────────────────────
log "Checking service .env files ..."

MISSING=false
for svc in common openclaw idh-plugin vscode; do
    ENV_SRC="services/$svc/.env.example"
    ENV_DST="services/$svc/.env"
    if [ ! -f "$ENV_DST" ]; then
        cp "$ENV_SRC" "$ENV_DST"
        warn "$ENV_DST created from example — open it and fill in the required values."
        MISSING=true
    fi
done

if [ "$MISSING" = true ]; then
    echo ""
    err "One or more .env files were just created from their templates. Fill them in, then re-run ./setup.sh."
fi

# ─────────────────────────────────────────────────────────────
# Step 2 — Source env files and validate required variables
# ─────────────────────────────────────────────────────────────
log "Loading configuration ..."

# shellcheck disable=SC1091
source services/common/.env
# shellcheck disable=SC1091
source services/openclaw/.env
# shellcheck disable=SC1091
source services/idh-plugin/.env

[ -z "${IDH_DATA_ROOT:-}"        ] && err "IDH_DATA_ROOT is not set in services/common/.env"
[ -z "${TELEGRAM_BOT_TOKEN:-}"   ] && err "TELEGRAM_BOT_TOKEN is not set in services/openclaw/.env"
[ -z "${TELEGRAM_USER_ID:-}"     ] && err "TELEGRAM_USER_ID is not set in services/openclaw/.env"

log "IDH_DATA_ROOT = ${IDH_DATA_ROOT}"

# ─────────────────────────────────────────────────────────────
# Step 3 — Auto-generate IDH_WEBHOOK_SECRET if blank
# ─────────────────────────────────────────────────────────────
if [ -z "${IDH_WEBHOOK_SECRET:-}" ]; then
    log "Generating IDH_WEBHOOK_SECRET ..."
    IDH_WEBHOOK_SECRET=$(openssl rand -hex 32)

    # Write the generated secret into services/idh-plugin/.env.
    # perl -i is portable across macOS and Linux (unlike sed -i).
    perl -i -pe "s|^IDH_WEBHOOK_SECRET=.*|IDH_WEBHOOK_SECRET=${IDH_WEBHOOK_SECRET}|" \
        services/idh-plugin/.env

    log "IDH_WEBHOOK_SECRET written to services/idh-plugin/.env"
fi

# ─────────────────────────────────────────────────────────────
# Step 4 — Create runtime data directory tree
# ─────────────────────────────────────────────────────────────
log "Creating data directories at ${IDH_DATA_ROOT} ..."
mkdir -p "${IDH_DATA_ROOT}"/{config,workspaces,state,rules}

# ─────────────────────────────────────────────────────────────
# Step 5 — Check host auth credentials
# ─────────────────────────────────────────────────────────────
log "Checking host auth credentials ..."

# Claude Code (~/.claude) — required for the remote-control bridge feature
if [ -d "$HOME/.claude" ]; then
    log "  [OK] ~/.claude found — Claude Code auth available."
else
    warn "  [--] ~/.claude not found — Claude Code auth is NOT available."
    warn "       Run 'claude' on the host to authenticate before using the bridge feature."
fi

# Codex (~/.codex) — required for auto-summary calls
if [ -d "$HOME/.codex" ]; then
    log "  [OK] ~/.codex found — Codex auth available."
else
    warn "  [--] ~/.codex not found — Codex auto-summaries will be unavailable."
    warn "       Run 'codex' on the host to authenticate if you want this feature."
fi

# SSH key (~/.ssh/id_*) — required for git clone via SSH
if ls "$HOME/.ssh"/id_* > /dev/null 2>&1; then
    log "  [OK] SSH key found — git clone via SSH available."
    # Pre-populate GitHub in known_hosts so git clone doesn't prompt inside containers.
    if ! grep -q "github.com" "$HOME/.ssh/known_hosts" 2>/dev/null; then
        log "       Adding GitHub to ~/.ssh/known_hosts ..."
        ssh-keyscan github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
    fi
else
    warn "  [--] No SSH private key found in ~/.ssh/ — git clone via SSH will not work."
    warn "       Generate one: ssh-keygen -t ed25519 -C 'your@email.com'"
fi

# ─────────────────────────────────────────────────────────────
# Step 6 — Seed openclaw.json if not present
# ─────────────────────────────────────────────────────────────
OPENCLAW_JSON="${IDH_DATA_ROOT}/config/openclaw.json"
if [ ! -f "$OPENCLAW_JSON" ]; then
    log "Generating openclaw.json ..."
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
      "dmPolicy": "disabled",
      "groups": {}
    }
  },
  "auth": {
    "allowFrom": ["${TELEGRAM_USER_ID}"]
  }
}
EOF
    log "openclaw.json created at ${OPENCLAW_JSON}."
else
    warn "openclaw.json already exists — skipping."
fi

# ─────────────────────────────────────────────────────────────
# Step 7 — Seed rule templates if not present
# ─────────────────────────────────────────────────────────────
CODING_RULES="${IDH_DATA_ROOT}/rules/CODING_RULES.md"
COMMON_CONTEXT="${IDH_DATA_ROOT}/rules/COMMON_CONTEXT.md"

if [ ! -f "$CODING_RULES" ]; then
    cat > "$CODING_RULES" <<'EOF'
# Coding Rules

<!-- Edit this file to define your coding standards. -->
<!-- These rules are injected into CLAUDE.md for each project's coding agent. -->

## General
- Write clean, readable code with clear variable names.
- Add comments for non-obvious logic.
- Prefer explicit over implicit.
EOF
    log "CODING_RULES.md template created."
fi

if [ ! -f "$COMMON_CONTEXT" ]; then
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
    log "COMMON_CONTEXT.md template created."
fi

# ─────────────────────────────────────────────────────────────
# Step 8 — Build and start Docker Compose
# ─────────────────────────────────────────────────────────────
log "Building and starting Docker Compose ..."
docker compose --env-file services/common/.env up -d --build

# ─────────────────────────────────────────────────────────────
# Step 9 — Wait for idh-app to become healthy
# ─────────────────────────────────────────────────────────────
log "Waiting for idh-app to become healthy ..."
IDH_APP_PORT="${IDH_APP_PORT:-8000}"
HEALTHY=false
for i in {1..30}; do
    if curl -sf "http://localhost:${IDH_APP_PORT}/api/v1/health/ping" > /dev/null 2>&1; then
        log "idh-app is healthy."
        HEALTHY=true
        break
    fi
    sleep 3
done
[ "$HEALTHY" = true ] || err "idh-app did not become healthy after 90s — check: docker compose logs idh-app"

# ─────────────────────────────────────────────────────────────
# Step 10 — Install IDH plugin in openclaw-gateway
# ─────────────────────────────────────────────────────────────
log "Installing IDH plugin in openclaw-gateway ..."
docker exec openclaw-gateway openclaw extensions install \
    /home/node/.openclaw/plugins/idh || \
    warn "Plugin install step failed — check: docker compose logs openclaw-gateway"

log ""
log "IA-Dev-Hub is running!"
log "   OpenClaw gateway  : http://localhost:${OPENCLAW_GATEWAY_PORT:-18789}"
log "   OpenClaw dashboard: http://localhost:${OPENCLAW_DASHBOARD_PORT:-18790}"
log "   IDH App           : http://localhost:${IDH_APP_PORT:-8000}"
log "   VS Code Server    : http://localhost:${CODE_SERVER_PORT:-8443}"
log ""
log "Test plugin: send /idh_ping in any Telegram group the bot is in."
