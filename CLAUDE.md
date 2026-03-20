# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Global Rules

This project follows the global rules defined in the user's Claude configuration:

- **`general.md`** — OOP design, file structure, docstrings, type hints, English-only code
- **`python.md`** — `uv` for dependencies, `loggerplusplus` for logging, `configplusplus` for config, project layout under `src/<app_name>/`
- **`fastapi.md`** — CONTEXT service locator, `entrypoint.py` factory, `@auto_handle_errors` on all routes, `/api/v1` prefix
- **`docker.md`** — Multi-stage builds, uv in Dockerfile, commented instructions, `docker-compose.yml` + `docker-compose.dev.yml`

## Common Commands

```bash
# Install dependencies
uv sync

# Run the app (FastAPI)
uvicorn <app_name>.entrypoint:app --host 0.0.0.0 --port 8000

# Run with hot reload (dev)
uvicorn <app_name>.entrypoint:app --host 0.0.0.0 --port 8000 --reload

# Add a dependency
uv add <package>

# Docker — build and run
docker compose up --build

# Docker — dev mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Project Layout

When code exists, it follows the Docker + FastAPI combined layout:

```
project_root/
├── src/
│   └── <app_name>/          # App source: entrypoint.py, config/, libs/, backend/, frontend/
├── services/
│   ├── <app_name>/.env
│   └── postgres/.env        # If DB is used
├── docker-compose.yml
└── docker-compose.dev.yml
```

`RUNTIME_CONFIG` must always be the **first** import in any entry point — it registers `sys.path` for internal module resolution.
