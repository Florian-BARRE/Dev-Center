# Dev Center

VS Code Server in Docker — access your projects from any browser.

## Setup

```bash
git clone git@github.com:Florian-BARRE/Dev-Center.git
cd Dev-Center

# First run: creates .env from example, then exit to let you fill it in.
chmod +x setup.sh
./setup.sh

# Edit .env (WORKSPACE_DIR, VSCODE_PASSWORD), then re-run.
nano .env
./setup.sh
```

`setup.sh` is idempotent — safe to re-run at any time.

---

## What `setup.sh` does

1. **Docker + Docker Compose** — installs if missing
2. **Node.js** — installs LTS if Claude or Codex are needed
3. **Claude CLI** — optional, installs + handles auth
4. **Codex CLI** — optional, installs + handles auth
5. **SSH key** — optional, generates ed25519 + seeds GitHub known_hosts
6. **Workspace** — creates `WORKSPACE_DIR` from `.env`
7. **VS Code Server** — pulls image + starts container

---

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `WORKSPACE_DIR` | `/srv/projects` | Host path mounted as `/workspace` in VS Code |
| `VSCODE_PORT` | `8443` | Port exposed on the host |
| `VSCODE_PASSWORD` | `changeme` | Password to access the VS Code web UI |
| `VSCODE_TZ` | `Europe/Paris` | Container timezone |

---

## Flags

```bash
./setup.sh --skip-claude   # skip Claude CLI install + auth
./setup.sh --skip-codex    # skip Codex CLI install + auth
./setup.sh --skip-ssh      # skip SSH key setup
```
