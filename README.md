# Dev Center

VS Code Server in Docker — access your projects from any browser.

## Quick Start

```bash
# 1. Clone and enter the repo
git clone git@github.com:Florian-BARRE/Dev-Center.git
cd Dev-Center

# 2. Run setup (installs Docker, Node, Claude, Codex, SSH key)
chmod +x setup.sh start.sh
./setup.sh

# 3. Edit .env
cp .env.example .env   # already done by setup.sh
nano .env              # set WORKSPACE_DIR and VSCODE_PASSWORD

# 4. Start
./start.sh
```

Open your browser at `http://<your-server-ip>:<VSCODE_PORT>`.

---

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `WORKSPACE_DIR` | `/srv/projects` | Host path mounted as `/workspace` in VS Code |
| `VSCODE_PORT` | `8443` | Port exposed on the host |
| `VSCODE_PASSWORD` | `changeme` | Password to access the VS Code web UI |
| `VSCODE_TZ` | `Europe/Paris` | Container timezone |

---

## `setup.sh` flags

```bash
./setup.sh                        # interactive — asks for each optional step
./setup.sh --skip-claude          # skip Claude CLI install + auth
./setup.sh --skip-codex           # skip Codex CLI install + auth
./setup.sh --skip-ssh             # skip SSH key setup
```

What `setup.sh` installs / checks:
- Docker + Docker Compose
- Node.js (required for Claude and Codex CLIs)
- Claude CLI (`@anthropic-ai/claude-code`) — optional
- Codex CLI (`@openai/codex`) — optional
- SSH key for GitHub — optional

---

## `start.sh` flags

```bash
./start.sh          # start (or restart) VS Code Server
./start.sh --stop   # stop the container
```
