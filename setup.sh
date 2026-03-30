#!/usr/bin/env bash
# Dev Center — Machine setup script.
#
# Installs and configures all required tools on the current machine,
# then launches VS Code Server.
#
# Safe to re-run at any time: every step is idempotent.
#
# Usage:
#   ./setup.sh                          interactive (recommended)
#   ./setup.sh --skip-claude            skip Claude CLI
#   ./setup.sh --skip-codex             skip Codex CLI
#   ./setup.sh --skip-ssh               skip SSH key setup
#   ./setup.sh --skip-claude --skip-codex --skip-ssh

set -euo pipefail

# ── Colors & helpers ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log()     { echo -e "${GREEN}[SETUP]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()     { echo -e "${RED}[ERR]${NC}   $1"; exit 1; }
info()    { echo -e "  ${DIM}$1${NC}"; }
section() { echo -e "\n${CYAN}${BOLD}━━━  $1  ━━━${NC}"; }
ok()      { echo -e "  ${GREEN}✓${NC}  $1"; }
skip()    { echo -e "  ${YELLOW}–${NC}  $1 ${DIM}(skipped)${NC}"; }
bullet()  { echo -e "  ${CYAN}·${NC}  $1"; }

# Read a yes/no answer from the terminal (not stdin, to survive piped installs).
# Returns 0 for yes, 1 for no. Default is yes.
ask() {
    local prompt="$1"
    local answer
    echo -en "\n  ${YELLOW}?${NC}  ${BOLD}${prompt}${NC} ${DIM}[Y/n]${NC} "
    read -r answer </dev/tty
    echo ""
    [[ "$answer" =~ ^[Nn] ]] && return 1 || return 0
}

# Same but default is no.
ask_no() {
    local prompt="$1"
    local answer
    echo -en "\n  ${YELLOW}?${NC}  ${BOLD}${prompt}${NC} ${DIM}[y/N]${NC} "
    read -r answer </dev/tty
    echo ""
    [[ "$answer" =~ ^[Yy] ]] && return 0 || return 1
}

# Check if a command is available.
has() { command -v "$1" &>/dev/null; }

# Run a docker command, prefixing with sudo if the current shell session
# does not yet have the docker group active (e.g. right after usermod).
# This is the common case for a non-root sudo user on first install.
dk() {
    if groups 2>/dev/null | grep -qw docker; then
        docker "$@"
    else
        sudo docker "$@"
    fi
}

# ── Parse flags ───────────────────────────────────────────────────────────────
SKIP_CLAUDE=false
SKIP_CODEX=false
SKIP_SSH=false

for arg in "$@"; do
    case "$arg" in
        --skip-claude) SKIP_CLAUDE=true ;;
        --skip-codex)  SKIP_CODEX=true  ;;
        --skip-ssh)    SKIP_SSH=true    ;;
        *) err "Unknown argument: $arg
Usage: ./setup.sh [--skip-claude] [--skip-codex] [--skip-ssh]" ;;
    esac
done

# ── OS detection ──────────────────────────────────────────────────────────────
if [[ "$(uname -s)" != "Linux" ]]; then
    err "This script is for Linux only. Detected: $(uname -s)"
fi

OS_ID="unknown"
if [ -f /etc/os-release ]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    OS_ID="${ID:-unknown}"
fi

if has apt-get;  then PKG="apt"
elif has dnf;    then PKG="dnf"
elif has yum;    then PKG="yum"
elif has pacman; then PKG="pacman"
else PKG="unknown"; fi

# ─────────────────────────────────────────────────────────────────────────────
# Pre-flight: collect all choices BEFORE doing anything
# ─────────────────────────────────────────────────────────────────────────────
section "Setup plan"

echo ""
log "This script will:"
bullet "Install Docker + Docker Compose (if missing)"
bullet "Install Node.js (if Claude or Codex are needed)"

WANT_CLAUDE=false
WANT_CODEX=false
WANT_SSH=false

# Claude
if [ "$SKIP_CLAUDE" = true ]; then
    skip "Claude CLI  →  --skip-claude flag set"
elif ask "Install Claude CLI (Anthropic)?"; then
    WANT_CLAUDE=true
    bullet "Install + authenticate Claude CLI"
else
    skip "Claude CLI"
fi

# Codex
if [ "$SKIP_CODEX" = true ]; then
    skip "Codex CLI  →  --skip-codex flag set"
elif ask "Install Codex CLI (OpenAI)?"; then
    WANT_CODEX=true
    bullet "Install Codex CLI  (you will need your OPENAI_API_KEY)"
else
    skip "Codex CLI"
fi

# SSH
if [ "$SKIP_SSH" = true ]; then
    skip "SSH key  →  --skip-ssh flag set"
elif ask "Set up SSH key for GitHub?"; then
    WANT_SSH=true
    bullet "Generate SSH key + add GitHub to known_hosts"
else
    skip "SSH key"
fi

bullet "Create workspace directory"
bullet "Pull and start VS Code Server"

echo ""
ask "Ready to start?" || { log "Setup cancelled."; exit 0; }

# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Docker
# ─────────────────────────────────────────────────────────────────────────────
section "Docker"

if has docker; then
    DOCKER_VER=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    ok "Docker ${DOCKER_VER} already installed."
else
    warn "Docker not found — installing via get.docker.com ..."
    curl -fsSL https://get.docker.com | sudo sh
    # Allow the current user to run Docker without sudo.
    sudo usermod -aG docker "$USER"
    ok "Docker installed."
    warn "You may need to log out and back in (or run 'newgrp docker') for"
    warn "Docker group permissions to take effect in the current shell."
fi

# Docker Compose (v2 plugin).
if dk compose version &>/dev/null 2>&1; then
    COMPOSE_VER=$(dk compose version --short 2>/dev/null || echo "v2")
    ok "Docker Compose plugin ${COMPOSE_VER} already installed."
elif has docker-compose; then
    ok "docker-compose (standalone v1) found — will use it."
else
    warn "Docker Compose not found — installing ..."
    case "$PKG" in
        apt)
            sudo apt-get update -qq
            sudo apt-get install -y docker-compose-plugin
            ;;
        dnf|yum)
            sudo "$PKG" install -y docker-compose-plugin
            ;;
        pacman)
            sudo pacman -S --noconfirm docker-compose
            ;;
        *)
            log "Installing Docker Compose binary ..."
            COMPOSE_URL="https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)"
            sudo curl -fsSL "$COMPOSE_URL" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            ;;
    esac
    ok "Docker Compose installed."
fi

# Ensure Docker daemon is running.
if ! dk info &>/dev/null 2>&1; then
    warn "Docker daemon not running — starting ..."
    sudo systemctl start docker 2>/dev/null \
        || sudo service docker start 2>/dev/null \
        || err "Could not start Docker daemon. Run: sudo systemctl start docker"
    sleep 2
    dk info &>/dev/null 2>&1 \
        || err "Docker daemon still not responding after start attempt."
fi
ok "Docker daemon is running."

# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — Node.js (only if Claude or Codex are wanted)
# ─────────────────────────────────────────────────────────────────────────────
section "Node.js"

if [ "$WANT_CLAUDE" = false ] && [ "$WANT_CODEX" = false ]; then
    skip "Node.js  (not needed — Claude and Codex both skipped)"
elif has node; then
    ok "Node.js $(node --version) already installed."
else
    warn "Node.js not found — installing LTS ..."
    case "$PKG" in
        apt)
            # NodeSource supports Debian/Ubuntu only.
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        dnf)
            # Node.js LTS via module stream.
            sudo dnf module install -y nodejs:lts || sudo dnf install -y nodejs npm
            ;;
        yum)
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo -E bash -
            sudo yum install -y nodejs
            ;;
        pacman)
            sudo pacman -S --noconfirm nodejs npm
            ;;
        *)
            err "Cannot install Node.js automatically on this system.
Install it manually from https://nodejs.org, then re-run ./setup.sh."
            ;;
    esac
    ok "Node.js $(node --version) installed."
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — Claude CLI
# ─────────────────────────────────────────────────────────────────────────────
section "Claude CLI"

if [ "$WANT_CLAUDE" = false ]; then
    skip "Claude CLI"
else
    # Install if missing.
    if has claude; then
        ok "Claude CLI already installed ($(claude --version 2>/dev/null || echo 'unknown version'))."
    else
        log "Installing Claude CLI ..."
        npm install -g @anthropic-ai/claude-code
        ok "Claude CLI installed."
    fi

    # Check authentication.
    CLAUDE_CREDS="$HOME/.claude/.credentials.json"
    CLAUDE_OK=false

    if [ -f "$CLAUDE_CREDS" ] && grep -q '"accessToken"' "$CLAUDE_CREDS" 2>/dev/null; then
        EXPIRES=$(grep -o '"expiresAt":[0-9]*' "$CLAUDE_CREDS" 2>/dev/null \
                  | grep -o '[0-9]*$' || echo "0")
        NOW_MS=$(( $(date +%s) * 1000 ))
        if [ "${EXPIRES:-0}" -gt "$NOW_MS" ] 2>/dev/null; then
            CLAUDE_OK=true
        fi
    fi

    if [ "$CLAUDE_OK" = true ]; then
        ok "Claude already authenticated."
    else
        warn "Claude is not authenticated (or token expired)."
        info "A browser window will open for OAuth login."
        if ask "Authenticate Claude now?"; then
            claude auth login
            ok "Claude authentication complete."
        else
            warn "Skipped — run 'claude auth login' before using Claude."
        fi
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 4 — Codex CLI
# ─────────────────────────────────────────────────────────────────────────────
section "Codex CLI"

if [ "$WANT_CODEX" = false ]; then
    skip "Codex CLI"
else
    # Install if missing.
    if has codex; then
        ok "Codex CLI already installed."
    else
        log "Installing Codex CLI ..."
        npm install -g @openai/codex
        ok "Codex CLI installed."
    fi

    # Codex authenticates via OPENAI_API_KEY.
    # Check common locations where it might already be set.
    CODEX_OK=false
    if [ -n "${OPENAI_API_KEY:-}" ]; then
        CODEX_OK=true
        ok "OPENAI_API_KEY is already set in the current environment."
    elif grep -qE 'OPENAI_API_KEY' "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile" 2>/dev/null; then
        CODEX_OK=true
        ok "OPENAI_API_KEY found in shell profile."
    fi

    if [ "$CODEX_OK" = false ]; then
        warn "OPENAI_API_KEY is not set. Codex needs it to work."
        info "You can find your API key at: https://platform.openai.com/api-keys"
        if ask "Enter your OpenAI API key now?"; then
            echo -en "  Paste your key (sk-...): "
            read -rs OPENAI_API_KEY_INPUT </dev/tty
            echo ""
            if [[ "$OPENAI_API_KEY_INPUT" == sk-* ]]; then
                # Persist to ~/.bashrc and export for this session.
                echo "" >> "$HOME/.bashrc"
                echo "# OpenAI API key (added by Dev Center setup)" >> "$HOME/.bashrc"
                echo "export OPENAI_API_KEY=\"${OPENAI_API_KEY_INPUT}\"" >> "$HOME/.bashrc"
                export OPENAI_API_KEY="$OPENAI_API_KEY_INPUT"
                ok "OPENAI_API_KEY saved to ~/.bashrc and active for this session."
            else
                warn "Key does not look valid (expected sk-...). Not saved."
                warn "Set it manually: echo 'export OPENAI_API_KEY=sk-...' >> ~/.bashrc"
            fi
        else
            warn "Skipped — add this to ~/.bashrc before using Codex:"
            warn "  export OPENAI_API_KEY=sk-your-key-here"
        fi
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 5 — SSH key for GitHub
# ─────────────────────────────────────────────────────────────────────────────
section "SSH key (GitHub)"

if [ "$WANT_SSH" = false ]; then
    skip "SSH key setup"
else
    SSH_DIR="$HOME/.ssh"
    mkdir -p "$SSH_DIR"
    chmod 700 "$SSH_DIR"
    SSH_KEY=""

    for candidate in \
            "$SSH_DIR/id_ed25519" \
            "$SSH_DIR/id_rsa" \
            "$SSH_DIR/id_ecdsa"; do
        if [ -f "$candidate" ]; then
            SSH_KEY="$candidate"
            break
        fi
    done

    if [ -n "$SSH_KEY" ]; then
        ok "SSH key found: $SSH_KEY"
        info "If you haven't added this key to GitHub yet, here is your public key:"
        echo ""
        echo -e "  ${CYAN}$(cat "${SSH_KEY}.pub")${NC}"
        echo ""
        info "Add it at: https://github.com/settings/ssh/new"
    else
        warn "No SSH key found in $SSH_DIR."
        info "An ed25519 key will be generated — the strongest and most compact type."
        if ask "Generate a new SSH key?"; then
            echo -en "  Enter your GitHub email: "
            read -r SSH_EMAIL </dev/tty
            echo ""
            ssh-keygen -t ed25519 -C "${SSH_EMAIL:-dev-center}" \
                       -f "$SSH_DIR/id_ed25519" -N ""
            SSH_KEY="$SSH_DIR/id_ed25519"
            ok "SSH key generated: $SSH_KEY"
            echo ""
            log "Add this public key to your GitHub account:"
            info "  → https://github.com/settings/ssh/new"
            echo ""
            echo -e "  ${CYAN}$(cat "${SSH_KEY}.pub")${NC}"
            echo ""
            ask_no "Press Enter once you have added it to GitHub, then continue." || true
        else
            warn "No SSH key — private repo clones over SSH will not work."
        fi
    fi

    # Pre-seed GitHub in known_hosts to avoid interactive prompts.
    if [ -n "$SSH_KEY" ]; then
        KNOWN_HOSTS="$SSH_DIR/known_hosts"
        if ! grep -q "github.com" "$KNOWN_HOSTS" 2>/dev/null; then
            log "Adding github.com to known_hosts ..."
            ssh-keyscan -H github.com >> "$KNOWN_HOSTS" 2>/dev/null \
                && ok "github.com added to known_hosts." \
                || warn "ssh-keyscan failed — run manually:
    ssh-keyscan -H github.com >> ~/.ssh/known_hosts"
        else
            ok "github.com already in known_hosts."
        fi
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 6 — Workspace + .env
# ─────────────────────────────────────────────────────────────────────────────
section "Configuration (.env)"

if [ ! -f ".env" ]; then
    cp .env.example .env
    warn ".env created from .env.example."
    warn "Edit the two required values, then re-run ./setup.sh:"
    warn ""
    warn "  WORKSPACE_DIR   — absolute path where your projects will live"
    warn "  VSCODE_PASSWORD — password to access VS Code in the browser"
    warn ""
    warn "  nano .env   (or your preferred editor)"
    exit 1
fi

ok ".env already exists."

# shellcheck disable=SC1091
source .env

if [ -z "${WORKSPACE_DIR:-}" ]; then
    err "WORKSPACE_DIR is not set in .env — edit it and re-run ./setup.sh."
fi
if [ -z "${VSCODE_PASSWORD:-}" ]; then
    err "VSCODE_PASSWORD is not set in .env — edit it and re-run ./setup.sh."
fi
if [ "${VSCODE_PASSWORD}" = "changeme" ]; then
    warn "VSCODE_PASSWORD is still set to 'changeme' — consider changing it in .env."
fi

# Create WORKSPACE_DIR — may require sudo if it is under /srv, /opt, etc.
if mkdir -p "${WORKSPACE_DIR}" 2>/dev/null; then
    ok "Workspace directory: ${WORKSPACE_DIR}"
else
    log "Creating ${WORKSPACE_DIR} with sudo (directory requires elevated permissions) ..."
    sudo mkdir -p "${WORKSPACE_DIR}"
    sudo chown "$USER:$USER" "${WORKSPACE_DIR}"
    ok "Workspace directory: ${WORKSPACE_DIR} (ownership set to $USER)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 7 — Launch VS Code Server
# ─────────────────────────────────────────────────────────────────────────────
section "VS Code Server"

PORT="${VSCODE_PORT:-8443}"

log "Pulling latest image ..."
dk compose pull --quiet

log "Starting container ..."
dk compose up -d

# Wait up to 40 s for the server to respond.
log "Waiting for VS Code Server on port ${PORT} ..."
READY=false
for _ in {1..20}; do
    if curl -sk "https://localhost:${PORT}" -o /dev/null 2>&1; then
        READY=true
        break
    fi
    sleep 2
done

if [ "$READY" = true ]; then
    ok "VS Code Server is running."
else
    warn "VS Code Server did not respond within 40s."
    warn "Check container logs: docker compose logs vscode"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────────────────
section "All done"

HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo -e "  ${GREEN}${BOLD}VS Code Server is ready.${NC}"
echo ""
bullet "URL       : ${CYAN}http://${HOST_IP}:${PORT}${NC}"
bullet "Password  : ${YELLOW}${VSCODE_PASSWORD}${NC}"
bullet "Workspace : ${WORKSPACE_DIR}"
echo ""

[ "$WANT_CLAUDE" = true ] && bullet "Claude CLI : installed  — run ${CYAN}claude${NC} to use it"
[ "$WANT_CODEX"  = true ] && bullet "Codex CLI  : installed  — run ${CYAN}codex${NC} to use it"
[ "$WANT_SSH"    = true ] && [ -n "${SSH_KEY:-}" ] \
    && bullet "SSH key    : ${SSH_KEY}  — add the .pub to GitHub if not done yet"

echo ""
