#!/usr/bin/env bash
# Dev Center — Machine setup script.
#
# Verifies and installs all required tools on the current machine.
# Safe to run multiple times: each step is idempotent.
#
# Usage:
#   ./setup.sh                        interactive (asks for each optional tool)
#   ./setup.sh --skip-claude          skip Claude CLI setup
#   ./setup.sh --skip-codex           skip Codex CLI setup
#   ./setup.sh --skip-ssh             skip SSH key setup
#   ./setup.sh --skip-claude --skip-codex   combine flags freely

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${GREEN}[SETUP]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()     { echo -e "${RED}[ERR]${NC}   $1"; exit 1; }
section() { echo -e "\n${CYAN}${BOLD}━━━ $1 ━━━${NC}"; }
ok()      { echo -e "  ${GREEN}✓${NC} $1"; }
skip()    { echo -e "  ${YELLOW}–${NC} $1 (skipped)"; }

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

# ── Helpers ───────────────────────────────────────────────────────────────────

# Ask a yes/no question. Returns 0 for yes, 1 for no.
# Usage: ask "Install Claude CLI?" && do_something
ask() {
    local prompt="$1"
    local answer
    echo -en "  ${YELLOW}?${NC} ${prompt} [Y/n] "
    read -r answer </dev/tty
    [[ "$answer" =~ ^[Nn] ]] && return 1 || return 0
}

# Check if a command exists.
has() { command -v "$1" &>/dev/null; }

# Detect the OS and package manager.
detect_os() {
    if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        source /etc/os-release
        OS_ID="${ID:-unknown}"
        OS_LIKE="${ID_LIKE:-}"
    else
        OS_ID="unknown"
        OS_LIKE=""
    fi

    if has apt-get; then
        PKG_MANAGER="apt"
    elif has dnf; then
        PKG_MANAGER="dnf"
    elif has yum; then
        PKG_MANAGER="yum"
    elif has pacman; then
        PKG_MANAGER="pacman"
    else
        PKG_MANAGER="unknown"
    fi
}

# Install a package using the detected package manager.
install_pkg() {
    local pkg="$1"
    case "$PKG_MANAGER" in
        apt)    sudo apt-get install -y "$pkg" ;;
        dnf)    sudo dnf install -y "$pkg" ;;
        yum)    sudo yum install -y "$pkg" ;;
        pacman) sudo pacman -S --noconfirm "$pkg" ;;
        *)      err "Unsupported package manager. Install '$pkg' manually and re-run." ;;
    esac
}

# ── OS detection ──────────────────────────────────────────────────────────────
detect_os

section "System"
log "OS: ${OS_ID}  |  Package manager: ${PKG_MANAGER}"

# Ensure running on Linux.
if [[ "$(uname -s)" != "Linux" ]]; then
    err "This script is designed for Linux. Detected: $(uname -s)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Docker
# ─────────────────────────────────────────────────────────────────────────────
section "Docker"

if has docker; then
    DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    ok "Docker already installed (${DOCKER_VERSION})"
else
    warn "Docker not found."
    if ask "Install Docker?"; then
        log "Installing Docker via official install script ..."
        curl -fsSL https://get.docker.com | sudo sh
        # Add current user to docker group so we can run docker without sudo.
        sudo usermod -aG docker "$USER"
        ok "Docker installed. NOTE: log out and back in (or run 'newgrp docker') for group to take effect."
    else
        err "Docker is required. Re-run after installing Docker."
    fi
fi

# ── Docker Compose ────────────────────────────────────────────────────────────
if docker compose version &>/dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "v2")
    ok "Docker Compose plugin already installed (${COMPOSE_VERSION})"
elif has docker-compose; then
    ok "docker-compose (standalone) found — note: 'docker compose' (v2) is preferred."
else
    warn "Docker Compose not found."
    if ask "Install Docker Compose plugin?"; then
        case "$PKG_MANAGER" in
            apt)
                sudo apt-get update -qq
                sudo apt-get install -y docker-compose-plugin
                ;;
            dnf|yum)
                sudo "$PKG_MANAGER" install -y docker-compose-plugin
                ;;
            *)
                # Fallback: install via pip or binary.
                log "Installing Docker Compose via binary ..."
                COMPOSE_URL="https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)"
                sudo curl -fsSL "$COMPOSE_URL" -o /usr/local/bin/docker-compose
                sudo chmod +x /usr/local/bin/docker-compose
                ;;
        esac
        ok "Docker Compose installed."
    else
        err "Docker Compose is required. Re-run after installing it."
    fi
fi

# ── Docker daemon running ─────────────────────────────────────────────────────
if ! docker info &>/dev/null 2>&1; then
    warn "Docker daemon is not running. Attempting to start ..."
    sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
    sleep 2
    if ! docker info &>/dev/null 2>&1; then
        err "Docker daemon could not be started. Start it manually: sudo systemctl start docker"
    fi
fi
ok "Docker daemon is running."

# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — Node.js (required for Claude and Codex CLIs)
# ─────────────────────────────────────────────────────────────────────────────
section "Node.js"

NEED_NODE=false
[[ "$SKIP_CLAUDE" = false ]] && NEED_NODE=true
[[ "$SKIP_CODEX"  = false ]] && NEED_NODE=true

if [ "$NEED_NODE" = false ]; then
    skip "Node.js (not needed since Claude and Codex are both skipped)"
elif has node; then
    NODE_VERSION=$(node --version)
    ok "Node.js already installed (${NODE_VERSION})"
else
    warn "Node.js not found."
    if ask "Install Node.js (LTS via NodeSource)?"; then
        log "Installing Node.js LTS ..."
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        install_pkg nodejs
        ok "Node.js installed ($(node --version))"
    else
        warn "Node.js skipped — Claude and Codex CLIs will not be installed."
        SKIP_CLAUDE=true
        SKIP_CODEX=true
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — Claude CLI
# ─────────────────────────────────────────────────────────────────────────────
section "Claude CLI"

if [ "$SKIP_CLAUDE" = true ]; then
    skip "Claude CLI"
else
    if ! ask "Set up Claude CLI?"; then
        skip "Claude CLI"
        SKIP_CLAUDE=true
    fi
fi

if [ "$SKIP_CLAUDE" = false ]; then
    # Install or update.
    if has claude; then
        ok "Claude CLI already installed ($(claude --version 2>/dev/null || echo 'version unknown'))"
    else
        log "Installing Claude CLI ..."
        npm install -g @anthropic-ai/claude-code
        ok "Claude CLI installed."
    fi

    # Check authentication.
    CLAUDE_CREDS="$HOME/.claude/.credentials.json"
    CLAUDE_OK=false

    if [ -f "$CLAUDE_CREDS" ] && grep -q '"accessToken"' "$CLAUDE_CREDS" 2>/dev/null; then
        EXPIRES=$(grep -o '"expiresAt":[0-9]*' "$CLAUDE_CREDS" 2>/dev/null | grep -o '[0-9]*$' || echo "0")
        NOW_MS=$(( $(date +%s) * 1000 ))
        if [ "${EXPIRES:-0}" -gt "$NOW_MS" ] 2>/dev/null; then
            CLAUDE_OK=true
        fi
    fi

    if [ "$CLAUDE_OK" = true ]; then
        ok "Claude already authenticated."
    else
        warn "Claude is not authenticated (or token expired)."
        if ask "Authenticate Claude now? (opens browser)"; then
            claude auth login
            ok "Claude authentication complete."
        else
            warn "Remember to run 'claude auth login' before using Claude."
        fi
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 4 — Codex CLI
# ─────────────────────────────────────────────────────────────────────────────
section "Codex CLI"

if [ "$SKIP_CODEX" = true ]; then
    skip "Codex CLI"
else
    if ! ask "Set up Codex CLI (OpenAI)?"; then
        skip "Codex CLI"
        SKIP_CODEX=true
    fi
fi

if [ "$SKIP_CODEX" = false ]; then
    # Install or update.
    if has codex; then
        ok "Codex CLI already installed."
    else
        log "Installing Codex CLI ..."
        npm install -g @openai/codex
        ok "Codex CLI installed."
    fi

    # Check authentication.
    CODEX_KEY_FILE="$HOME/.codex/auth.json"
    CODEX_OK=false

    if [ -f "$CODEX_KEY_FILE" ] && grep -q '"apiKey"\|"token"' "$CODEX_KEY_FILE" 2>/dev/null; then
        CODEX_OK=true
    elif [ -n "${OPENAI_API_KEY:-}" ]; then
        CODEX_OK=true
    fi

    if [ "$CODEX_OK" = true ]; then
        ok "Codex already authenticated."
    else
        warn "Codex is not authenticated."
        if ask "Authenticate Codex now?"; then
            codex auth login 2>/dev/null || codex login 2>/dev/null || {
                warn "Auto-auth failed. Set your OpenAI API key manually:"
                warn "  export OPENAI_API_KEY=sk-..."
                warn "  or run: codex auth"
            }
        else
            warn "Remember to authenticate Codex before use: codex auth"
        fi
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 5 — SSH key for GitHub
# ─────────────────────────────────────────────────────────────────────────────
section "SSH key (GitHub)"

if [ "$SKIP_SSH" = true ]; then
    skip "SSH key setup"
else
    SSH_DIR="$HOME/.ssh"
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
    else
        warn "No SSH key found in $SSH_DIR."
        if ask "Generate a new SSH key (ed25519)?"; then
            echo -en "  Enter your email for the key label: "
            read -r SSH_EMAIL </dev/tty
            ssh-keygen -t ed25519 -C "${SSH_EMAIL:-dev-center}" -f "$SSH_DIR/id_ed25519" -N ""
            SSH_KEY="$SSH_DIR/id_ed25519"
            ok "SSH key generated: $SSH_KEY"
            echo ""
            log "Your public key (add this to GitHub → Settings → SSH keys):"
            echo ""
            cat "${SSH_KEY}.pub"
            echo ""
        else
            warn "No SSH key — private repo clones over SSH will fail."
        fi
    fi

    # Pre-seed GitHub in known_hosts to avoid interactive prompts in containers.
    if [ -n "$SSH_KEY" ]; then
        KNOWN_HOSTS="$SSH_DIR/known_hosts"
        if ! grep -q "github.com" "$KNOWN_HOSTS" 2>/dev/null; then
            log "Adding github.com to known_hosts ..."
            ssh-keyscan -H github.com >> "$KNOWN_HOSTS" 2>/dev/null \
                && ok "github.com added to known_hosts." \
                || warn "ssh-keyscan failed — run manually: ssh-keyscan -H github.com >> ~/.ssh/known_hosts"
        else
            ok "github.com already in known_hosts."
        fi
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 6 — Workspace + .env
# ─────────────────────────────────────────────────────────────────────────────
section "Workspace"

if [ ! -f ".env" ]; then
    cp .env.example .env
    warn ".env created from .env.example."
    warn "Edit WORKSPACE_DIR and VSCODE_PASSWORD in .env, then re-run ./setup.sh."
    exit 1
else
    ok ".env already exists."
fi

# shellcheck disable=SC1091
source .env

[ -z "${WORKSPACE_DIR:-}" ]   && { warn "WORKSPACE_DIR not set in .env — edit .env and re-run."; exit 1; }
[ -z "${VSCODE_PASSWORD:-}" ] && { warn "VSCODE_PASSWORD not set in .env — edit .env and re-run."; exit 1; }

mkdir -p "${WORKSPACE_DIR}"
ok "Workspace directory ready: ${WORKSPACE_DIR}"

# ─────────────────────────────────────────────────────────────────────────────
# Step 7 — Launch VS Code Server
# ─────────────────────────────────────────────────────────────────────────────
section "VS Code Server"

log "Pulling latest image and starting container ..."
docker compose pull --quiet
docker compose up -d

# Wait for VS Code to be ready.
PORT="${VSCODE_PORT:-8443}"
log "Waiting for VS Code Server on port ${PORT} ..."
for _ in {1..20}; do
    if curl -sk "https://localhost:${PORT}" -o /dev/null 2>&1; then
        break
    fi
    sleep 2
done

ok "VS Code Server is running."

# ─────────────────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────────────────
section "Done"

echo ""
log "Access VS Code at: http://$(hostname -I | awk '{print $1}'):${PORT}"
log "Password: ${VSCODE_PASSWORD}"
log "Workspace: ${WORKSPACE_DIR}"
echo ""
