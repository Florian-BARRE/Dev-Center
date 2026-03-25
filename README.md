# Dev Center

Dev Center is a fullstack application to manage Git projects and run Claude Code sessions from a web UI.
It also includes an optional `code-server` container (VS Code in browser) on shared workspaces.

It clones repositories, stores project/runtime state, starts Claude sessions per project, and auto-renews sessions before expiration.

## Table of Contents

- [What You Need](#what-you-need)
- [Startup Guide](#startup-guide)
  - [Step 0 - Authenticate Claude on Host (Required)](#step-0---authenticate-claude-on-host-required)
  - [Step 1 - Create Environment Files](#step-1---create-environment-files)
  - [Step 2 - Configure Required Values](#step-2---configure-required-values)
  - [Step 3 - Start the Stack](#step-3---start-the-stack)
  - [Step 4 - Open the App](#step-4---open-the-app)
  - [Step 5 - Stop the Stack](#step-5---stop-the-stack)
- [Architecture Overview](#architecture-overview)
- [How the App Works](#how-the-app-works)
- [Security Model](#security-model)
- [Configuration Reference](#configuration-reference)
- [Repository Structure](#repository-structure)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)
- [Production Notes](#production-notes)

## What You Need

- Docker + Docker Compose v2
- Bash shell (Git Bash is fine on Windows)
- Internet access for Git clone
- Optional: SSH key for private repositories
- Claude CLI available on host machine

## Startup Guide

### Step 0 - Authenticate Claude on Host (Required)

Run on the host machine before starting containers:

```bash
claude
```

Why this is required:
- Dev Center mounts host Claude credentials into the backend container
- Session startup fails if credentials are missing or expired

Expected Claude files on host:
- `~/.claude/.credentials.json`
- `~/.claude.json` (workspace trust/global config)

### Step 1 - Create Environment Files

From repository root:

```bash
cp services/common/.env.example services/common/.env
cp services/dev-center-app/.env.example services/dev-center-app/.env
```

### Step 2 - Configure Required Values

Edit `services/common/.env`:
- `DATA_ROOT` is required
- other values are optional overrides

Windows example:

```env
DATA_ROOT=C:/dev-data/dev-center
```

### Step 3 - Start the Stack

Production mode (single backend container serving API + built frontend):

```bash
./start.sh
```

Development mode (backend hot reload + Vite HMR frontend):

```bash
./start.sh --dev
```

### Step 4 - Open the App

- Production: `http://localhost:8000` (or `DEV_CENTER_PORT`)
- Development frontend: `http://localhost:5173` (or `FRONTEND_PORT`)
- Backend health endpoint: `http://localhost:8000/api/health`
- VS Code in browser: `http://localhost:8443` (or `CODE_SERVER_PORT`)

### Step 5 - Stop the Stack

Production:

```bash
docker compose --env-file services/common/.env -f docker-compose.yml down
```

Development:

```bash
docker compose --env-file services/common/.env -f docker-compose.yml -f docker-compose.dev.yml down
```

## Architecture Overview

### Production

```text
+----------------------------------------------------------------------------+
|                                   HOST MACHINE                             |
|                                                                            |
|  Browser                                                                   |
|     | HTTP : DEV_CENTER_PORT                                               |
|     v                                                                      |
|  +----------------------------- Docker Compose -------------------------+  |
|  |                                                                      |  |
|  |  Network: dev-center-net                                             |  |
|  |                                                                      |  |
|  |  +-------------------------- dev-center-app ----------------------+  |  |
|  |  | container_name: dev-center-backend                             |  |  |
|  |  | FastAPI API at /api/*                                          |  |  |
|  |  | Serves built frontend static files                             |  |  |
|  |  |                                                                |  |  |
|  |  | Mounts:                                                        |  |  |
|  |  | - ${DATA_ROOT}/workspaces -> /workspaces                       |  |  |
|  |  | - ${DATA_ROOT}/data       -> /data                             |  |  |
|  |  | - ${CLAUDE_HOST_DIR}      -> /root/.claude                     |  |  |
|  |  | - ${CLAUDE_JSON_HOST_PATH}-> /root/.claude.json                |  |  |
|  |  | - ${SSH_KEY_PATH} (ro)    -> /root/.ssh                        |  |  |
|  |  | - /var/run/docker.sock    -> /var/run/docker.sock              |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                      |  |
|  |  +-------------------------- code-server -------------------------+  |  |
|  |  | Browser IDE for /workspaces                                    |  |  |
|  |  | Port: CODE_SERVER_PORT                                         |  |  |
|  |  | Auth mode: PASSWORD empty -> none, PASSWORD set -> password    |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  +----------------------------------------------------------------------+  |
+----------------------------------------------------------------------------+
```

### Development

```text
+-----------------------------------------------------------------------+
|                                   HOST MACHINE                        |
|                                                                       |
|  Browser A (UI dev)                    Browser B (API direct)         |
|  http://localhost:5173                 http://localhost:8000          |
|        |                                         |                    |
|        v                                         v                    |
|  +----------------------------- Docker Compose --------------------+  |
|  |                                                                 |  |
|  |  +------------------- dev-center-frontend --------------------+ |  |
|  |  | Vite dev server (HMR)                                      | |  |
|  |  | Port: FRONTEND_PORT                                        | |  |
|  |  | Proxy: /api -> http://dev-center-app:8000                  | |  |
|  |  | Bind mount: ./src/dev_center_app/frontend                  | |  |
|  |  +------------------------------------------------------------+ |  |
|  |                                                                 |  |
|  |  +------------------- dev-center-app -------------------------+ |  |
|  |  | FastAPI + uvicorn --reload                                 | |  |
|  |  | Port: DEV_CENTER_PORT                                      | |  |
|  |  | Bind mount: ./src/dev_center_app                           | |  |
|  |  +------------------------------------------------------------+ |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

## How the App Works

### Request flow

```text
Browser -> FastAPI (/api/*) -> app services (state/session/git/auth/scheduler)
        -> JSON response

Browser -> FastAPI (/) -> static frontend files from frontend/dist
```

### Session lifecycle

```text
1) User creates/selects a project in the UI
2) Backend stores metadata in /data
3) Backend clones/updates repository in /workspaces
4) Backend starts a Claude Code session
5) Scheduler monitors TTL and renew threshold
6) Backend renews session before expiration
```

### Startup flow (`start.sh`)

```text
start.sh
  -> ensure env files exist
  -> load services/common/.env
  -> validate DATA_ROOT and create directories
  -> check Claude credentials on host
  -> check SSH keys on host
  -> docker compose up -d --build
  -> poll /api/health until healthy
```

## Security Model

### Critical point: host Docker daemon access

The backend mounts host Docker socket:
- `/var/run/docker.sock`

This means backend-controlled processes can operate the host Docker daemon.
Treat this as high privilege access on the host.

### Trust boundary

```text
[Host OS + Docker daemon] <--- high trust boundary ---> [dev-center-app container]
                                      ^
                                      |
                       mounted docker.sock provides daemon control
```

### Additional implications

- Host workspace files are modified directly (`DATA_ROOT/workspaces`)
- Host Claude credentials are available inside backend container

### Recommended posture

- Run on a trusted machine/VM
- Restrict UI access
- Use trusted repositories and prompts
- Rotate credentials if compromise is suspected

## Configuration Reference

### `services/common/.env` (Compose interpolation only)

| Variable              | Required  | Scope      | Description                                                 |
|-----------------------|-----------|------------|-------------------------------------------------------------|
| `DATA_ROOT`           | Yes       | Prod + Dev | Host root folder for persistent data (`workspaces`, `data`) |
| `DEV_CENTER_PORT`     | No        | Prod + Dev | Host port for backend/API                                   |
| `CODE_SERVER_PORT`    | No        | Prod + Dev | Host port for code-server (browser IDE)                     |
| `FRONTEND_PORT`       | No        | Dev only   | Host port for Vite dev server                               |
| `CLAUDE_HOST_DIR`     | No        | Prod + Dev | Host path to Claude credentials directory                   |
| `CLAUDE_JSON_HOST_PATH` | No      | Prod + Dev | Host path to Claude global config/trust file               |
| `SSH_KEY_PATH`        | No        | Prod + Dev | Host path to SSH keys directory                             |
| `CHOKIDAR_USEPOLLING` | No        | Dev only   | Enable polling file watcher if FS events are unreliable     |

### `services/vscode/.env` (code-server runtime config)

| Variable   | Required  | Description                                                                            |
|------------|-----------|----------------------------------------------------------------------------------------|
| `PASSWORD` | No        | If empty, code-server starts with `--auth none`; if set, starts with `--auth password` |

### `services/dev-center-app/.env` (backend runtime config)

| Variable                  | Required  | Description                       |
|---------------------------|-----------|-----------------------------------|
| `FASTAPI_APP_NAME`        | No        | App display name in metadata/logs |
| `CORS_ALLOWED_ORIGINS`    | No        | Comma-separated allowed origins   |
| `DEFAULT_TTL_HOURS`       | No        | Default session TTL               |
| `RENEW_THRESHOLD_MINUTES` | No        | Session renew threshold           |

## Repository Structure

```text
.
|- docker-compose.yml
|- docker-compose.dev.yml
|- start.sh
|- README.md
|- services/
|  |- common/
|  |  |- .env
|  |  `- .env.example
|  `- dev-center-app/
|     |- .env
|     `- .env.example
|  `- vscode/
|     |- .env
|     `- .env.example
`- src/
   |- .dockerignore
   `- dev_center_app/
      |- Dockerfile
      |- docker-entrypoint.sh
      |- entrypoint.py
      |- pyproject.toml
      |- backend/
      |- config/
      |- libs/
      |- tests/
      `- frontend/
         |- Dockerfile.dev
         |- vite.config.ts
         |- package.json
         `- src/
```

## Operations

### Validate Compose configuration

```bash
docker compose --env-file services/common/.env -f docker-compose.yml config --quiet
docker compose --env-file services/common/.env -f docker-compose.yml -f docker-compose.dev.yml config --quiet
```

### Start manually (without `start.sh`)

Production:

```bash
docker compose --env-file services/common/.env -f docker-compose.yml up -d --build
```

Development:

```bash
docker compose --env-file services/common/.env -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### Tail logs

Production:

```bash
docker compose --env-file services/common/.env -f docker-compose.yml logs -f dev-center-app
```

Development:

```bash
docker compose --env-file services/common/.env -f docker-compose.yml -f docker-compose.dev.yml logs -f
```

### Rebuild images

```bash
docker compose --env-file services/common/.env -f docker-compose.yml build --no-cache
```

## Troubleshooting

### Claude sessions do not start

- Run `claude` on host and complete login
- Confirm `~/.claude/.credentials.json` exists
- Confirm token is not expired

### Private Git clone fails

- Check `SSH_KEY_PATH`
- Ensure key files exist (`id_ed25519` or `id_rsa`)
- Ensure repository access rights are correct

### Windows mount/path errors

Use a simple root-level path:

```env
DATA_ROOT=C:/dev-data/dev-center
```

### Frontend hot reload unstable on Docker Desktop

Enable polling mode:

```env
CHOKIDAR_USEPOLLING=true
```

## Production Notes

- Production mode stays simple: backend + optional code-server
- Optional code-server service can be enabled with no-auth or password auth
- Frontend is served as static build output by FastAPI
- Development mode is split for fast iteration (hot reload + HMR)
- Because of Docker socket mount, deploy only in trusted environments

---

## **Author**

Project created and maintained by **Florian BARRE**.  
For questions or contributions, feel free to contact me.

[My Website](https://florianbarre.fr/) | [My LinkedIn](www.linkedin.com/in/barre-florian) | [My GitHub](https://github.com/Florian-BARRE)
