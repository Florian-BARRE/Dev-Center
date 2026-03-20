# IA-Dev-Hub — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working `docker compose up` that starts all 3 services (openclaw-gateway, idh-app, code-server) with proper volume mounts, networking, and a passing idh-app `GET /api/v1/health/ping` endpoint.

**Architecture:** Multi-stage Dockerfile for idh-app (uv Python deps → Vite React build → runtime with Node.js for claude CLI). Docker Compose orchestrates 3 services on `idh-net`. `setup.sh` bootstraps the `~/iah/` data directory, generates `.env`, and creates a minimal `openclaw.json` on first run.

**Tech Stack:** Docker Compose v2, Python 3.12, FastAPI, uv, Vite 6 + React 18, TypeScript, openclaw:latest, code-server:latest

**Spec:** `docs/superpowers/specs/2026-03-20-ia-dev-hub-design.md`

**This is Plan 1 of 4.** Plans 2 (idh-app backend), 3 (OpenClaw plugin), and 4 (React dashboard) build on top of this foundation.

---

## File Map

```
Dev-Center/
├── docker-compose.yml                   # production compose (3 services)
├── docker-compose.dev.yml               # dev overrides (hot reload)
├── setup.sh                             # first-run bootstrap script
├── src/
│   └── idh-app/
│       ├── Dockerfile                   # 3-stage: py-build → ui-build → runtime
│       ├── entrypoint.sh                # SSH fix + uvicorn launch
│       ├── pyproject.toml               # Python deps + pytest config + ruff
│       ├── entrypoint.py                # FastAPI app factory + CONTEXT bootstrap
│       ├── config/
│       │   ├── __init__.py
│       │   └── runtime/
│       │       ├── __init__.py
│       │       └── runtime_config.py    # EnvConfigLoader + loggerplusplus setup
│       ├── backend/
│       │   ├── __init__.py
│       │   ├── app.py                   # FastAPI factory, router registration
│       │   ├── context.py               # CONTEXT static class
│       │   ├── lifespan.py              # startup/shutdown
│       │   ├── routers/
│       │   │   ├── __init__.py
│       │   │   └── health/
│       │   │       ├── __init__.py
│       │   │       ├── router.py        # GET /api/v1/health/ping
│       │   │       └── models.py        # HealthResponse
│       │   └── libs/
│       │       ├── __init__.py
│       │       └── utils/
│       │           ├── __init__.py
│       │           └── error_handling.py
│       ├── frontend/
│       │   ├── package.json
│       │   ├── package-lock.json        # MUST be committed — Dockerfile uses npm ci
│       │   ├── tsconfig.json
│       │   ├── vite.config.ts
│       │   ├── index.html
│       │   └── src/
│       │       ├── main.tsx
│       │       ├── App.tsx              # placeholder UI
│       │       └── App.test.tsx         # vitest smoke test
│       └── tests/
│           ├── conftest.py              # TestClient fixture
│           └── test_health.py
└── plugin/
    └── idh/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts                 # minimal register(api) stub
            └── index.test.ts            # vitest: plugin exports default object
```

---

## Task 1: Plugin scaffold + vitest test

**Files:**
- Create: `plugin/idh/package.json`
- Create: `plugin/idh/tsconfig.json`
- Create: `plugin/idh/src/index.ts`
- Create: `plugin/idh/src/index.test.ts`

- [ ] **Step 1: Write the failing plugin test first**

```bash
mkdir -p plugin/idh/src
```

`plugin/idh/src/index.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import plugin from "./index";

describe("IDH plugin", () => {
  it("exports a plugin definition with an id", () => {
    expect(plugin.id).toBe("idh-projects");
  });

  it("exports a register function", () => {
    expect(typeof plugin.register).toBe("function");
  });
});
```

- [ ] **Step 2: Create package.json**

`plugin/idh/package.json`:
```json
{
  "name": "idh-projects",
  "version": "0.1.0",
  "description": "IDH Projects — OpenClaw plugin",
  "main": "src/index.ts",
  "openclaw": {
    "extensions": ["./src/index.ts"]
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  },
  "peerDependencies": {
    "openclaw": "*"
  }
}
```

- [ ] **Step 3: Install deps and run test — expect FAIL**

```bash
cd plugin/idh && npm install
npm test
```

Expected: `Cannot find module './index'` — plugin not written yet.

- [ ] **Step 4: Create tsconfig.json**

`plugin/idh/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Write minimal plugin entry point**

`plugin/idh/src/index.ts`:
```typescript
// ====== Code Summary ======
// IDH Projects OpenClaw plugin — entry point.
// Registers a stub /idh_ping command. Full commands added in Plan 3.

import type { OpenClawPluginDefinition } from "openclaw/plugin-sdk";

const plugin: OpenClawPluginDefinition = {
  id: "idh-projects",
  name: "IDH Projects",
  register(api) {
    // Stub command confirms the plugin loads without errors.
    // All production commands registered in Plan 3.
    api.registerCommand({
      name: "idh_ping",
      description: "IDH plugin health check",
      handler: async () => ({ text: "IDH plugin loaded ✓" }),
    });
  },
};

export default plugin;
```

- [ ] **Step 6: Run test — expect PASS**

```bash
cd plugin/idh && npm test
```

Expected:
```
✓ IDH plugin exports a plugin definition with an id
✓ IDH plugin exports a register function
```

- [ ] **Step 7: Commit**

```bash
git add plugin/
git commit -m "feat: scaffold IDH OpenClaw plugin stub with passing vitest"
```

---

## Task 2: idh-app Python project setup

**Files:**
- Create: `src/idh-app/pyproject.toml`
- Create: `src/idh-app/config/__init__.py`
- Create: `src/idh-app/config/runtime/__init__.py`
- Create: `src/idh-app/config/runtime/runtime_config.py`

- [ ] **Step 1: Initialize Python project with uv**

```bash
mkdir -p src/idh-app
cd src/idh-app
uv init --no-readme
uv add fastapi "uvicorn[standard]" loggerplusplus configplusplus filelock pyfiglet
uv add --dev pytest pytest-asyncio pytest-env httpx
```

- [ ] **Step 2: Write pyproject.toml (replace auto-generated)**

`src/idh-app/pyproject.toml`:
```toml
[project]
name = "idh-app"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "loggerplusplus>=1.0.0",
    "configplusplus>=1.0.0",
    "filelock>=3.16.0",
    "pyfiglet>=0.8.post1",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "pytest-env>=1.1.0",
    "httpx>=0.27.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
# Set required env vars BEFORE any module import (prevents RUNTIME_CONFIG class
# body from raising on missing required env vars during test collection).
env = [
    "IDH_WEBHOOK_SECRET=test-secret-for-pytest-only",
    "DATA_DIR=/tmp/idh-test-data",
    "WORKSPACES_DIR=/tmp/idh-test-workspaces",
    "RULES_DIR=/tmp/idh-test-rules",
    "OPENCLAW_CONFIG_DIR=/tmp/idh-test-openclaw",
    "FASTAPI_APP_NAME=IDH Test",
    "FASTAPI_DEBUG_MODE=false",
    "CORS_ALLOWED_ORIGINS=*",
    "BRIDGE_TTL_HOURS=8",
    "OPENCLAW_GATEWAY_PORT=18789",
    "LOGGING_CONSOLE_LEVEL=WARNING",
    "LOGGING_FILE_LEVEL=DEBUG",
    "LOGGING_ENABLE_CONSOLE=false",
    "LOGGING_ENABLE_FILE=false",
    "LOGGING_LPP_FORMAT=ShortFormat",
]

[tool.ruff.lint]
ignore = ["F541"]
```

- [ ] **Step 3: Create runtime_config.py**

`src/idh-app/config/runtime/runtime_config.py`:
```python
# ====== Code Summary ======
# Defines RUNTIME_CONFIG (env-based settings) and configures loggerplusplus sinks.
# Must be the first import in any entry point — registers sys.path.

# ====== Standard Library Imports ======
import os
import pathlib
import sys

# ====== Third-Party Library Imports ======
from configplusplus import EnvConfigLoader, env
from loggerplusplus import loggerplusplus
from loggerplusplus import formats as lpp_formats

# ─── Reset logger before anything else ───
loggerplusplus.remove()

# ─── Optional DEV_MODE early logger ───
# Read directly from os.environ (not via env()) because it must activate
# a temporary debug sink BEFORE the RUNTIME_CONFIG class is evaluated.
if os.environ.get("DEV_MODE"):
    loggerplusplus.add(sink=sys.stdout, level="DEBUG", format=lpp_formats.ShortFormat())
    dev_mode_logger = loggerplusplus.bind(identifier="DEV")
    dev_mode_logger.warning(f"DEV MODE is activated !")
    loggerplusplus.remove()


class RUNTIME_CONFIG(EnvConfigLoader):
    """Runtime configuration loaded from environment variables."""

    # ───── Paths ─────
    PATH_ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent.parent
    PATH_LIBS = PATH_ROOT_DIR / "libs"
    sys.path.append(str(PATH_LIBS))

    # ───── Logging (mandatory in every project) ─────
    LOGGING_CONSOLE_LEVEL = env("LOGGING_CONSOLE_LEVEL", default="INFO")
    LOGGING_FILE_LEVEL = env("LOGGING_FILE_LEVEL", default="DEBUG")
    LOGGING_ENABLE_CONSOLE = env("LOGGING_ENABLE_CONSOLE", cast=bool, default=True)
    LOGGING_ENABLE_FILE = env("LOGGING_ENABLE_FILE", cast=bool, default=False)
    LOGGING_LPP_FORMAT = env("LOGGING_LPP_FORMAT", default="ShortFormat")

    # ───── FastAPI ─────
    FASTAPI_APP_NAME = env("FASTAPI_APP_NAME", default="IDH App")
    FASTAPI_DEBUG_MODE = env("FASTAPI_DEBUG_MODE", cast=bool, default=False)
    CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS", default="*")

    # ───── IDH ─────
    IDH_WEBHOOK_SECRET = env("IDH_WEBHOOK_SECRET")
    BRIDGE_TTL_HOURS = env("BRIDGE_TTL_HOURS", cast=int, default=8)
    OPENCLAW_GATEWAY_PORT = env("OPENCLAW_GATEWAY_PORT", cast=int, default=18789)

    # ───── Runtime data paths ─────
    PATH_DATA_DIR = pathlib.Path(env("DATA_DIR", default="/data"))
    PATH_STATE_FILE = PATH_DATA_DIR / "idh-projects.state.json"
    PATH_WORKSPACES = pathlib.Path(env("WORKSPACES_DIR", default="/workspaces"))
    PATH_RULES_DIR = pathlib.Path(env("RULES_DIR", default="/rules"))
    PATH_OPENCLAW_CONFIG = (
        pathlib.Path(env("OPENCLAW_CONFIG_DIR", default="/openclaw-config"))
        / "openclaw.json"
    )
    PATH_ROOT_DIR_FRONTEND = PATH_ROOT_DIR / "frontend" / "dist"


# ─── Apply logging configuration AFTER class definition ───
lpp_format = getattr(
    lpp_formats, RUNTIME_CONFIG.LOGGING_LPP_FORMAT, lpp_formats.ShortFormat
)()

if RUNTIME_CONFIG.LOGGING_ENABLE_CONSOLE:
    loggerplusplus.add(
        sink=sys.stdout,
        level=RUNTIME_CONFIG.LOGGING_CONSOLE_LEVEL,
        format=lpp_format,
    )

if RUNTIME_CONFIG.LOGGING_ENABLE_FILE:
    loggerplusplus.add(
        pathlib.Path("logs"),
        level=RUNTIME_CONFIG.LOGGING_FILE_LEVEL,
        format=lpp_format,
        rotation="1 week",
        retention="30 days",
        compression="zip",
        encoding="utf-8",
        enqueue=True,
        backtrace=True,
        diagnose=False,
    )
```

- [ ] **Step 4: Create config __init__.py files**

`src/idh-app/config/runtime/__init__.py`:
```python
from .runtime_config import RUNTIME_CONFIG

__all__ = ["RUNTIME_CONFIG"]
```

`src/idh-app/config/__init__.py`:
```python
from .runtime import RUNTIME_CONFIG

__all__ = ["RUNTIME_CONFIG"]
```

- [ ] **Step 5: Commit**

```bash
git add src/idh-app/
git commit -m "chore: initialize idh-app Python project with uv, runtime config, and pytest-env"
```

---

## Task 3: FastAPI skeleton + health route (TDD)

**Files:**
- Create: `src/idh-app/tests/conftest.py`
- Create: `src/idh-app/tests/test_health.py`
- Create: `src/idh-app/backend/context.py`
- Create: `src/idh-app/backend/lifespan.py`
- Create: `src/idh-app/backend/app.py`
- Create: `src/idh-app/backend/__init__.py`
- Create: `src/idh-app/backend/libs/__init__.py`
- Create: `src/idh-app/backend/libs/utils/__init__.py`
- Create: `src/idh-app/backend/libs/utils/error_handling.py`
- Create: `src/idh-app/backend/routers/__init__.py`
- Create: `src/idh-app/backend/routers/health/__init__.py`
- Create: `src/idh-app/backend/routers/health/models.py`
- Create: `src/idh-app/backend/routers/health/router.py`
- Create: `src/idh-app/entrypoint.py`

- [ ] **Step 1: Write failing tests**

`src/idh-app/tests/conftest.py`:
```python
# ====== Code Summary ======
# Pytest fixtures for idh-app test suite.
# NOTE: env vars are pre-set via pyproject.toml [tool.pytest.ini_options] env section.
# Do NOT set os.environ here — use pyproject.toml to guarantee pre-import ordering.

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client() -> TestClient:
    """
    Return a TestClient for the idh-app FastAPI application.

    Env vars are already set by pytest-env before this import occurs.

    Returns:
        TestClient: Synchronous test client.
    """
    from entrypoint import app
    return TestClient(app)
```

`src/idh-app/tests/test_health.py`:
```python
# ====== Code Summary ======
# Tests for the GET /api/v1/health/ping endpoint.


def test_ping_returns_200(client):
    """Health check endpoint must return HTTP 200."""
    response = client.get("/api/v1/health/ping")
    assert response.status_code == 200


def test_ping_response_schema(client):
    """Response body must match HealthResponse schema with status 'ok'."""
    response = client.get("/api/v1/health/ping")
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd src/idh-app
uv run pytest tests/test_health.py -v
```

Expected: `ModuleNotFoundError: No module named 'entrypoint'` — app not built yet.

- [ ] **Step 3: Create package init files (required for Python package resolution)**

```bash
mkdir -p src/idh-app/backend/libs/utils
mkdir -p src/idh-app/backend/routers/health
touch src/idh-app/backend/__init__.py
touch src/idh-app/backend/libs/__init__.py
touch src/idh-app/backend/libs/utils/__init__.py
touch src/idh-app/backend/routers/__init__.py
touch src/idh-app/backend/routers/health/__init__.py
```

- [ ] **Step 4: Create error_handling.py**

`src/idh-app/backend/libs/utils/error_handling.py`:
```python
# ====== Code Summary ======
# Provides the @auto_handle_errors decorator for automatic exception handling on all routes.

# ====== Standard Library Imports ======
import functools
import inspect
import traceback

# ====== Third-Party Library Imports ======
from fastapi import HTTPException

# ====== Local Project Imports ======
from ...context import CONTEXT


def _build_error_detail(func_name: str, exc: Exception, tb: str) -> dict:
    """
    Build the HTTP 500 response detail.

    In debug mode, includes traceback. In production, returns a generic message.

    Args:
        func_name (str): Name of the failing function.
        exc (Exception): The caught exception.
        tb (str): Formatted traceback string.

    Returns:
        dict: Error detail dictionary.
    """
    if getattr(CONTEXT.RUNTIME_CONFIG, "FASTAPI_DEBUG_MODE", False):
        return {"error": str(exc), "traceback": tb, "function": func_name}
    return {"error": "Internal server error."}


def auto_handle_errors(func):
    """
    Decorator to automatically handle unexpected exceptions for sync and async routes.

    HTTPExceptions are always re-raised as-is.

    Args:
        func (Callable): The route function to wrap.

    Returns:
        Callable: Wrapped function with automatic error handling.
    """

    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as exc:
            tb = traceback.format_exc()
            CONTEXT.logger.error(f"[{func.__name__}] {exc}\n{tb}")
            raise HTTPException(
                status_code=500,
                detail=_build_error_detail(func.__name__, exc, tb),
            )

    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as exc:
            tb = traceback.format_exc()
            CONTEXT.logger.error(f"[{func.__name__}] {exc}\n{tb}")
            raise HTTPException(
                status_code=500,
                detail=_build_error_detail(func.__name__, exc, tb),
            )

    if inspect.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper
```

- [ ] **Step 5: Create health route models and router**

`src/idh-app/backend/routers/health/models.py`:
```python
# ====== Code Summary ======
# Pydantic models for the health check endpoint.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Response model for the GET /api/v1/health/ping route."""

    status: str = Field(..., description="Service status. Always 'ok' when healthy.")
    version: str = Field(..., description="Application version.")
```

`src/idh-app/backend/routers/health/router.py`:
```python
# ====== Code Summary ======
# Health check route — confirms idh-app is running and accepting requests.

# ====== Third-Party Library Imports ======
from fastapi import APIRouter

# ====== Local Project Imports ======
from ...libs.utils.error_handling import auto_handle_errors
from .models import HealthResponse

router = APIRouter()
_VERSION = "0.1.0"


@router.get("/health/ping", response_model=HealthResponse)
@auto_handle_errors
async def ping() -> HealthResponse:
    """
    Health check endpoint.

    Returns:
        HealthResponse: Status and version.
    """
    # 1. Return healthy status
    return HealthResponse(status="ok", version=_VERSION)
```

`src/idh-app/backend/routers/__init__.py`:
```python
# ─── Health ─── #
from .health.router import router as health_router

# ─── Public API ─── #
__all__ = ["health_router"]
```

- [ ] **Step 6: Create CONTEXT, lifespan, app factory, and entrypoint**

`src/idh-app/backend/context.py`:
```python
# ====== Code Summary ======
# Shared application context — typed service locator.
# Type annotations only. All values assigned at startup in entrypoint.py.

# ====== Standard Library Imports ======
from typing import Type

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerPlusPlus

# ====== Internal Project Imports ======
from config import RUNTIME_CONFIG


class CONTEXT:
    """
    Shared application context — typed service locator.

    All attributes assigned in entrypoint.py before create_app() is called.
    Never instantiate this class — access attributes at class level.
    """

    logger: LoggerPlusPlus
    RUNTIME_CONFIG: Type[RUNTIME_CONFIG]
```

`src/idh-app/backend/lifespan.py`:
```python
# ====== Code Summary ======
# FastAPI lifespan — bootstraps services at startup, shuts them down on exit.

# ====== Standard Library Imports ======
import unicodedata
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

# ====== Third-Party Library Imports ======
from pyfiglet import Figlet

# ====== Local Project Imports ======
from .context import CONTEXT

# Total startup steps — update when adding/removing steps.
TOTAL_STEPS = 1


def lifespan() -> Any:
    """
    Return the FastAPI lifespan context manager factory.

    Returns:
        Any: Async context manager for FastAPI's lifespan parameter.
    """

    def log_step(step: int, message: str) -> None:
        """Log a numbered startup step."""
        CONTEXT.logger.info(f"\n[{step}/{TOTAL_STEPS}] {message}...")

    @asynccontextmanager
    async def _lifespan(app: Any) -> AsyncIterator[None]:
        _ = app
        try:
            # 1. Print startup banner
            banner = "\n" + Figlet(font="slant").renderText(
                "".join(
                    c
                    for c in unicodedata.normalize(
                        "NFD", CONTEXT.RUNTIME_CONFIG.FASTAPI_APP_NAME
                    )
                    if unicodedata.category(c) != "Mn"
                )
            )
            CONTEXT.logger.info(banner)

            # 2. Log runtime config
            log_step(1, "Runtime configuration")
            CONTEXT.logger.info(CONTEXT.RUNTIME_CONFIG)

            # Yield — app is now running
            yield

        finally:
            CONTEXT.logger.info(f"Shutting down IDH App...")

    return _lifespan
```

`src/idh-app/backend/app.py`:
```python
# ====== Code Summary ======
# Creates the FastAPI application instance and registers all API routers.

# ====== Third-Party Library Imports ======
from fastapi import FastAPI

# ====== Local Project Imports ======
from .lifespan import lifespan
from .routers import health_router


def create_app(app_name: str, debug: bool) -> FastAPI:
    """
    Create and configure the FastAPI application instance.

    Args:
        app_name (str): Application title shown in OpenAPI docs.
        debug (bool): Enable debug mode.

    Returns:
        FastAPI: Configured application.
    """
    # 1. Create FastAPI instance with lifespan
    app = FastAPI(title=app_name, version="0.1.0", lifespan=lifespan(), debug=debug)

    # 2. Register routers under /api/v1
    api_prefix = "/api/v1"
    app.include_router(router=health_router, prefix=api_prefix)

    return app


__all__ = ["create_app"]
```

`src/idh-app/backend/__init__.py`:
```python
# ─── App factory ─── #
from .app import create_app

# ─── Context ─── #
from .context import CONTEXT

# ─── Public API ─── #
__all__ = ["create_app", "CONTEXT"]
```

`src/idh-app/entrypoint.py`:
```python
# ====== Code Summary ======
# Application entry point — wires CONTEXT and creates the FastAPI app.

# ====== Third-Party Library Imports ======
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loggerplusplus import loggerplusplus

# ====== Internal Project Imports ======
from config import RUNTIME_CONFIG          # MUST be first — registers sys.path
from backend import CONTEXT, create_app


def _build_app() -> FastAPI:
    """
    Assemble and return a fully configured FastAPI application.

    Returns:
        FastAPI: The configured application instance.
    """
    # 1. Inject logger and config into CONTEXT
    CONTEXT.logger = loggerplusplus.bind(identifier="IDH-APP")
    CONTEXT.RUNTIME_CONFIG = RUNTIME_CONFIG

    # 2. Create FastAPI app
    fastapi_app = create_app(
        app_name=RUNTIME_CONFIG.FASTAPI_APP_NAME,
        debug=RUNTIME_CONFIG.FASTAPI_DEBUG_MODE,
    )

    # 3. Mount frontend static files if the dist folder has been built
    if RUNTIME_CONFIG.PATH_ROOT_DIR_FRONTEND.exists():
        fastapi_app.mount(
            "/",
            StaticFiles(directory=RUNTIME_CONFIG.PATH_ROOT_DIR_FRONTEND, html=True),
            name="static",
        )

    # 4. Add CORS middleware — origins read from RUNTIME_CONFIG
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=RUNTIME_CONFIG.CORS_ALLOWED_ORIGINS.split(","),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return fastapi_app


app: FastAPI = _build_app()

__all__ = ["app"]
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cd src/idh-app
uv run pytest tests/test_health.py -v
```

Expected:
```
PASSED tests/test_health.py::test_ping_returns_200
PASSED tests/test_health.py::test_ping_response_schema
2 passed
```

- [ ] **Step 8: Commit**

```bash
git add src/idh-app/
git commit -m "feat: add idh-app FastAPI skeleton with health check route (TDD)"
```

---

## Task 4: React frontend placeholder + vitest smoke test

**Files:**
- Create: `src/idh-app/frontend/package.json`
- Create: `src/idh-app/frontend/tsconfig.json`
- Create: `src/idh-app/frontend/vite.config.ts`
- Create: `src/idh-app/frontend/index.html`
- Create: `src/idh-app/frontend/src/main.tsx`
- Create: `src/idh-app/frontend/src/App.tsx`
- Create: `src/idh-app/frontend/src/App.test.tsx`

- [ ] **Step 1: Write failing vitest smoke test first**

`src/idh-app/frontend/src/App.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByText(/IA-Dev-Hub/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Create package.json**

`src/idh-app/frontend/package.json`:
```json
{
  "name": "idh-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.4.0",
    "vite": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Install deps and run test — expect FAIL**

```bash
cd src/idh-app/frontend && npm install
npm test
```

Expected: `Cannot find module './App'` — App.tsx not written yet.

- [ ] **Step 4: Create vite.config.ts (enables vitest + jsdom)**

`src/idh-app/frontend/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 5: Create tsconfig.json**

`src/idh-app/frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create index.html**

`src/idh-app/frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>IA-Dev-Hub</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create App.tsx and main.tsx**

`src/idh-app/frontend/src/App.tsx`:
```tsx
// Placeholder — full dashboard implemented in Plan 4.
export default function App() {
  return (
    <div style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>IA-Dev-Hub</h1>
      <p>Foundation OK — Dashboard coming in Plan 4.</p>
    </div>
  );
}
```

`src/idh-app/frontend/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: Run test — expect PASS**

```bash
cd src/idh-app/frontend && npm test
```

Expected:
```
✓ App renders without crashing
1 passed
```

- [ ] **Step 9: Build frontend (generates package-lock.json + dist/)**

```bash
npm run build
```

Expected: `dist/` folder created. No TypeScript errors.

> **Important:** `package-lock.json` generated by `npm install` (Step 3) MUST be committed — the Dockerfile Stage 2 uses `npm ci` which requires it. The `git add` below includes it explicitly.

- [ ] **Step 10: Commit (include package-lock.json)**

```bash
git add src/idh-app/frontend/
# Verify package-lock.json is staged:
git status src/idh-app/frontend/package-lock.json
git commit -m "feat: add React frontend placeholder with passing vitest smoke test"
```

---

## Task 5: idh-app Dockerfile (multi-stage)

**Files:**
- Create: `src/idh-app/Dockerfile`
- Create: `src/idh-app/entrypoint.sh`

- [ ] **Step 1: Create entrypoint.sh**

`src/idh-app/entrypoint.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

# Fix SSH key permissions.
# The ~/.ssh volume is mounted :ro — SSH refuses keys not owned with 600 perms.
# We copy to a temp writable location and fix permissions before use.
if [ -d "/home/app/.ssh" ]; then
    cp -r /home/app/.ssh /tmp/.ssh-rw
    chmod 700 /tmp/.ssh-rw
    chmod 600 /tmp/.ssh-rw/id_* 2>/dev/null || true
    export GIT_SSH_COMMAND="ssh -i /tmp/.ssh-rw/id_ed25519 \
        -o StrictHostKeyChecking=accept-new \
        -o UserKnownHostsFile=/tmp/.ssh-rw/known_hosts"
fi

# The working directory must be the idh-app root for Python module resolution.
cd /app/idh-app

if [ "${DEV_MODE:-}" = "true" ]; then
    # Hot reload enabled — entrypoint.sh checks DEV_MODE, not compose command.
    exec uvicorn entrypoint:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload \
        --reload-dir /app/idh-app
else
    exec uvicorn entrypoint:app \
        --host 0.0.0.0 \
        --port 8000
fi
```

- [ ] **Step 2: Write Dockerfile**

`src/idh-app/Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1.7

###############################################################################
# Build note:
# Built from the repository root with the src/ directory as context.
#   docker build -f src/idh-app/Dockerfile -t idh-app:latest src
###############################################################################

###############################################################################
# Stage 1: Python dependency builder (uv + Python 3.12)
#
# Goal:
# - Install locked production Python dependencies into /opt/venv
# - Keep dependency layer separate from app code for Docker layer cache reuse
###############################################################################
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS py-build

WORKDIR /workspace

# Tell uv where to create the project virtual environment.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv

# Copy lock metadata first — dependency cache is invalidated only when these change.
COPY idh-app/pyproject.toml idh-app/uv.lock /workspace/idh-app/

# Install locked production dependencies.
# --frozen: fail if lock file is out of sync with pyproject.toml.
# --no-dev: skip development-only packages.
# cache mount: speeds up repeated local builds without network round-trips.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --project /workspace/idh-app

###############################################################################
# Stage 2: Frontend builder (Node 22 + Vite)
#
# Goal:
# - Build the React production bundle into frontend/dist/
# - Only the compiled dist/ is copied to the runtime stage
###############################################################################
FROM node:22-bookworm-slim AS ui-build

WORKDIR /workspace/idh-app/frontend

# Copy package descriptors first to enable npm dependency-layer caching.
# package-lock.json is committed in the repo and required here for npm ci.
COPY idh-app/frontend/package.json idh-app/frontend/package-lock.json ./

# Reproducible install strictly from package-lock.json (no version drift).
RUN npm ci

# Copy frontend source and compile the production bundle.
COPY idh-app/frontend/ ./
RUN npm run build

###############################################################################
# Stage 3: Runtime image (Python + Node for claude CLI)
#
# Goal:
# - Run FastAPI via uvicorn (Python)
# - Include Node.js runtime so the `claude remote-control` bridge can be spawned
# - Serve compiled React bundle as static files from /app/idh-app/frontend/dist
###############################################################################
FROM python:3.12-slim-bookworm AS runtime

# Python runtime best practices.
# PYTHONDONTWRITEBYTECODE: no .pyc files written to disk.
# PYTHONUNBUFFERED: logs appear immediately in stdout/stderr.
# PATH: make the uv-built venv the active Python environment.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}"

# Install Node.js 22 (required to run the `claude` CLI) and git + ssh tools.
# NodeSource is used for a recent LTS version on Debian bookworm.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    openssh-client \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install the Claude Code CLI globally.
# Required by the bridge manager to spawn `claude remote-control` processes.
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy prebuilt Python virtual environment from the py-build stage.
COPY --from=py-build /opt/venv /opt/venv

# Copy backend application source code.
COPY idh-app /app/idh-app

# Copy compiled React bundle into the backend tree.
# FastAPI mounts this directory as static files at the root URL.
COPY --from=ui-build /workspace/idh-app/frontend/dist /app/idh-app/frontend/dist

# Copy and set permissions on the entrypoint script.
COPY idh-app/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

# Start via entrypoint.sh which handles SSH permissions and DEV_MODE detection.
CMD ["/entrypoint.sh"]
```

- [ ] **Step 3: Build the image immediately to catch errors**

```bash
# Build context is the src/ directory (as documented in the Dockerfile header)
docker build -f src/idh-app/Dockerfile -t idh-app:latest src/
```

Expected: Build completes with 3 stages. No errors. Final image tagged `idh-app:latest`.

- [ ] **Step 4: Verify the health endpoint runs inside the image**

```bash
docker run --rm -d \
  -p 8000:8000 \
  -e IDH_WEBHOOK_SECRET=test \
  -e DATA_DIR=/tmp \
  -e WORKSPACES_DIR=/tmp \
  -e RULES_DIR=/tmp \
  -e OPENCLAW_CONFIG_DIR=/tmp \
  --name idh-test \
  idh-app:latest

sleep 5
curl -sf http://localhost:8000/api/v1/health/ping
docker stop idh-test
```

Expected: `{"status":"ok","version":"0.1.0"}`

- [ ] **Step 5: Commit**

```bash
git add src/idh-app/Dockerfile src/idh-app/entrypoint.sh
git commit -m "feat: add idh-app multi-stage Dockerfile with Node.js + claude CLI"
```

---

## Task 6: Docker Compose files

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`

- [ ] **Step 1: Write production docker-compose.yml**

`docker-compose.yml`:
```yaml
# IA-Dev-Hub — Production Docker Compose
# Prerequisites: run ./setup.sh once to create ~/iah/ and ~/iah/.env
# Start: docker compose up -d
# Stop:  docker compose down

services:
  openclaw-gateway:
    # OpenClaw AI agent runtime — Telegram bot, session management, IDH plugin host
    image: ghcr.io/openclaw/openclaw:latest
    restart: unless-stopped
    ports:
      # Gateway API port — Telegram polling + inter-service calls from idh-app
      - "${OPENCLAW_GATEWAY_PORT:-18789}:18789"
      # Dashboard port — OpenClaw web UI (reverse-proxied by Zoraxy)
      - "${OPENCLAW_DASHBOARD_PORT:-18790}:18790"
    env_file:
      # Secrets loaded from host data directory (not committed to repo)
      - ~/iah/.env
    volumes:
      # OpenClaw configuration, agents, and session data
      - ~/iah/config:/home/node/.openclaw
      # Shared project workspaces (repos cloned by idh-app, read by OpenClaw tools)
      - ~/iah/workspaces:/workspaces
      # Claude Code OAuth credentials — read-only, auth done on host
      - ~/.claude:/home/node/.claude:ro
      # Codex OAuth credentials — read-only
      - ~/.codex:/home/node/.codex:ro
      # IDH plugin source at ./plugin/idh/ → mounted as the plugin directory.
      # NOTE: spec shows ./plugin but ./plugin/idh/ is correct — idh/ is the plugin root.
      - ./plugin/idh:/home/node/.openclaw/plugins/idh:ro
    networks:
      - idh-net
    environment:
      # Bind to LAN so idh-app on idh-net can reach the webhook endpoint
      - OPENCLAW_GATEWAY_BIND=lan

  idh-app:
    # IDH sidecar: FastAPI API + React dashboard + bridge manager + watchdog
    build:
      # Build context is the src/ directory (Dockerfile COPY uses relative paths from src/)
      context: src
      dockerfile: idh-app/Dockerfile
    image: idh-app:latest
    restart: unless-stopped
    ports:
      # FastAPI + React dashboard (reverse-proxied by Zoraxy)
      - "${IDH_APP_PORT:-8000}:8000"
    env_file:
      - ~/iah/.env
    volumes:
      # Shared project workspaces — same bind as openclaw-gateway and code-server
      - ~/iah/workspaces:/workspaces
      # IDH state file — idh-app is sole writer (spec Section 1.7)
      - ~/iah/state:/data
      # Coding rules and context templates — read-only
      - ~/iah/rules:/rules:ro
      # OpenClaw config dir — idh-app is sole writer of openclaw.json
      - ~/iah/config:/openclaw-config
      # Claude Code OAuth for remote-control bridge
      - ~/.claude:/home/app/.claude:ro
      # Codex OAuth for Codex API auto-summary calls
      - ~/.codex:/home/app/.codex:ro
      # SSH key for git clone/fetch via SSH
      - ~/.ssh:/home/app/.ssh:ro
    networks:
      - idh-net
    depends_on:
      - openclaw-gateway
    environment:
      # Mount paths passed to RUNTIME_CONFIG via env vars
      - DATA_DIR=/data
      - WORKSPACES_DIR=/workspaces
      - RULES_DIR=/rules
      - OPENCLAW_CONFIG_DIR=/openclaw-config

  code-server:
    # VS Code in the browser — file browsing and exploration of project workspaces
    image: codercom/code-server:latest
    restart: unless-stopped
    ports:
      # VS Code web UI (reverse-proxied by Zoraxy)
      - "${CODE_SERVER_PORT:-8443}:8080"
    volumes:
      # Same workspace volume as openclaw-gateway and idh-app
      - ~/iah/workspaces:/workspaces
    networks:
      - idh-net
    # Disable code-server auth — Zoraxy handles access control
    command: --auth none /workspaces

networks:
  idh-net:
    # Shared bridge network — all services can reach each other by service name
    driver: bridge
```

- [ ] **Step 2: Write docker-compose.dev.yml**

`docker-compose.dev.yml`:
```yaml
# Development overrides for IA-Dev-Hub.
# Usage: docker compose -f docker-compose.yml -f docker-compose.dev.yml up
#
# Docker Compose MERGES service definitions from both files.
# The base docker-compose.yml env_file, ports, networks, and depends_on are
# preserved automatically — only the fields declared below are overridden.

services:
  idh-app:
    # Override: mount source code so edits are reflected without rebuilding.
    # The Dockerfile image is still used for the Python venv and Node CLI tools.
    volumes:
      - ./src/idh-app:/app/idh-app
    environment:
      # Enable uvicorn --reload (checked in entrypoint.sh via DEV_MODE)
      - DEV_MODE=true
      - FASTAPI_DEBUG_MODE=true
      - LOGGING_CONSOLE_LEVEL=DEBUG
```

- [ ] **Step 3: Validate compose config**

```bash
docker compose config --quiet
docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet
```

Expected: No output (no errors).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml
git commit -m "feat: add Docker Compose files for all 3 IDH services"
```

---

## Task 7: setup.sh bootstrap script

**Files:**
- Create: `setup.sh`

- [ ] **Step 1: Write setup.sh**

`setup.sh`:
```bash
#!/usr/bin/env bash
# IA-Dev-Hub — First-run bootstrap script.
# Creates ~/iah/ data directory, generates .env, seeds openclaw.json and
# rule templates, starts Docker Compose, and installs the IDH plugin.
#
# Run once:          ./setup.sh
# Subsequent starts: docker compose up -d
#
# NOTE: Step order follows the spec (Section 1.5) with two additions:
# - Pre-populating known_hosts (moved earlier for convenience)
# - Seeding CODING_RULES.md and COMMON_CONTEXT.md templates (not in spec — extension)

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[IDH]${NC} $1"; }
warn() { echo -e "${YELLOW}[IDH]${NC} $1"; }
err()  { echo -e "${RED}[IDH]${NC} $1"; exit 1; }

IAH_DIR="$HOME/iah"

# ─── Step 1: Create data directory tree ───────────────────────────────────────
log "Creating data directory at $IAH_DIR ..."
mkdir -p "$IAH_DIR"/{config,workspaces,state,rules}

# ─── Step 2: Generate .env if it doesn't exist ────────────────────────────────
ENV_FILE="$IAH_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    log "Generating $ENV_FILE ..."

    read -rp "Telegram bot token (from BotFather): " TELEGRAM_BOT_TOKEN
    [ -z "$TELEGRAM_BOT_TOKEN" ] && err "Telegram bot token is required."

    read -rp "Your Telegram user ID (numeric): " TELEGRAM_USER_ID
    [ -z "$TELEGRAM_USER_ID" ] && err "Telegram user ID is required."

    read -rp "Bridge TTL in hours [8]: " BRIDGE_TTL_HOURS
    BRIDGE_TTL_HOURS="${BRIDGE_TTL_HOURS:-8}"

    # Auto-generate a random webhook secret (not prompted — not a human-readable value)
    IDH_WEBHOOK_SECRET=$(openssl rand -hex 32)

    cat > "$ENV_FILE" <<EOF
# IA-Dev-Hub environment variables — generated by setup.sh

# ─── Telegram ───
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_USER_ID=${TELEGRAM_USER_ID}

# ─── IDH ───
BRIDGE_TTL_HOURS=${BRIDGE_TTL_HOURS}
IDH_WEBHOOK_SECRET=${IDH_WEBHOOK_SECRET}

# ─── Ports (change if there are conflicts on your host) ───
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_DASHBOARD_PORT=18790
IDH_APP_PORT=8000
CODE_SERVER_PORT=8443

# ─── FastAPI ───
FASTAPI_APP_NAME=IDH App
FASTAPI_DEBUG_MODE=false
CORS_ALLOWED_ORIGINS=*

# ─── Logging ───
LOGGING_CONSOLE_LEVEL=INFO
LOGGING_FILE_LEVEL=DEBUG
LOGGING_ENABLE_CONSOLE=true
LOGGING_ENABLE_FILE=false
LOGGING_LPP_FORMAT=ShortFormat
EOF
    log ".env created."
else
    warn ".env already exists at $ENV_FILE — skipping."
fi

# ─── Step 3: Generate minimal openclaw.json if not present ────────────────────
OPENCLAW_JSON="$IAH_DIR/config/openclaw.json"
if [ ! -f "$OPENCLAW_JSON" ]; then
    log "Generating openclaw.json ..."
    # shellcheck disable=SC1090
    source "$ENV_FILE"
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
    log "openclaw.json created."
else
    warn "openclaw.json already exists — skipping."
fi

# ─── Step 4: Pre-populate GitHub known_hosts ──────────────────────────────────
KNOWN_HOSTS="$HOME/.ssh/known_hosts"
if [ -f "$HOME/.ssh/id_ed25519" ]; then
    if ! grep -q "github.com" "$KNOWN_HOSTS" 2>/dev/null; then
        log "Adding GitHub to known_hosts ..."
        ssh-keyscan github.com >> "$KNOWN_HOSTS" 2>/dev/null
    fi
else
    warn "No SSH key at ~/.ssh/id_ed25519 — git clone via SSH will not work."
    warn "Generate one: ssh-keygen -t ed25519 -C 'your@email.com'"
fi

# ─── Step 5: Seed rule templates if not present (extension — not in spec) ─────
CODING_RULES="$IAH_DIR/rules/CODING_RULES.md"
COMMON_CONTEXT="$IAH_DIR/rules/COMMON_CONTEXT.md"

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
- Environment: Docker container on a Proxmox Debian 12 VM.
- Available tools: git, standard shell utilities.

Read `SESSION_MEMORY.md` at the start of every session — it contains your working memory.
EOF
    log "COMMON_CONTEXT.md template created."
fi

# ─── Step 6: Start Docker Compose ─────────────────────────────────────────────
log "Building and starting Docker Compose ..."
docker compose up -d --build

log "Waiting for services to be healthy ..."
# Poll idh-app health endpoint instead of sleeping a fixed duration.
for i in $(seq 1 30); do
    if curl -sf "http://localhost:${IDH_APP_PORT:-8000}/api/v1/health/ping" > /dev/null 2>&1; then
        log "idh-app is healthy."
        break
    fi
    sleep 3
done

# ─── Step 7: Install IDH plugin ───────────────────────────────────────────────
log "Installing IDH plugin in openclaw-gateway ..."
# The plugin is mounted at /home/node/.openclaw/plugins/idh (read-only).
# The install command registers it in OpenClaw's extension registry.
docker exec openclaw-gateway openclaw extensions install \
    /home/node/.openclaw/plugins/idh || \
    warn "Plugin install step failed — check openclaw-gateway logs."

log ""
log "✅ IA-Dev-Hub is running!"
log "   OpenClaw gateway  : http://localhost:${OPENCLAW_GATEWAY_PORT:-18789}"
log "   OpenClaw dashboard: http://localhost:${OPENCLAW_DASHBOARD_PORT:-18790}"
log "   IDH App           : http://localhost:${IDH_APP_PORT:-8000}"
log "   VS Code Server    : http://localhost:${CODE_SERVER_PORT:-8443}"
log ""
log "Test plugin: send /idh_ping in any Telegram group the bot is in."
```

- [ ] **Step 2: Make executable and commit**

```bash
chmod +x setup.sh
git add setup.sh
git commit -m "feat: add setup.sh first-run bootstrap script"
```

---

## Task 8: Full smoke test

- [ ] **Step 1: Run all Python tests**

```bash
cd src/idh-app
uv run pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 2: Run frontend tests**

```bash
cd src/idh-app/frontend && npm test
```

Expected: All tests PASS.

- [ ] **Step 3: Run plugin tests**

```bash
cd plugin/idh && npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Validate Docker Compose config**

```bash
cd "$(git rev-parse --show-toplevel)"
docker compose config --quiet
```

Expected: No output (valid config).

- [ ] **Step 5: Create minimal test .env and start all services**

```bash
mkdir -p ~/iah/{config,workspaces,state,rules}

cat > ~/iah/.env <<'EOF'
TELEGRAM_BOT_TOKEN=test_token
TELEGRAM_USER_ID=123456789
IDH_WEBHOOK_SECRET=test-secret-32chars-xxxxxxxxxxxxxxxx
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_DASHBOARD_PORT=18790
IDH_APP_PORT=8000
CODE_SERVER_PORT=8443
FASTAPI_APP_NAME=IDH App
FASTAPI_DEBUG_MODE=false
CORS_ALLOWED_ORIGINS=*
LOGGING_CONSOLE_LEVEL=INFO
LOGGING_FILE_LEVEL=DEBUG
LOGGING_ENABLE_CONSOLE=true
LOGGING_ENABLE_FILE=false
LOGGING_LPP_FORMAT=ShortFormat
BRIDGE_TTL_HOURS=8
EOF

echo '{"gateway":{"bind":"lan"},"channels":{"telegram":{"enabled":true,"botToken":"test","groupPolicy":"allowlist","groups":{}}}}' \
  > ~/iah/config/openclaw.json

docker compose up -d --build
```

- [ ] **Step 6: Poll idh-app health endpoint**

```bash
for i in $(seq 1 30); do
  curl -sf http://localhost:8000/api/v1/health/ping && echo "" && break || sleep 3
done
```

Expected: `{"status":"ok","version":"0.1.0"}`

- [ ] **Step 7: Check all services are running**

```bash
docker compose ps
```

Expected: All 3 services show `running` status.

- [ ] **Step 8: Verify code-server responds**

```bash
curl -sf -o /dev/null -w "%{http_code}" http://localhost:8443
```

Expected: `200` or `302`.

- [ ] **Step 9: Stop services**

```bash
docker compose down
```

- [ ] **Step 10: Final commit**

```bash
git add .
git commit -m "feat: complete IDH Foundation — all services start, health check passes

All 3 services (openclaw-gateway, idh-app, code-server) start cleanly.
GET /api/v1/health/ping returns {status: ok}.
All Python, TypeScript, and React tests pass.
setup.sh bootstraps ~/iah/ data directory on first run.

Plan 1 of 4 complete."
```

---

## Verification Checklist

Before marking Plan 1 complete:

- [ ] `docker compose config --quiet` → no errors
- [ ] `docker compose up -d --build` → all 3 services start
- [ ] `curl http://localhost:8000/api/v1/health/ping` → `{"status":"ok","version":"0.1.0"}`
- [ ] `curl -o /dev/null -w "%{http_code}" http://localhost:8443` → `200` or `302`
- [ ] `cd src/idh-app && uv run pytest tests/ -v` → all PASS
- [ ] `cd src/idh-app/frontend && npm test` → all PASS
- [ ] `cd plugin/idh && npm test` → all PASS
- [ ] `docker compose ps` → all services `running`
- [ ] `git log --oneline` → clean commit history, no untracked files

---

## What's Next

| Plan | Focus |
|---|---|
| **Plan 2** | idh-app backend: all API routes (projects, bridge manager, watchdog asyncio, memory auto-summary, settings, openclaw.json writer with filelock) |
| **Plan 3** | OpenClaw plugin: commands, hooks, wizard engine, state reader, inbound webhook receiver |
| **Plan 4** | React dashboard: full UI — Dashboard, ProjectPage tabs, GlobalSettings, memory editor, CountdownTimer |
