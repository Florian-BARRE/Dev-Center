# dev-center-app Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete FastAPI backend for dev-center-app — project CRUD, Claude Code session management, git clone, auth detection, coding rules, memory viewer, monitoring, and Docker deployment.

**Architecture:** FastAPI with CONTEXT service locator, all state in two JSON files (`/data/projects.json`, `/data/global-config.json`), sessions are `claude remote-control` subprocesses with `--continue` for memory continuity, WebSocket for real-time log and monitoring streams.

**Tech Stack:** Python 3.12, uv, FastAPI, uvicorn[standard], pydantic v2, loggerplusplus, configplusplus, pytest, pytest-asyncio, httpx

**Spec:** `docs/superpowers/specs/2026-03-24-dev-center-app-design.md`

---

## File Structure

All files live under `src/dev_center_app/` (**underscores**, not hyphens — Python module name). This directory is created from scratch — do not copy anything from `src/idh-app/`.

> **Important:** All paths in this plan use `src/dev_center_app/` (underscores). Use this name from Task 1 Step 1 onward.

```
src/dev_center_app/
├── pyproject.toml
├── .python-version                    (contains: 3.12)
├── entrypoint.py                      app factory + CONTEXT bootstrap
├── Dockerfile
├── config/
│   ├── __init__.py                    exports RUNTIME_CONFIG
│   └── runtime/
│       ├── __init__.py
│       └── runtime_config.py          EnvConfigLoader + logging setup
├── libs/
│   ├── __init__.py
│   ├── state/
│   │   ├── __init__.py
│   │   ├── models.py                  ALL Pydantic models (Project, SessionState, etc.)
│   │   └── state_manager.py           read/write projects.json + global-config.json
│   ├── event_bus/
│   │   ├── __init__.py
│   │   └── event_bus.py               async pub/sub for monitoring events
│   ├── session_manager/
│   │   ├── __init__.py
│   │   └── session_manager.py         start/stop/renew + watchdog + per-project Lock
│   ├── git_manager/
│   │   ├── __init__.py
│   │   └── git_manager.py             async git clone with progress streaming
│   ├── auth_checker/
│   │   ├── __init__.py
│   │   └── auth_checker.py            ~/.claude credential check + spawn claude auth login
│   └── scheduler/
│       ├── __init__.py
│       └── scheduler.py               time-range evaluation, start/stop on schedule entry/exit
├── backend/
│   ├── __init__.py                    exports create_app, CONTEXT
│   ├── app.py                         FastAPI factory, router registration
│   ├── context.py                     CONTEXT static class (typed service locator)
│   ├── lifespan.py                    startup/shutdown orchestration
│   ├── libs/
│   │   ├── __init__.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── error_handling.py      @auto_handle_errors decorator
│   └── routers/
│       ├── __init__.py
│       ├── health/    router.py + models.py + __init__.py
│       ├── projects/  router.py + models.py + __init__.py
│       ├── sessions/  router.py + models.py + __init__.py
│       ├── memory/    router.py + models.py + __init__.py
│       ├── rules/     router.py + models.py + __init__.py
│       ├── auth/      router.py + models.py + __init__.py
│       ├── monitoring/ router.py + models.py + __init__.py
│       └── settings/  router.py + models.py + __init__.py
└── tests/
    ├── conftest.py
    ├── test_state.py
    ├── test_session_manager.py
    ├── test_git_manager.py
    ├── test_auth_checker.py
    ├── test_scheduler.py
    ├── test_projects_router.py
    ├── test_sessions_router.py
    ├── test_rules_router.py
    ├── test_settings_router.py
    └── test_auth_router.py
```

**Infrastructure:**
```
services/dev-center-app/
├── .env
└── .env.example
docker-compose.yml          rewritten (replaces old openclaw/idh-app compose)
docker-compose.dev.yml      rewritten
```

---

## Task 1: Project scaffold

**Files:**
- Create: `src/dev_center_app/pyproject.toml`
- Create: `src/dev_center_app/.python-version`
- Create: `src/dev_center_app/config/__init__.py`
- Create: `src/dev_center_app/config/runtime/__init__.py`
- Create: `src/dev_center_app/config/runtime/runtime_config.py`
- Create: all `__init__.py` stubs under `libs/`, `backend/`, `backend/libs/`, `backend/libs/utils/`, `backend/routers/`
- Create: `services/dev-center-app/.env.example`

- [ ] **Step 1: Create directory and pyproject.toml**

```bash
mkdir -p src/dev_center_app
```

```toml
[project]
name = "dev_center_app"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.0",
    "loggerplusplus>=1.0",
    "configplusplus>=1.0",
    "websockets>=12.0",
    "aiofiles>=23.0",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"

[tool.ruff.lint]
ignore = ["F541"]
```

- [ ] **Step 2: Create .python-version**

Content: `3.12`

- [ ] **Step 3: Install dependencies**

```bash
cd src/dev_center_app
uv sync
```

- [ ] **Step 4: Create runtime_config.py**

```python
# ====== Code Summary ======
# RUNTIME_CONFIG — environment-based settings and logging setup.
# Must be the first import in every entry point.

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
if os.environ.get("DEV_MODE"):
    loggerplusplus.add(sink=sys.stdout, level="DEBUG", format=lpp_formats.ShortFormat())
    _dev_logger = loggerplusplus.bind(identifier="DEV")
    _dev_logger.warning(f"DEV MODE activated")
    loggerplusplus.remove()


class RUNTIME_CONFIG(EnvConfigLoader):
    # ───── Paths ─────
    PATH_ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent.parent
    PATH_LIBS = PATH_ROOT_DIR / "libs"
    sys.path.append(str(PATH_LIBS))

    # ───── Logging ─────
    LOGGING_CONSOLE_LEVEL = env("LOGGING_CONSOLE_LEVEL", default="INFO")
    LOGGING_FILE_LEVEL = env("LOGGING_FILE_LEVEL", default="INFO")
    LOGGING_ENABLE_CONSOLE = env("LOGGING_ENABLE_CONSOLE", cast=bool, default=True)
    LOGGING_ENABLE_FILE = env("LOGGING_ENABLE_FILE", cast=bool, default=False)
    LOGGING_LPP_FORMAT = env("LOGGING_LPP_FORMAT", default="ShortFormat")

    # ───── FastAPI ─────
    FASTAPI_APP_NAME = env("FASTAPI_APP_NAME", default="dev-center-app")
    FASTAPI_DEBUG_MODE = env("FASTAPI_DEBUG_MODE", cast=bool, default=False)
    CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS", default="*")

    # ───── App paths ─────
    DATA_DIR = env("DATA_DIR", cast=pathlib.Path, default=pathlib.Path("/data"))
    WORKSPACES_DIR = env("WORKSPACES_DIR", cast=pathlib.Path, default=pathlib.Path("/workspaces"))
    CLAUDE_DIR = env("CLAUDE_DIR", cast=pathlib.Path, default=pathlib.Path.home() / ".claude")

    # ───── Session defaults ─────
    DEFAULT_TTL_HOURS = env("DEFAULT_TTL_HOURS", cast=int, default=8)
    RENEW_THRESHOLD_MINUTES = env("RENEW_THRESHOLD_MINUTES", cast=int, default=30)


# ─── Apply logging config after class definition ───
_lpp_format = getattr(lpp_formats, RUNTIME_CONFIG.LOGGING_LPP_FORMAT, lpp_formats.ShortFormat)()

if RUNTIME_CONFIG.LOGGING_ENABLE_CONSOLE:
    loggerplusplus.add(sink=sys.stdout, level=RUNTIME_CONFIG.LOGGING_CONSOLE_LEVEL, format=_lpp_format)

if RUNTIME_CONFIG.LOGGING_ENABLE_FILE:
    loggerplusplus.add(
        pathlib.Path("logs"),
        level=RUNTIME_CONFIG.LOGGING_FILE_LEVEL,
        format=_lpp_format,
        rotation="1 week",
        retention="30 days",
        compression="zip",
        encoding="utf-8",
        enqueue=True,
        backtrace=True,
        diagnose=False,
    )
```

- [ ] **Step 5: Create config/__init__.py**

```python
from .runtime import RUNTIME_CONFIG

__all__ = ["RUNTIME_CONFIG"]
```

- [ ] **Step 6: Create config/runtime/__init__.py**

```python
from .runtime_config import RUNTIME_CONFIG

__all__ = ["RUNTIME_CONFIG"]
```

- [ ] **Step 7: Create services/dev-center-app/.env.example**

```bash
# FastAPI
FASTAPI_APP_NAME=dev-center-app
FASTAPI_DEBUG_MODE=false
CORS_ALLOWED_ORIGINS=*

# Logging
LOGGING_CONSOLE_LEVEL=INFO
LOGGING_FILE_LEVEL=INFO
LOGGING_ENABLE_CONSOLE=true
LOGGING_ENABLE_FILE=false
LOGGING_LPP_FORMAT=ShortFormat

# Session defaults
DEFAULT_TTL_HOURS=8
RENEW_THRESHOLD_MINUTES=30
```

- [ ] **Step 8: Create all empty __init__.py stubs** for:
  `libs/__init__.py`, `libs/state/__init__.py`, `libs/event_bus/__init__.py`,
  `libs/session_manager/__init__.py`, `libs/git_manager/__init__.py`,
  `libs/auth_checker/__init__.py`, `libs/scheduler/__init__.py`,
  `backend/__init__.py`, `backend/libs/__init__.py`, `backend/libs/utils/__init__.py`,
  `backend/routers/__init__.py`, and one `__init__.py` per router folder.

- [ ] **Step 9: Verify import works**

```bash
cd src/dev_center_app
uv run python -c "from config import RUNTIME_CONFIG; print(RUNTIME_CONFIG.FASTAPI_APP_NAME)"
```
Expected output: `dev_center_app`

- [ ] **Step 10: Commit**

```bash
git add src/dev_center_app/ services/dev-center-app/
git commit -m "feat(dev-center): project scaffold — pyproject.toml, runtime_config, directory structure"
```

---

## Task 2: State models + StateManager

**Files:**
- Create: `src/dev_center_app/libs/state/models.py`
- Create: `src/dev_center_app/libs/state/state_manager.py`
- Create: `src/dev_center_app/libs/state/__init__.py`
- Create: `src/dev_center_app/tests/conftest.py`
- Create: `src/dev_center_app/tests/test_state.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_state.py
import pytest
import pathlib
from libs.state.models import (
    Project, SessionState, ScheduleConfig, TimeRange,
    GlobalConfig, GlobalDefaults, StateFile,
)
from libs.state.state_manager import StateManager


def make_project(id="my-proj") -> Project:
    return Project(
        id=id,
        name=id,
        repo_url="https://github.com/user/my-proj",
        workspace_path=f"/workspaces/{id}",
    )


def test_state_manager_starts_empty(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    state = sm.load_projects()
    assert state.projects == {}


def test_upsert_and_get_project(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    p = make_project()
    sm.upsert_project(p)
    loaded = sm.get_project("my-proj")
    assert loaded is not None
    assert loaded.repo_url == "https://github.com/user/my-proj"


def test_delete_project(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    sm.upsert_project(make_project())
    sm.delete_project("my-proj")
    assert sm.get_project("my-proj") is None


def test_global_config_defaults(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    cfg = sm.load_global_config()
    assert cfg.defaults.default_model == "claude-sonnet-4-6"
    assert cfg.defaults.default_ttl_hours == 8


def test_save_load_global_config(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    cfg = sm.load_global_config()
    cfg.defaults.default_ttl_hours = 12
    sm.save_global_config(cfg)
    reloaded = sm.load_global_config()
    assert reloaded.defaults.default_ttl_hours == 12


def test_global_rules_roundtrip(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    sm.save_global_rules("# My rules\n- Use type hints\n")
    assert sm.load_global_rules() == "# My rules\n- Use type hints\n"


def test_project_id_derivation():
    from libs.state.models import derive_project_id
    assert derive_project_id("https://github.com/user/My_Project.git") == "my-project"
    assert derive_project_id("https://github.com/user/Patrimonium") == "patrimonium"
    assert derive_project_id("https://github.com/user/my--repo.git") == "my-repo"


def test_project_id_collision_handling(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    sm.upsert_project(make_project("patrimonium"))
    unique = sm.unique_project_id("patrimonium")
    assert unique == "patrimonium-2"
    sm.upsert_project(make_project("patrimonium-2"))
    assert sm.unique_project_id("patrimonium") == "patrimonium-3"
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
cd src/dev_center_app
uv run pytest tests/test_state.py -v
```
Expected: FAILED (ImportError — modules don't exist yet)

- [ ] **Step 3: Write models.py**

```python
# ====== Code Summary ======
# Pydantic models for dev-center-app state.

from __future__ import annotations
import re
from typing import Any
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    """Base model with camelCase JSON serialisation and Python-attribute construction."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SessionState(_CamelModel):
    """Active Claude remote-control session state."""
    pid: int
    workspace: str
    started_at: str           # ISO-8601 UTC
    expires_at: str           # ISO-8601 UTC
    auto_renew: bool = True
    claude_project_hash: str = ""


class TimeRange(_CamelModel):
    """Active time window in HH:MM 24h format. end='00:00' means midnight."""
    start: str
    end: str


class ScheduleConfig(_CamelModel):
    """Session scheduling configuration."""
    enabled: bool = False
    ranges: list[TimeRange] = []
    days: list[str] = []  # ["mon","tue","wed","thu","fri","sat","sun"] — empty = all days


class Project(_CamelModel):
    """Persistent state for a registered dev project."""
    id: str
    name: str
    repo_url: str
    workspace_path: str
    provider: str = "anthropic"
    model: str = "claude-sonnet-4-6"
    schedule: ScheduleConfig = ScheduleConfig()
    session: SessionState | None = None


class StateFile(_CamelModel):
    """Root structure of projects.json."""
    projects: dict[str, Project] = {}


class GlobalDefaults(_CamelModel):
    """Default values for new sessions."""
    default_provider: str = "anthropic"
    default_model: str = "claude-sonnet-4-6"
    default_ttl_hours: int = 8
    renew_threshold_minutes: int = 30


class GlobalConfig(_CamelModel):
    """Root structure of global-config.json."""
    defaults: GlobalDefaults = GlobalDefaults()
    schedule: ScheduleConfig = ScheduleConfig()


def derive_project_id(repo_url: str) -> str:
    """
    Derive a project slug from a GitHub URL.

    Takes the last path segment, strips .git, lowercases,
    replaces non-alphanumeric with hyphens, collapses consecutive hyphens.

    Args:
        repo_url (str): GitHub HTTPS URL.

    Returns:
        str: URL-safe project slug.
    """
    # 1. Extract last path segment
    segment = repo_url.rstrip("/").split("/")[-1]
    # 2. Strip .git suffix
    if segment.endswith(".git"):
        segment = segment[:-4]
    # 3. Lowercase and replace non-alphanumeric with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", segment.lower())
    # 4. Collapse and strip leading/trailing hyphens
    return slug.strip("-")


# Delimiter markers used to wrap global rules in per-project CLAUDE.md files.
# Both the rules router and settings router import these constants from here
# to avoid duplication.
GLOBAL_RULES_START = "<!-- dev-center: global-rules-start -->"
GLOBAL_RULES_END = "<!-- dev-center: global-rules-end -->"


__all__ = [
    "_CamelModel",
    "SessionState", "TimeRange", "ScheduleConfig", "Project",
    "StateFile", "GlobalDefaults", "GlobalConfig", "derive_project_id",
    "GLOBAL_RULES_START", "GLOBAL_RULES_END",
]
```

- [ ] **Step 4: Write state_manager.py**

```python
# ====== Code Summary ======
# StateManager — thread-safe read/write for projects.json and global-config.json.

from __future__ import annotations
import json
import pathlib
import threading
from loggerplusplus import LoggerClass
from libs.state.models import Project, StateFile, GlobalConfig, derive_project_id


class StateManager(LoggerClass):
    """
    Manages persistence for projects.json, global-config.json, and global-rules.md.

    All write operations are protected by a threading.Lock to prevent
    concurrent writes from the watchdog, scheduler, and API handlers.

    Attributes:
        _data_dir (pathlib.Path): Directory containing all state files.
        _lock (threading.Lock): Guards all read-modify-write operations.
    """

    def __init__(self, data_dir: pathlib.Path) -> None:
        LoggerClass.__init__(self)
        self._data_dir = data_dir
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    # ──────────────────────── Private helpers ────────────────────────

    @property
    def _projects_path(self) -> pathlib.Path:
        return self._data_dir / "projects.json"

    @property
    def _global_config_path(self) -> pathlib.Path:
        return self._data_dir / "global-config.json"

    @property
    def _global_rules_path(self) -> pathlib.Path:
        return self._data_dir / "global-rules.md"

    def _read_projects_file(self) -> StateFile:
        """Read projects.json, returning an empty StateFile if missing."""
        if not self._projects_path.exists():
            return StateFile()
        raw = self._projects_path.read_text(encoding="utf-8")
        return StateFile.model_validate_json(raw)

    def _write_projects_file(self, state: StateFile) -> None:
        """Write StateFile to projects.json atomically."""
        self._projects_path.write_text(
            state.model_dump_json(by_alias=True, indent=2), encoding="utf-8"
        )

    # ──────────────────────── Projects ───────────────────────────────

    def load_projects(self) -> StateFile:
        """
        Load and return the full projects state.

        Returns:
            StateFile: Current state with all projects.
        """
        with self._lock:
            return self._read_projects_file()

    def get_project(self, project_id: str) -> Project | None:
        """
        Fetch a single project by ID.

        Args:
            project_id (str): Project slug.

        Returns:
            Project | None: The project, or None if not found.
        """
        with self._lock:
            return self._read_projects_file().projects.get(project_id)

    def upsert_project(self, project: Project) -> None:
        """
        Insert or update a project in state.

        Args:
            project (Project): Project to persist.
        """
        with self._lock:
            state = self._read_projects_file()
            state.projects[project.id] = project
            self._write_projects_file(state)
            self.logger.debug(f"Upserted project '{project.id}'")

    def delete_project(self, project_id: str) -> None:
        """
        Remove a project from state.

        Args:
            project_id (str): Project slug to remove.
        """
        with self._lock:
            state = self._read_projects_file()
            state.projects.pop(project_id, None)
            self._write_projects_file(state)
            self.logger.info(f"Deleted project '{project_id}'")

    def unique_project_id(self, base_id: str) -> str:
        """
        Return base_id if unused, otherwise base_id-2, base_id-3, etc.

        Args:
            base_id (str): Desired project slug.

        Returns:
            str: A project ID not currently in use.
        """
        with self._lock:
            state = self._read_projects_file()
            if base_id not in state.projects:
                return base_id
            n = 2
            while f"{base_id}-{n}" in state.projects:
                n += 1
            return f"{base_id}-{n}"

    # ──────────────────────── Global config ──────────────────────────

    def load_global_config(self) -> GlobalConfig:
        """
        Load global configuration, returning defaults if file is missing.

        Returns:
            GlobalConfig: Current global configuration.
        """
        with self._lock:
            if not self._global_config_path.exists():
                return GlobalConfig()
            raw = self._global_config_path.read_text(encoding="utf-8")
            return GlobalConfig.model_validate_json(raw)

    def save_global_config(self, config: GlobalConfig) -> None:
        """
        Persist global configuration.

        Args:
            config (GlobalConfig): Configuration to save.
        """
        with self._lock:
            self._global_config_path.write_text(
                config.model_dump_json(by_alias=True, indent=2), encoding="utf-8"
            )

    # ──────────────────────── Global rules ───────────────────────────

    def load_global_rules(self) -> str:
        """
        Load global coding rules markdown, returning empty string if missing.

        Returns:
            str: Markdown content of global-rules.md.
        """
        with self._lock:
            if not self._global_rules_path.exists():
                return ""
            return self._global_rules_path.read_text(encoding="utf-8")

    def save_global_rules(self, content: str) -> None:
        """
        Persist global coding rules.

        Args:
            content (str): Markdown content to save.
        """
        with self._lock:
            self._global_rules_path.write_text(content, encoding="utf-8")
```

- [ ] **Step 5: Update libs/state/__init__.py**

```python
from .models import (
    _CamelModel,
    SessionState, TimeRange, ScheduleConfig, Project,
    StateFile, GlobalDefaults, GlobalConfig, derive_project_id,
    GLOBAL_RULES_START, GLOBAL_RULES_END,
)
from .state_manager import StateManager

__all__ = [
    "_CamelModel",
    "SessionState", "TimeRange", "ScheduleConfig", "Project",
    "StateFile", "GlobalDefaults", "GlobalConfig", "derive_project_id",
    "GLOBAL_RULES_START", "GLOBAL_RULES_END",
    "StateManager",
]
```

- [ ] **Step 6: Create tests/conftest.py**

```python
# tests/conftest.py
import pathlib
import pytest
from loggerplusplus import loggerplusplus
from libs.state.state_manager import StateManager
from libs.event_bus.event_bus import EventBus
from libs.session_manager.session_manager import SessionManager
from libs.git_manager.git_manager import GitManager
from libs.auth_checker.auth_checker import AuthChecker
from libs.scheduler.scheduler import SchedulerService
from backend import CONTEXT


@pytest.fixture
def tmp_data(tmp_path: pathlib.Path) -> pathlib.Path:
    """Temporary /data directory for state files."""
    d = tmp_path / "data"
    d.mkdir()
    return d


@pytest.fixture
def state_manager(tmp_data: pathlib.Path) -> StateManager:
    """StateManager wired to a temp directory."""
    return StateManager(data_dir=tmp_data)


def setup_context(tmp_data: pathlib.Path, tmp_path: pathlib.Path) -> None:
    """Wire all CONTEXT services for router tests using temp directories."""
    CONTEXT.logger = loggerplusplus.bind(identifier="TEST")
    CONTEXT.auth_ok = True
    from config import RUNTIME_CONFIG
    CONTEXT.RUNTIME_CONFIG = RUNTIME_CONFIG
    CONTEXT.state_manager = StateManager(data_dir=tmp_data)
    CONTEXT.event_bus = EventBus()
    CONTEXT.session_manager = SessionManager(
        state_manager=CONTEXT.state_manager,
        workspaces_dir=tmp_path / "workspaces",
        claude_dir=tmp_path / ".claude",
        event_bus=CONTEXT.event_bus,
        default_ttl_hours=8,
        renew_threshold_minutes=30,
    )
    CONTEXT.git_manager = GitManager(workspaces_dir=tmp_path / "workspaces")
    CONTEXT.auth_checker = AuthChecker(claude_dir=tmp_path / ".claude")
    CONTEXT.scheduler = SchedulerService(
        state_manager=CONTEXT.state_manager,
        session_manager=CONTEXT.session_manager,
    )
```

- [ ] **Step 7: Run tests — expect all to pass**

```bash
cd src/dev_center_app
uv run pytest tests/test_state.py -v
```
Expected: 8 tests PASSED

- [ ] **Step 8: Commit**

```bash
git add src/dev_center_app/libs/state/ src/dev_center_app/tests/
git commit -m "feat(dev-center): state models and StateManager"
```

---

## Task 3: EventBus

**Files:**
- Create: `src/dev_center_app/libs/event_bus/event_bus.py`
- Create: `src/dev_center_app/libs/event_bus/__init__.py`

No dedicated test file — EventBus is tested implicitly via SessionManager tests (Task 4).

- [ ] **Step 1: Write event_bus.py**

```python
# ====== Code Summary ======
# EventBus — async in-process pub/sub for real-time monitoring events.

from __future__ import annotations
import asyncio
from collections import defaultdict
from typing import Any, Callable
from loggerplusplus import LoggerClass


EventHandler = Callable[[str, dict[str, Any]], asyncio.coroutine]


class EventBus(LoggerClass):
    """
    Async in-process publish/subscribe bus.

    Subscribers register async callbacks for event types. Publishing
    an event calls all matching subscribers concurrently. Unmatched
    events are silently dropped.

    Attributes:
        _subscribers (dict[str, list[Callable]]): event_type → list of async callbacks.
    """

    def __init__(self) -> None:
        LoggerClass.__init__(self)
        self._subscribers: dict[str, list[Callable]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Callable) -> None:
        """
        Register an async handler for an event type.

        Args:
            event_type (str): Event name to subscribe to (e.g. "session.started").
            handler (Callable): Async callable receiving (event_type, data).
        """
        self._subscribers[event_type].append(handler)
        self.logger.debug(f"Subscribed handler to '{event_type}'")

    def unsubscribe(self, event_type: str, handler: Callable) -> None:
        """
        Remove a previously registered handler.

        Args:
            event_type (str): Event name.
            handler (Callable): Handler to remove.
        """
        self._subscribers[event_type] = [
            h for h in self._subscribers[event_type] if h is not handler
        ]

    async def publish(self, event_type: str, data: dict[str, Any], **kwargs: Any) -> None:
        """
        Publish an event to all registered subscribers concurrently.

        Args:
            event_type (str): Event name.
            data (dict): Event payload.
            **kwargs: Additional fields merged into data before dispatch.
        """
        payload = {**data, **kwargs}
        handlers = self._subscribers.get(event_type, [])
        if not handlers:
            return
        self.logger.debug(f"Publishing '{event_type}' to {len(handlers)} subscriber(s)")
        await asyncio.gather(*(h(event_type, payload) for h in handlers), return_exceptions=True)
```

- [ ] **Step 2: Update libs/event_bus/__init__.py**

```python
from .event_bus import EventBus

__all__ = ["EventBus"]
```

- [ ] **Step 3: Commit**

```bash
git add src/dev_center_app/libs/event_bus/
git commit -m "feat(dev-center): EventBus for real-time monitoring events"
```

---

## Task 4: SessionManager

**Files:**
- Create: `src/dev_center_app/libs/session_manager/session_manager.py`
- Create: `src/dev_center_app/libs/session_manager/__init__.py`
- Create: `src/dev_center_app/tests/test_session_manager.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_session_manager.py
import asyncio
import pathlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from libs.state.models import Project, ScheduleConfig
from libs.state.state_manager import StateManager
from libs.event_bus.event_bus import EventBus
from libs.session_manager.session_manager import SessionManager


@pytest.fixture
def session_manager(tmp_data, tmp_path):
    sm = StateManager(data_dir=tmp_data)
    eb = EventBus()
    return SessionManager(
        state_manager=sm,
        workspaces_dir=tmp_path / "workspaces",
        claude_dir=tmp_path / ".claude",
        event_bus=eb,
        default_ttl_hours=8,
        renew_threshold_minutes=30,
    )


@pytest.fixture
def project_in_state(state_manager):
    p = Project(
        id="my-proj",
        name="my-proj",
        repo_url="https://github.com/user/my-proj",
        workspace_path="/workspaces/my-proj",
    )
    state_manager.upsert_project(p)
    return p


@pytest.mark.asyncio
async def test_start_session(session_manager, state_manager, project_in_state):
    mock_proc = MagicMock()
    mock_proc.pid = 1234
    mock_proc.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        await session_manager.start_session("my-proj")

    project = state_manager.get_project("my-proj")
    assert project.session is not None
    assert project.session.pid == 1234
    assert project.session.auto_renew is True
    # Verify --continue flag was passed
    args = mock_exec.call_args[0]
    assert "--continue" in args


@pytest.mark.asyncio
async def test_start_session_already_active(session_manager, state_manager, project_in_state):
    mock_proc = MagicMock()
    mock_proc.pid = 1234
    mock_proc.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        await session_manager.start_session("my-proj")

    with patch("asyncio.create_subprocess_exec") as mock_exec:
        await session_manager.start_session("my-proj")
        mock_exec.assert_not_called()


@pytest.mark.asyncio
async def test_stop_session(session_manager, state_manager, project_in_state):
    mock_proc = MagicMock()
    mock_proc.pid = 5678
    mock_proc.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        await session_manager.start_session("my-proj")

    with patch("os.kill") as mock_kill:
        await session_manager.stop_session("my-proj")
        mock_kill.assert_called_once()

    project = state_manager.get_project("my-proj")
    assert project.session is None


@pytest.mark.asyncio
async def test_stop_session_no_session(session_manager, project_in_state):
    # Should not raise
    await session_manager.stop_session("my-proj")


@pytest.mark.asyncio
async def test_renew_session(session_manager, state_manager, project_in_state):
    mock_proc = MagicMock()
    mock_proc.pid = 100
    mock_proc.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        await session_manager.start_session("my-proj")

    mock_proc2 = MagicMock()
    mock_proc2.pid = 200
    mock_proc2.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc2), \
         patch("os.kill"):
        await session_manager.renew_session("my-proj")

    project = state_manager.get_project("my-proj")
    assert project.session.pid == 200


@pytest.mark.asyncio
async def test_session_publishes_event(tmp_data, tmp_path):
    sm = StateManager(data_dir=tmp_data)
    eb = EventBus()
    events = []
    async def capture(event_type, data):
        events.append((event_type, data))
    eb.subscribe("session.started", capture)

    mgr = SessionManager(
        state_manager=sm, workspaces_dir=tmp_path / "w",
        claude_dir=tmp_path / ".claude", event_bus=eb,
        default_ttl_hours=8, renew_threshold_minutes=30,
    )
    sm.upsert_project(Project(
        id="p", name="p",
        repo_url="https://github.com/u/p",
        workspace_path="/workspaces/p",
    ))
    mock_proc = MagicMock()
    mock_proc.pid = 42
    mock_proc.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        await mgr.start_session("p")

    assert any(t == "session.started" for t, _ in events)
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
uv run pytest tests/test_session_manager.py -v
```

- [ ] **Step 3: Write session_manager.py**

```python
# ====== Code Summary ======
# SessionManager — lifecycle of claude remote-control subprocesses.

from __future__ import annotations
import asyncio
import datetime
import os
import pathlib
import signal
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

from loggerplusplus import LoggerClass
from libs.state.models import SessionState
from libs.state.state_manager import StateManager

if TYPE_CHECKING:
    from libs.event_bus.event_bus import EventBus


class SessionManager(LoggerClass):
    """
    Manages claude remote-control subprocess lifecycle per project.

    Each project gets one subprocess at a time. All start/stop/renew
    operations acquire a per-project asyncio.Lock to prevent races
    between the API, watchdog, and scheduler.

    Attributes:
        _state_manager (StateManager): Persisted project state.
        _workspaces_dir (pathlib.Path): Root directory for project workspaces.
        _claude_dir (pathlib.Path): ~/.claude directory path.
        _event_bus (EventBus): For publishing session lifecycle events.
        _default_ttl_hours (int): Session TTL in hours.
        _renew_threshold_minutes (int): Renew when TTL falls below this.
        _processes (dict[str, asyncio.subprocess.Process]): Live subprocess handles.
        _locks (dict[str, asyncio.Lock]): Per-project concurrency locks.
    """

    def __init__(
        self,
        state_manager: StateManager,
        workspaces_dir: pathlib.Path,
        claude_dir: pathlib.Path,
        event_bus: "EventBus",
        default_ttl_hours: int,
        renew_threshold_minutes: int,
    ) -> None:
        LoggerClass.__init__(self)
        self._state_manager = state_manager
        self._workspaces_dir = workspaces_dir
        self._claude_dir = claude_dir
        self._event_bus = event_bus
        self._default_ttl_hours = default_ttl_hours
        self._renew_threshold_minutes = renew_threshold_minutes
        self._processes: dict[str, asyncio.subprocess.Process] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    # ──────────────────────── Private helpers ────────────────────────

    def _get_lock(self, project_id: str) -> asyncio.Lock:
        """Get or create the per-project asyncio.Lock."""
        if project_id not in self._locks:
            self._locks[project_id] = asyncio.Lock()
        return self._locks[project_id]

    def _expires_at(self) -> str:
        """Compute ISO-8601 UTC expiry timestamp for a new session."""
        return (
            datetime.datetime.now(datetime.UTC)
            + datetime.timedelta(hours=self._default_ttl_hours)
        ).isoformat()

    def _started_at(self) -> str:
        """Return current ISO-8601 UTC timestamp."""
        return datetime.datetime.now(datetime.UTC).isoformat()

    def _kill(self, pid: int) -> None:
        """Send SIGTERM to a process, ignoring not-found and permission errors."""
        try:
            os.kill(pid, signal.SIGTERM)
            self.logger.info(f"Sent SIGTERM to PID {pid}")
        except ProcessLookupError:
            self.logger.warning(f"PID {pid} already gone")
        except PermissionError:
            self.logger.warning(f"No permission to signal PID {pid}")

    # ──────────────────────── Public API ─────────────────────────────

    async def start_session(self, project_id: str) -> None:
        """
        Launch a claude remote-control session for the project.

        Uses --continue to resume the last conversation in the workspace.
        No-ops if a session is already active.

        Args:
            project_id (str): Project slug.

        Raises:
            ValueError: If the project is not found in state.
            RuntimeError: If the subprocess fails to start.
        """
        async with self._get_lock(project_id):
            # 1. Check project exists
            project = self._state_manager.get_project(project_id)
            if project is None:
                raise ValueError(f"Project '{project_id}' not found")

            # 2. Skip if session already running
            if project.session is not None:
                self.logger.info(f"Session already active for '{project_id}' (PID {project.session.pid})")
                return

            # 3. Launch subprocess
            workspace = pathlib.Path(project.workspace_path)
            self.logger.info(f"Starting session for '{project_id}' in '{workspace}'")

            proc = await asyncio.create_subprocess_exec(
                "claude", "remote-control",
                "--workspace", str(workspace),
                "--claude-dir", str(self._claude_dir),
                "--continue",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )

            # 4. Persist session state
            session = SessionState(
                pid=proc.pid,
                workspace=str(workspace),
                started_at=self._started_at(),
                expires_at=self._expires_at(),
            )
            project.session = session
            self._state_manager.upsert_project(project)
            self._processes[project_id] = proc
            self.logger.info(f"Session PID {proc.pid} started for '{project_id}'")

            # 5. Publish event
            await self._event_bus.publish(
                "session.started",
                {"pid": proc.pid, "workspace": str(workspace), "expires_at": session.expires_at},
                project_id=project_id,
            )

    async def stop_session(self, project_id: str) -> None:
        """
        Stop the active session for a project.

        Args:
            project_id (str): Project slug.
        """
        async with self._get_lock(project_id):
            project = self._state_manager.get_project(project_id)
            if project is None or project.session is None:
                self.logger.debug(f"No active session for '{project_id}'")
                return

            # 1. Kill subprocess
            self._kill(project.session.pid)
            self._processes.pop(project_id, None)

            # 2. Clear session state
            project.session = None
            self._state_manager.upsert_project(project)
            self.logger.info(f"Session stopped for '{project_id}'")

            # 3. Publish event
            await self._event_bus.publish("session.stopped", {}, project_id=project_id)

    async def renew_session(self, project_id: str) -> None:
        """
        Stop and restart the session with --continue.

        Args:
            project_id (str): Project slug.
        """
        async with self._get_lock(project_id):
            project = self._state_manager.get_project(project_id)
            if project is None:
                return
            if project.session is not None:
                self._kill(project.session.pid)
                self._processes.pop(project_id, None)
                project.session = None
                self._state_manager.upsert_project(project)

        # Restart without the lock (start_session acquires it)
        await self.start_session(project_id)
        await self._event_bus.publish("session.renewed", {}, project_id=project_id)

    async def tail_logs(self, project_id: str) -> AsyncIterator[str]:
        """
        Yield stdout lines from the active session subprocess.

        If no process is running, yields a sentinel message and exits.

        Args:
            project_id (str): Project slug.

        Yields:
            str: One decoded, stripped line at a time.
        """
        proc = self._processes.get(project_id)
        if proc is None or proc.stdout is None:
            yield f"(no active session for '{project_id}')"
            return
        async for line in proc.stdout:
            yield line.decode().rstrip()

    def update_hash(self, project_id: str, hash_value: str) -> None:
        """
        Store a discovered claude_project_hash in session state.

        Args:
            project_id (str): Project slug.
            hash_value (str): Hash of the Claude project directory.
        """
        project = self._state_manager.get_project(project_id)
        if project is not None and project.session is not None:
            project.session.claude_project_hash = hash_value
            self._state_manager.upsert_project(project)

    # ──────────────────────── Watchdog ───────────────────────────────

    async def _check_expired(self, renew_threshold_minutes: int) -> None:
        """
        Check all sessions and renew or stop expired ones.

        Args:
            renew_threshold_minutes (int): Renew if TTL < this value.
        """
        state = self._state_manager.load_projects()
        now = datetime.datetime.now(datetime.UTC)
        threshold = datetime.timedelta(minutes=renew_threshold_minutes)

        for project_id, project in state.projects.items():
            if project.session is None:
                continue
            expires = datetime.datetime.fromisoformat(project.session.expires_at)
            time_left = expires - now

            if project.session.auto_renew and time_left <= threshold:
                self.logger.info(f"Auto-renewing session for '{project_id}' (TTL {time_left})")
                await self.renew_session(project_id)
            elif not project.session.auto_renew and expires <= now:
                self.logger.info(f"Session expired for '{project_id}', stopping")
                await self.stop_session(project_id)
                await self._event_bus.publish("session.expired", {}, project_id=project_id)

    async def _watchdog_loop(self, renew_threshold_minutes: int) -> None:
        """Run expiry check every 60 seconds indefinitely."""
        while True:
            await asyncio.sleep(60)
            await self._check_expired(renew_threshold_minutes)

    async def start_watchdog(self, renew_threshold_minutes: int) -> asyncio.Task:
        """
        Start the background watchdog task.

        Args:
            renew_threshold_minutes (int): Passed to _check_expired.

        Returns:
            asyncio.Task: The running watchdog task.
        """
        self.logger.info(f"Starting session watchdog (threshold={renew_threshold_minutes}min)")
        return asyncio.create_task(self._watchdog_loop(renew_threshold_minutes))
```

- [ ] **Step 4: Update libs/session_manager/__init__.py**

```python
from .session_manager import SessionManager

__all__ = ["SessionManager"]
```

- [ ] **Step 5: Run tests — expect all to pass**

```bash
uv run pytest tests/test_session_manager.py -v
```
Expected: 6 tests PASSED

- [ ] **Step 6: Commit**

```bash
git add src/dev_center_app/libs/session_manager/ src/dev_center_app/tests/test_session_manager.py
git commit -m "feat(dev-center): SessionManager — start/stop/renew + watchdog"
```

---

## Task 5: GitManager

**Files:**
- Create: `src/dev_center_app/libs/git_manager/git_manager.py`
- Create: `src/dev_center_app/libs/git_manager/__init__.py`
- Create: `src/dev_center_app/tests/test_git_manager.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_git_manager.py
import asyncio
import pathlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from libs.git_manager.git_manager import GitManager


@pytest.fixture
def git_manager(tmp_path):
    return GitManager(workspaces_dir=tmp_path / "workspaces")


@pytest.mark.asyncio
async def test_clone_yields_progress_lines(git_manager, tmp_path):
    # Mock git subprocess that emits two output lines then exits
    mock_stdout = AsyncMock()
    mock_stdout.__aiter__ = AsyncMock(return_value=iter([
        b"Cloning into '/workspaces/my-repo'...\n",
        b"Receiving objects: 100%\n",
    ]))
    mock_proc = MagicMock()
    mock_proc.stdout = mock_stdout
    mock_proc.wait = AsyncMock(return_value=0)
    mock_proc.returncode = 0

    lines = []
    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        async for line in git_manager.clone("https://github.com/u/my-repo", "my-repo"):
            lines.append(line)

    assert any("Cloning" in l for l in lines)


@pytest.mark.asyncio
async def test_clone_returns_error_on_nonzero_exit(git_manager):
    mock_proc = MagicMock()
    mock_proc.stdout = AsyncMock()
    mock_proc.stdout.__aiter__ = AsyncMock(return_value=iter([b"fatal: repo not found\n"]))
    mock_proc.wait = AsyncMock(return_value=128)
    mock_proc.returncode = 128

    lines = []
    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        async for line in git_manager.clone("https://github.com/u/bad-repo", "bad-repo"):
            lines.append(line)

    assert any("fatal" in l.lower() or "error" in l.lower() for l in lines)


def test_workspace_path(git_manager, tmp_path):
    path = git_manager.workspace_path("my-repo")
    assert path == tmp_path / "workspaces" / "my-repo"
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
uv run pytest tests/test_git_manager.py -v
```

- [ ] **Step 3: Write git_manager.py**

```python
# ====== Code Summary ======
# GitManager — async git clone with line-by-line progress streaming.

from __future__ import annotations
import asyncio
import pathlib
import shutil
from collections.abc import AsyncIterator
from loggerplusplus import LoggerClass


class GitManager(LoggerClass):
    """
    Handles git clone operations with streaming output.

    Attributes:
        _workspaces_dir (pathlib.Path): Root directory for project workspaces.
        _clone_queues (dict[str, asyncio.Queue]): Per-project queues for clone
            progress messages. The background clone task pushes dicts into the
            queue; `tail_clone()` reads from it. Each queue item is a message
            dict (e.g. ``{"type": "progress", "line": "..."}``) or the sentinel
            ``None`` to signal end-of-stream.
    """

    def __init__(self, workspaces_dir: pathlib.Path) -> None:
        LoggerClass.__init__(self)
        self._workspaces_dir = workspaces_dir
        self._workspaces_dir.mkdir(parents=True, exist_ok=True)
        # Keyed by project_id; created before clone starts, removed after done
        self._clone_queues: dict[str, asyncio.Queue] = {}

    def start_clone_queue(self, project_id: str) -> asyncio.Queue:
        """
        Create and register a progress queue for a clone operation.

        Called by the projects router before spawning the background clone task.

        Args:
            project_id (str): Project slug.

        Returns:
            asyncio.Queue: The queue to push progress messages into.
        """
        q: asyncio.Queue = asyncio.Queue()
        self._clone_queues[project_id] = q
        return q

    async def tail_clone(self, project_id: str) -> AsyncIterator[dict]:
        """
        Yield clone progress messages for a project until the clone finishes.

        Reads from the per-project queue registered by `start_clone_queue`.
        If no queue exists (clone not in progress or already done), yields a
        single ``{"type": "done", "success": false}`` and returns.

        Args:
            project_id (str): Project slug.

        Yields:
            dict: Progress or done message dicts.
        """
        q = self._clone_queues.get(project_id)
        if q is None:
            yield {"type": "done", "success": False, "error": "no clone in progress"}
            return
        while True:
            msg = await q.get()
            if msg is None:
                # Sentinel — clone finished, queue removed by caller
                break
            yield msg

    def workspace_path(self, project_id: str) -> pathlib.Path:
        """
        Return the expected workspace path for a project.

        Args:
            project_id (str): Project slug.

        Returns:
            pathlib.Path: Absolute workspace path.
        """
        return self._workspaces_dir / project_id

    async def clone(self, repo_url: str, project_id: str) -> AsyncIterator[str]:
        """
        Clone a git repository, yielding stdout lines as they arrive.

        Yields lines as they come from git's stdout. The final yielded
        value is either an empty string (success) or an error message.
        The caller should check the last value or use `clone_result()`.

        Args:
            repo_url (str): HTTPS or SSH git URL to clone.
            project_id (str): Project slug (determines destination directory).

        Yields:
            str: Output lines from git clone.
        """
        dest = self.workspace_path(project_id)
        self.logger.info(f"Cloning '{repo_url}' → '{dest}'")

        proc = await asyncio.create_subprocess_exec(
            "git", "clone", "--progress", repo_url, str(dest),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        async for raw_line in proc.stdout:
            line = raw_line.decode(errors="replace").rstrip()
            yield line

        await proc.wait()

        if proc.returncode != 0:
            self.logger.error(f"git clone failed (exit {proc.returncode}) for '{repo_url}'")
            yield f"[ERROR] git clone exited with code {proc.returncode}"
        else:
            self.logger.info(f"Clone completed for '{project_id}'")

    def cleanup(self, project_id: str) -> None:
        """
        Remove the workspace directory for a project (cleanup on clone failure).

        Args:
            project_id (str): Project slug.
        """
        dest = self.workspace_path(project_id)
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=True)
            self.logger.info(f"Cleaned up workspace for '{project_id}'")
```

- [ ] **Step 4: Update libs/git_manager/__init__.py**

```python
from .git_manager import GitManager

__all__ = ["GitManager"]
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
uv run pytest tests/test_git_manager.py -v
```
Expected: 3 tests PASSED

- [ ] **Step 6: Commit**

```bash
git add src/dev_center_app/libs/git_manager/ src/dev_center_app/tests/test_git_manager.py
git commit -m "feat(dev-center): GitManager — async git clone with progress streaming"
```

---

## Task 6: AuthChecker

**Files:**
- Create: `src/dev_center_app/libs/auth_checker/auth_checker.py`
- Create: `src/dev_center_app/libs/auth_checker/__init__.py`
- Create: `src/dev_center_app/tests/test_auth_checker.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_auth_checker.py
import json
import pathlib
import pytest
from libs.auth_checker.auth_checker import AuthChecker


@pytest.fixture
def claude_dir(tmp_path):
    d = tmp_path / ".claude"
    d.mkdir()
    return d


def test_not_authenticated_when_dir_empty(claude_dir):
    checker = AuthChecker(claude_dir=claude_dir)
    assert checker.is_authenticated() is False
    assert checker.get_email() is None


def test_authenticated_when_credentials_present(claude_dir):
    creds = {
        "claudeAiOauth": {
            "accessToken": "tok_123",
            "expiresAt": 9999999999000,   # far future ms timestamp
            "emailAddress": "dev@example.com",
        }
    }
    (claude_dir / ".credentials.json").write_text(json.dumps(creds))
    checker = AuthChecker(claude_dir=claude_dir)
    assert checker.is_authenticated() is True
    assert checker.get_email() == "dev@example.com"


def test_not_authenticated_when_token_expired(claude_dir):
    creds = {
        "claudeAiOauth": {
            "accessToken": "tok_old",
            "expiresAt": 1000,  # already expired
            "emailAddress": "dev@example.com",
        }
    }
    (claude_dir / ".credentials.json").write_text(json.dumps(creds))
    checker = AuthChecker(claude_dir=claude_dir)
    assert checker.is_authenticated() is False


def test_authenticated_when_credentials_file_missing_but_claude_json_exists(tmp_path):
    claude_dir = tmp_path / ".claude"
    claude_dir.mkdir()
    # Some setups use ~/.claude.json instead
    (tmp_path / ".claude.json").write_text(json.dumps({"oauthToken": "tok_abc"}))
    checker = AuthChecker(claude_dir=claude_dir, claude_json_path=tmp_path / ".claude.json")
    assert checker.is_authenticated() is True
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
uv run pytest tests/test_auth_checker.py -v
```

- [ ] **Step 3: Write auth_checker.py**

```python
# ====== Code Summary ======
# AuthChecker — detects Claude CLI credentials and spawns auth flow.

from __future__ import annotations
import asyncio
import json
import pathlib
import time
from loggerplusplus import LoggerClass


class AuthChecker(LoggerClass):
    """
    Checks for valid Claude CLI credentials and manages the auth flow.

    Looks for credentials in two locations (checked in order):
    1. ~/.claude/.credentials.json — OAuth token with expiry
    2. ~/.claude.json — legacy token file

    Attributes:
        _claude_dir (pathlib.Path): Claude home directory (~/.claude).
        _claude_json_path (pathlib.Path | None): Optional path to ~/.claude.json.
        _auth_process (asyncio.subprocess.Process | None): Running `claude auth login` process.
    """

    def __init__(
        self,
        claude_dir: pathlib.Path,
        claude_json_path: pathlib.Path | None = None,
    ) -> None:
        LoggerClass.__init__(self)
        self._claude_dir = claude_dir
        self._claude_json_path = claude_json_path
        self._auth_process: asyncio.subprocess.Process | None = None

    # ──────────────────────── Private helpers ────────────────────────

    def _read_credentials(self) -> dict | None:
        """Read ~/.claude/.credentials.json if it exists."""
        creds_path = self._claude_dir / ".credentials.json"
        if not creds_path.exists():
            return None
        try:
            return json.loads(creds_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def _read_claude_json(self) -> dict | None:
        """Read ~/.claude.json if it exists."""
        path = self._claude_json_path
        if path is None:
            path = self._claude_dir.parent / ".claude.json"
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    # ──────────────────────── Public API ─────────────────────────────

    def is_authenticated(self) -> bool:
        """
        Return True if valid, non-expired Claude credentials are found.

        Returns:
            bool: True if authenticated.
        """
        # 1. Check .credentials.json (primary)
        creds = self._read_credentials()
        if creds is not None:
            oauth = creds.get("claudeAiOauth", {})
            token = oauth.get("accessToken", "")
            expires_at_ms = oauth.get("expiresAt", 0)
            # expiresAt is milliseconds since epoch
            if token and expires_at_ms > time.time() * 1000:
                return True

        # 2. Check .claude.json (legacy fallback)
        claude_json = self._read_claude_json()
        if claude_json is not None:
            if claude_json.get("oauthToken") or claude_json.get("accessToken"):
                return True

        return False

    def get_email(self) -> str | None:
        """
        Return the authenticated user's email address, if available.

        Returns:
            str | None: Email address or None.
        """
        creds = self._read_credentials()
        if creds is not None:
            return creds.get("claudeAiOauth", {}).get("emailAddress")
        return None

    async def start_login(self) -> asyncio.subprocess.Process:
        """
        Spawn `claude auth login` and return the process handle.

        The caller should stream stdout to the browser via WebSocket.

        Returns:
            asyncio.subprocess.Process: Running auth subprocess.

        Raises:
            FileNotFoundError: If the `claude` binary is not in PATH.
        """
        self.logger.info(f"Starting claude auth login")
        proc = await asyncio.create_subprocess_exec(
            "claude", "auth", "login",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        self._auth_process = proc
        return proc

    def get_active_login_process(self) -> asyncio.subprocess.Process | None:
        """
        Return the currently running login process, if any.

        Returns:
            asyncio.subprocess.Process | None: Active process or None.
        """
        if self._auth_process is not None and self._auth_process.returncode is None:
            return self._auth_process
        return None
```

- [ ] **Step 4: Update libs/auth_checker/__init__.py**

```python
from .auth_checker import AuthChecker

__all__ = ["AuthChecker"]
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
uv run pytest tests/test_auth_checker.py -v
```
Expected: 4 tests PASSED

- [ ] **Step 6: Commit**

```bash
git add src/dev_center_app/libs/auth_checker/ src/dev_center_app/tests/test_auth_checker.py
git commit -m "feat(dev-center): AuthChecker — credential detection and auth flow"
```

---

## Task 7: SchedulerService

**Files:**
- Create: `src/dev_center_app/libs/scheduler/scheduler.py`
- Create: `src/dev_center_app/libs/scheduler/__init__.py`
- Create: `src/dev_center_app/tests/test_scheduler.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_scheduler.py
import pytest
from libs.state.models import ScheduleConfig, TimeRange
from libs.scheduler.scheduler import SchedulerService


def make_schedule(start: str, end: str, days: list[str] = None, enabled: bool = True) -> ScheduleConfig:
    return ScheduleConfig(
        enabled=enabled,
        ranges=[TimeRange(start=start, end=end)],
        days=days or [],
    )


def test_in_range_simple():
    sched = make_schedule("08:00", "18:00")
    assert SchedulerService.is_in_schedule(sched, "mon", "10:00") is True
    assert SchedulerService.is_in_schedule(sched, "mon", "08:00") is True
    assert SchedulerService.is_in_schedule(sched, "mon", "07:59") is False
    assert SchedulerService.is_in_schedule(sched, "mon", "18:01") is False


def test_day_filter():
    sched = make_schedule("08:00", "18:00", days=["mon", "tue", "wed"])
    assert SchedulerService.is_in_schedule(sched, "mon", "10:00") is True
    assert SchedulerService.is_in_schedule(sched, "sat", "10:00") is False


def test_disabled_schedule():
    sched = make_schedule("08:00", "18:00", enabled=False)
    assert SchedulerService.is_in_schedule(sched, "mon", "10:00") is False


def test_midnight_end():
    # end=00:00 means midnight (end of day — 23:59 is still in range)
    sched = make_schedule("20:00", "00:00")
    assert SchedulerService.is_in_schedule(sched, "mon", "23:59") is True
    assert SchedulerService.is_in_schedule(sched, "mon", "21:00") is True
    assert SchedulerService.is_in_schedule(sched, "mon", "19:59") is False


def test_multiple_ranges():
    sched = ScheduleConfig(
        enabled=True,
        ranges=[
            TimeRange(start="08:00", end="12:00"),
            TimeRange(start="14:00", end="18:00"),
        ],
    )
    assert SchedulerService.is_in_schedule(sched, "mon", "09:00") is True
    assert SchedulerService.is_in_schedule(sched, "mon", "13:00") is False
    assert SchedulerService.is_in_schedule(sched, "mon", "15:00") is True


def test_empty_days_means_all_days():
    sched = make_schedule("08:00", "18:00", days=[])
    for day in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]:
        assert SchedulerService.is_in_schedule(sched, day, "10:00") is True
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
uv run pytest tests/test_scheduler.py -v
```

- [ ] **Step 3: Write scheduler.py**

```python
# ====== Code Summary ======
# SchedulerService — evaluates time-range schedules and starts/stops sessions.

from __future__ import annotations
import asyncio
import datetime
from typing import TYPE_CHECKING
from loggerplusplus import LoggerClass
from libs.state.models import ScheduleConfig, GlobalConfig
from libs.state.state_manager import StateManager

if TYPE_CHECKING:
    from libs.session_manager.session_manager import SessionManager


class SchedulerService(LoggerClass):
    """
    Evaluates per-project and global schedules every 60 seconds.

    On range entry: starts session if idle.
    On range exit: stops session if running.

    Schedule priority:
    - Use project.schedule if project.schedule.enabled = True
    - Else use GlobalConfig.schedule if enabled
    - Else do nothing for that project

    Attributes:
        _state_manager (StateManager): Reads project and global config.
        _session_manager (SessionManager): Starts and stops sessions.
    """

    def __init__(
        self,
        state_manager: StateManager,
        session_manager: "SessionManager",
    ) -> None:
        LoggerClass.__init__(self)
        self._state_manager = state_manager
        self._session_manager = session_manager

    # ──────────────────────── Static helpers ─────────────────────────

    @staticmethod
    def is_in_schedule(schedule: ScheduleConfig, day: str, time_str: str) -> bool:
        """
        Return True if the given day+time falls within a schedule's active windows.

        Args:
            schedule (ScheduleConfig): The schedule to evaluate.
            day (str): Three-letter day abbreviation e.g. "mon".
            time_str (str): Current time as "HH:MM".

        Returns:
            bool: True if currently in an active window.
        """
        # 1. Disabled schedule is never active
        if not schedule.enabled:
            return False

        # 2. Day filter — empty days list means all days
        if schedule.days and day not in schedule.days:
            return False

        # 3. Parse current time
        h, m = map(int, time_str.split(":"))
        current_minutes = h * 60 + m

        # 4. Check each range
        for r in schedule.ranges:
            start_h, start_m = map(int, r.start.split(":"))
            end_h, end_m = map(int, r.end.split(":"))
            start_minutes = start_h * 60 + start_m
            end_minutes = end_h * 60 + end_m

            # end=00:00 means end of day (midnight = 24*60 = 1440)
            if end_minutes == 0:
                end_minutes = 24 * 60

            if start_minutes <= current_minutes < end_minutes:
                return True

        return False

    # ──────────────────────── Scheduler loop ─────────────────────────

    async def _tick(self) -> None:
        """
        Evaluate all projects against their schedule and start/stop sessions.
        Called every 60 seconds by the scheduler loop.
        """
        now = datetime.datetime.now()
        day = now.strftime("%a").lower()[:3]  # "mon", "tue", etc.
        time_str = now.strftime("%H:%M")

        global_config: GlobalConfig = self._state_manager.load_global_config()
        state = self._state_manager.load_projects()

        for project_id, project in state.projects.items():
            # 1. Determine effective schedule
            if project.schedule.enabled:
                effective = project.schedule
            elif global_config.schedule.enabled:
                effective = global_config.schedule
            else:
                continue  # No schedule configured — skip this project

            # 2. Evaluate
            should_be_active = self.is_in_schedule(effective, day, time_str)
            is_active = project.session is not None

            # 3. Act
            if should_be_active and not is_active:
                self.logger.info(f"Schedule: starting session for '{project_id}'")
                await self._session_manager.start_session(project_id)
            elif not should_be_active and is_active:
                self.logger.info(f"Schedule: stopping session for '{project_id}'")
                await self._session_manager.stop_session(project_id)

    async def _loop(self) -> None:
        """Run _tick every 60 seconds indefinitely."""
        while True:
            await asyncio.sleep(60)
            await self._tick()

    async def start(self) -> asyncio.Task:
        """
        Start the scheduler background task.

        Returns:
            asyncio.Task: The running scheduler task.
        """
        self.logger.info(f"Starting scheduler")
        return asyncio.create_task(self._loop())
```

- [ ] **Step 4: Update libs/scheduler/__init__.py**

```python
from .scheduler import SchedulerService

__all__ = ["SchedulerService"]
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
uv run pytest tests/test_scheduler.py -v
```
Expected: 6 tests PASSED

- [ ] **Step 6: Commit**

```bash
git add src/dev_center_app/libs/scheduler/ src/dev_center_app/tests/test_scheduler.py
git commit -m "feat(dev-center): SchedulerService — time-range session scheduling"
```

---

## Task 8: Backend skeleton (error_handling, CONTEXT, app, lifespan, health)

**Files:**
- Create: `src/dev_center_app/backend/libs/utils/error_handling.py`
- Create: `src/dev_center_app/backend/context.py`
- Create: `src/dev_center_app/backend/app.py`
- Create: `src/dev_center_app/backend/lifespan.py`
- Create: `src/dev_center_app/backend/__init__.py`
- Create: `src/dev_center_app/backend/routers/health/router.py`
- Create: `src/dev_center_app/backend/routers/health/models.py`
- Create: `src/dev_center_app/backend/routers/health/__init__.py`
- Create: `src/dev_center_app/entrypoint.py`

- [ ] **Step 1: Write error_handling.py**

```python
# ====== Code Summary ======
# @auto_handle_errors decorator — uniform 500 handling for all routes.

import functools
import inspect
import traceback
from fastapi import HTTPException
from backend.context import CONTEXT


def _build_error_detail(func_name: str, exc: Exception, tb: str) -> dict:
    """Build 500 detail — full traceback in debug mode, generic otherwise."""
    if getattr(getattr(CONTEXT, "RUNTIME_CONFIG", None), "FASTAPI_DEBUG_MODE", False):
        return {"error": str(exc), "traceback": tb, "function": func_name}
    return {"error": "Internal server error."}


def auto_handle_errors(func):
    """
    Decorator for automatic exception handling on route functions.

    Re-raises HTTPExceptions unchanged. Wraps all other exceptions
    in HTTP 500 with a logged traceback.

    Args:
        func (Callable): Route function to wrap.

    Returns:
        Callable: Wrapped function.
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
            raise HTTPException(status_code=500, detail=_build_error_detail(func.__name__, exc, tb))

    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as exc:
            tb = traceback.format_exc()
            CONTEXT.logger.error(f"[{func.__name__}] {exc}\n{tb}")
            raise HTTPException(status_code=500, detail=_build_error_detail(func.__name__, exc, tb))

    return async_wrapper if inspect.iscoroutinefunction(func) else sync_wrapper
```

- [ ] **Step 2: Write context.py**

```python
# ====== Code Summary ======
# CONTEXT — typed service locator shared across all routes and services.

from __future__ import annotations
from typing import Type, TYPE_CHECKING

from loggerplusplus import LoggerPlusPlus

if TYPE_CHECKING:
    from config import RUNTIME_CONFIG as _RC
    from libs.state.state_manager import StateManager
    from libs.event_bus.event_bus import EventBus
    from libs.session_manager.session_manager import SessionManager
    from libs.git_manager.git_manager import GitManager
    from libs.auth_checker.auth_checker import AuthChecker
    from libs.scheduler.scheduler import SchedulerService


class CONTEXT:
    """
    Shared application context — typed service locator.
    All values assigned at startup in entrypoint.py.
    """
    logger: LoggerPlusPlus
    RUNTIME_CONFIG: Type["_RC"]
    auth_ok: bool

    state_manager: "StateManager"
    event_bus: "EventBus"
    session_manager: "SessionManager"
    git_manager: "GitManager"
    auth_checker: "AuthChecker"
    scheduler: "SchedulerService"

    # Background task handles (set in lifespan)
    watchdog_task: object
    scheduler_task: object
```

- [ ] **Step 3: Write backend/routers/health/models.py and router.py**

`models.py`:
```python
from libs.state.models import _CamelModel


class HealthResponse(_CamelModel):
    status: str
```

`router.py`:
```python
# ====== Code Summary ======
# Health check route.

from fastapi import APIRouter
from backend.libs.utils.error_handling import auto_handle_errors
from .models import HealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
@auto_handle_errors
async def health() -> HealthResponse:
    """Simple health check."""
    return HealthResponse(status="ok")
```

`__init__.py`:
```python
from .router import router as health_router

__all__ = ["health_router"]
```

- [ ] **Step 4: Write app.py**

```python
# ====== Code Summary ======
# FastAPI factory — assembles all routers.

from fastapi import FastAPI
from .lifespan import lifespan
from .routers import health_router


def create_app(app_name: str, debug: bool) -> FastAPI:
    """
    Create and configure the FastAPI app.

    Args:
        app_name (str): Application title.
        debug (bool): Enable debug mode.

    Returns:
        FastAPI: Configured application.
    """
    app = FastAPI(title=app_name, version="1.0.0", lifespan=lifespan(), debug=debug)
    prefix = "/api/v1"
    app.include_router(health_router, prefix=prefix)
    return app


__all__ = ["create_app"]
```

(Remaining routers will be added in Tasks 9–15.)

- [ ] **Step 5: Write lifespan.py**

```python
# ====== Code Summary ======
# Lifespan — startup/shutdown orchestration for dev-center-app.

import asyncio
import unicodedata
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator
from pyfiglet import Figlet  # add to pyproject.toml if not present
from backend.context import CONTEXT

TOTAL_STEPS = 5


def log_step(step: int, msg: str) -> None:
    CONTEXT.logger.info(f"\n[{step}/{TOTAL_STEPS}] {msg}...")


def lifespan() -> Any:
    """Return FastAPI lifespan context manager."""

    @asynccontextmanager
    async def _lifespan(app: Any) -> AsyncIterator[None]:
        _ = app
        try:
            # 1. Banner
            banner = "\n" + Figlet(font="slant").renderText("Dev Center")
            CONTEXT.logger.info(banner)

            # 2. Config
            log_step(1, "Runtime configuration")
            CONTEXT.logger.info(CONTEXT.RUNTIME_CONFIG)

            # 3. Auth check
            log_step(2, "Claude auth check")
            CONTEXT.auth_ok = CONTEXT.auth_checker.is_authenticated()
            email = CONTEXT.auth_checker.get_email()
            if CONTEXT.auth_ok:
                CONTEXT.logger.info(f"Claude authenticated as {email}")
            else:
                CONTEXT.logger.warning(f"Claude credentials not found — auth required")

            # 4. Watchdog
            log_step(3, "Session watchdog")
            CONTEXT.watchdog_task = await CONTEXT.session_manager.start_watchdog(
                CONTEXT.RUNTIME_CONFIG.RENEW_THRESHOLD_MINUTES
            )

            # 5. Scheduler
            log_step(4, "Scheduler")
            CONTEXT.scheduler_task = await CONTEXT.scheduler.start()

            log_step(5, "Ready")
            yield

        finally:
            CONTEXT.logger.info(f"Shutting down...")
            if hasattr(CONTEXT, "watchdog_task") and CONTEXT.watchdog_task:
                CONTEXT.watchdog_task.cancel()
            if hasattr(CONTEXT, "scheduler_task") and CONTEXT.scheduler_task:
                CONTEXT.scheduler_task.cancel()

    return _lifespan
```

Note: add `pyfiglet` to pyproject.toml dependencies: `"pyfiglet>=1.0"`.

- [ ] **Step 6: Write backend/__init__.py**

```python
from .app import create_app
from .context import CONTEXT

__all__ = ["create_app", "CONTEXT"]
```

- [ ] **Step 7: Write entrypoint.py**

```python
# ====== Code Summary ======
# Application entry point — wires all services into CONTEXT and creates the FastAPI app.

import pathlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loggerplusplus import loggerplusplus

from config import RUNTIME_CONFIG                                # MUST be first
from backend import CONTEXT, create_app
from libs.state.state_manager import StateManager
from libs.event_bus.event_bus import EventBus
from libs.session_manager.session_manager import SessionManager
from libs.git_manager.git_manager import GitManager
from libs.auth_checker.auth_checker import AuthChecker
from libs.scheduler.scheduler import SchedulerService


def _build_app() -> FastAPI:
    """Wire services, inject CONTEXT, and create the FastAPI application."""
    # 1. Logger
    CONTEXT.logger = loggerplusplus.bind(identifier="DEV-CENTER")
    CONTEXT.RUNTIME_CONFIG = RUNTIME_CONFIG

    # 2. Core services
    CONTEXT.state_manager = StateManager(data_dir=RUNTIME_CONFIG.DATA_DIR)
    CONTEXT.event_bus = EventBus()
    CONTEXT.session_manager = SessionManager(
        state_manager=CONTEXT.state_manager,
        workspaces_dir=RUNTIME_CONFIG.WORKSPACES_DIR,
        claude_dir=RUNTIME_CONFIG.CLAUDE_DIR,
        event_bus=CONTEXT.event_bus,
        default_ttl_hours=RUNTIME_CONFIG.DEFAULT_TTL_HOURS,
        renew_threshold_minutes=RUNTIME_CONFIG.RENEW_THRESHOLD_MINUTES,
    )
    CONTEXT.git_manager = GitManager(workspaces_dir=RUNTIME_CONFIG.WORKSPACES_DIR)
    CONTEXT.auth_checker = AuthChecker(
        claude_dir=RUNTIME_CONFIG.CLAUDE_DIR,
        claude_json_path=RUNTIME_CONFIG.CLAUDE_DIR.parent / ".claude.json",
    )
    CONTEXT.scheduler = SchedulerService(
        state_manager=CONTEXT.state_manager,
        session_manager=CONTEXT.session_manager,
    )

    # 3. FastAPI app
    fastapi_app = create_app(
        app_name=RUNTIME_CONFIG.FASTAPI_APP_NAME,
        debug=RUNTIME_CONFIG.FASTAPI_DEBUG_MODE,
    )

    # 4. CORS
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=RUNTIME_CONFIG.CORS_ALLOWED_ORIGINS.split(","),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 5. Frontend static files (served after build; skip if dist not present)
    dist = RUNTIME_CONFIG.PATH_ROOT_DIR / "frontend" / "dist"
    if dist.exists():
        fastapi_app.mount("/", StaticFiles(directory=str(dist), html=True), name="static")

    return fastapi_app


app: FastAPI = _build_app()

__all__ = ["app"]
```

- [ ] **Step 8: Add pyfiglet to pyproject.toml, then sync**

```bash
cd src/dev_center_app
uv add pyfiglet
uv sync
```

- [ ] **Step 9: Verify app starts**

```bash
cd src/dev_center_app
DATA_DIR=/tmp/dc-test WORKSPACES_DIR=/tmp/dc-ws CLAUDE_DIR=$HOME/.claude \
  uv run uvicorn entrypoint:app --host 0.0.0.0 --port 8000 --log-level warning
```
Expected: Server starts, logs show banner + step messages. Hit `Ctrl+C` to stop.

- [ ] **Step 10: Commit**

```bash
git add src/dev_center_app/backend/ src/dev_center_app/entrypoint.py src/dev_center_app/pyproject.toml
git commit -m "feat(dev-center): backend skeleton — CONTEXT, lifespan, health router, entrypoint"
```

---

## Task 9: Projects router

**Files:**
- Create: `src/dev_center_app/backend/routers/projects/models.py`
- Create: `src/dev_center_app/backend/routers/projects/router.py`
- Create: `src/dev_center_app/backend/routers/projects/__init__.py`
- Modify: `src/dev_center_app/backend/app.py` (add router)
- Modify: `src/dev_center_app/backend/routers/__init__.py`
- Create: `src/dev_center_app/tests/test_projects_router.py`

- [ ] **Step 1: Write models.py**

```python
# ====== Code Summary ======
# Pydantic models for the /projects router.

from libs.state.models import _CamelModel, Project, ScheduleConfig


class ProjectResponse(_CamelModel):
    """Single project response including computed status."""
    id: str
    name: str
    repo_url: str
    workspace_path: str
    provider: str
    model: str
    schedule: ScheduleConfig
    session: object | None   # SessionState | None
    status: str              # "cloning" | "ready" | "active"


class ProjectListResponse(_CamelModel):
    projects: list[ProjectResponse]


class CreateProjectRequest(_CamelModel):
    repo_url: str
    provider: str = "anthropic"
    model: str = "claude-sonnet-4-6"


class UpdateProjectRequest(_CamelModel):
    provider: str | None = None
    model: str | None = None
    schedule: ScheduleConfig | None = None
    auto_renew: bool | None = None  # updates session.auto_renew if session is active
```

- [ ] **Step 2: Write router.py**

```python
# ====== Code Summary ======
# /projects router — CRUD for dev projects.

import asyncio
from fastapi import APIRouter, HTTPException
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import Project, derive_project_id
from .models import (
    ProjectResponse, ProjectListResponse,
    CreateProjectRequest, UpdateProjectRequest,
)

router = APIRouter()

# Track in-progress clones in memory (project_id → True)
_cloning: set[str] = set()


def _to_response(p: Project, project_id: str = None) -> ProjectResponse:
    """Build ProjectResponse with computed status field."""
    pid = project_id or p.id
    if pid in _cloning:
        status = "cloning"
    elif p.session is not None:
        status = "active"
    else:
        status = "ready"
    return ProjectResponse(
        id=p.id, name=p.name, repo_url=p.repo_url, workspace_path=p.workspace_path,
        provider=p.provider, model=p.model, schedule=p.schedule,
        session=p.session, status=status,
    )


@router.get("/projects", response_model=ProjectListResponse)
@auto_handle_errors
async def list_projects() -> ProjectListResponse:
    """List all registered projects."""
    state = CONTEXT.state_manager.load_projects()
    return ProjectListResponse(projects=[_to_response(p) for p in state.projects.values()])


@router.get("/projects/{project_id}", response_model=ProjectResponse)
@auto_handle_errors
async def get_project(project_id: str) -> ProjectResponse:
    """Fetch a single project by ID."""
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    return _to_response(p)


@router.post("/projects", response_model=ProjectResponse, status_code=202)
@auto_handle_errors
async def create_project(body: CreateProjectRequest) -> ProjectResponse:
    """
    Register a new project and trigger git clone in the background.

    Returns 202 immediately. Connect to WS /projects/{id}/clone/stream for progress.
    """
    # 1. Derive and deduplicate project ID
    base_id = derive_project_id(body.repo_url)
    project_id = CONTEXT.state_manager.unique_project_id(base_id)
    workspace = str(CONTEXT.git_manager.workspace_path(project_id))

    # 2. Create project entry
    global_cfg = CONTEXT.state_manager.load_global_config()
    project = Project(
        id=project_id,
        name=project_id,
        repo_url=body.repo_url,
        workspace_path=workspace,
        provider=body.provider or global_cfg.defaults.default_provider,
        model=body.model or global_cfg.defaults.default_model,
    )
    CONTEXT.state_manager.upsert_project(project)
    _cloning.add(project_id)

    # 3. Register a clone progress queue so the WebSocket endpoint can stream it
    clone_queue = CONTEXT.git_manager.start_clone_queue(project_id)

    # 4. Launch clone in background
    async def _clone_bg() -> None:
        success = True
        error_msg = ""
        async for line in CONTEXT.git_manager.clone(body.repo_url, project_id):
            # Forward every progress line to the queue for WS consumers
            await clone_queue.put({"type": "progress", "line": line})
            if line.startswith("[ERROR]"):
                success = False
                error_msg = line
        # Push the final done message before signalling end-of-stream
        await clone_queue.put(
            {"type": "done", "success": success} if success
            else {"type": "done", "success": False, "error": error_msg}
        )
        # Sentinel: tell tail_clone() the stream is over
        await clone_queue.put(None)
        CONTEXT.git_manager._clone_queues.pop(project_id, None)

        if not success:
            CONTEXT.git_manager.cleanup(project_id)
            CONTEXT.state_manager.delete_project(project_id)
        _cloning.discard(project_id)
        await CONTEXT.event_bus.publish(
            "clone.done",
            {"success": success, "error": error_msg},
            project_id=project_id,
        )

    asyncio.create_task(_clone_bg())
    return _to_response(project)


@router.put("/projects/{project_id}", response_model=ProjectResponse)
@auto_handle_errors
async def update_project(project_id: str, body: UpdateProjectRequest) -> ProjectResponse:
    """Update project model, provider, or schedule."""
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    if body.model is not None:
        p.model = body.model
    if body.provider is not None:
        p.provider = body.provider
    if body.schedule is not None:
        p.schedule = body.schedule
    if body.auto_renew is not None and p.session is not None:
        p.session.auto_renew = body.auto_renew
    CONTEXT.state_manager.upsert_project(p)
    return _to_response(p)


@router.delete("/projects/{project_id}", status_code=204)
@auto_handle_errors
async def delete_project(project_id: str) -> None:
    """Stop session if active, remove project from state."""
    await CONTEXT.session_manager.stop_session(project_id)
    CONTEXT.state_manager.delete_project(project_id)
```

- [ ] **Step 3: Write tests/test_projects_router.py**

```python
# tests/test_projects_router.py
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock, MagicMock
from backend import create_app, CONTEXT
from libs.state.state_manager import StateManager
from libs.event_bus.event_bus import EventBus
from tests.conftest import setup_context


@pytest.fixture
async def client(tmp_data, tmp_path):
    setup_context(tmp_data, tmp_path)
    app = create_app(app_name="test", debug=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_list_projects_empty(client):
    resp = await client.get("/api/v1/projects")
    assert resp.status_code == 200
    assert resp.json()["projects"] == []


@pytest.mark.asyncio
async def test_create_project_returns_202(client):
    # Mock git clone to avoid real network call
    async def fake_clone(*args):
        yield "Cloning..."
    with patch.object(CONTEXT.git_manager, "clone", return_value=fake_clone("url", "repo")):
        resp = await client.post("/api/v1/projects", json={
            "repoUrl": "https://github.com/user/patrimonium",
        })
    assert resp.status_code == 202
    data = resp.json()
    assert data["id"] == "patrimonium"
    assert data["status"] in ("cloning", "ready")


@pytest.mark.asyncio
async def test_get_project(client):
    async def fake_clone(*args):
        yield "done"
    with patch.object(CONTEXT.git_manager, "clone", return_value=fake_clone("u", "p")):
        await client.post("/api/v1/projects", json={"repoUrl": "https://github.com/user/myrepo"})
    resp = await client.get("/api/v1/projects/myrepo")
    assert resp.status_code == 200
    assert resp.json()["id"] == "myrepo"


@pytest.mark.asyncio
async def test_get_project_not_found(client):
    resp = await client.get("/api/v1/projects/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_project(client):
    CONTEXT.state_manager.upsert_project(__import__("libs.state.models", fromlist=["Project"]).Project(
        id="to-delete", name="to-delete",
        repo_url="https://github.com/u/r",
        workspace_path="/w/to-delete",
    ))
    resp = await client.delete("/api/v1/projects/to-delete")
    assert resp.status_code == 204
    assert CONTEXT.state_manager.get_project("to-delete") is None
```

- [ ] **Step 4: Update backend/routers/__init__.py**

```python
from .health import health_router
from .projects import projects_router

__all__ = ["health_router", "projects_router"]
```

Update `backend/routers/projects/__init__.py`:
```python
from .router import router as projects_router

__all__ = ["projects_router"]
```

- [ ] **Step 5: Update backend/app.py** to add `projects_router`

```python
from .routers import health_router, projects_router
# ...
app.include_router(projects_router, prefix=prefix)
```

- [ ] **Step 6: Run tests**

```bash
uv run pytest tests/test_projects_router.py -v
```
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/dev_center_app/backend/routers/projects/ src/dev_center_app/tests/test_projects_router.py
git commit -m "feat(dev-center): projects router — CRUD + background git clone"
```

---

## Task 10: Sessions router + WebSocket logs

**Files:**
- Create: `src/dev_center_app/backend/routers/sessions/models.py`
- Create: `src/dev_center_app/backend/routers/sessions/router.py`
- Create: `src/dev_center_app/backend/routers/sessions/__init__.py`
- Create: `src/dev_center_app/tests/test_sessions_router.py`

- [ ] **Step 1: Write models.py**

```python
from libs.state.models import _CamelModel, SessionState


class SessionResponse(_CamelModel):
    project_id: str
    session: SessionState
```

- [ ] **Step 2: Write router.py**

```python
# ====== Code Summary ======
# /projects/{id}/session routes — start/stop/renew + WebSocket log stream.

import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import SessionResponse

router = APIRouter()


@router.post("/projects/{project_id}/session/start", response_model=SessionResponse)
@auto_handle_errors
async def start_session(project_id: str) -> SessionResponse:
    """Start a claude remote-control session for the project."""
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    if p.session is not None:
        raise HTTPException(status_code=422, detail=f"Session already active for '{project_id}'")
    try:
        await CONTEXT.session_manager.start_session(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    p = CONTEXT.state_manager.get_project(project_id)
    return SessionResponse(project_id=project_id, session=p.session)


@router.post("/projects/{project_id}/session/stop", status_code=204)
@auto_handle_errors
async def stop_session(project_id: str) -> None:
    """Stop the active session for a project."""
    await CONTEXT.session_manager.stop_session(project_id)


@router.post("/projects/{project_id}/session/renew", response_model=SessionResponse)
@auto_handle_errors
async def renew_session(project_id: str) -> SessionResponse:
    """Renew the session (stop + restart with --continue)."""
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    await CONTEXT.session_manager.renew_session(project_id)
    p = CONTEXT.state_manager.get_project(project_id)
    return SessionResponse(project_id=project_id, session=p.session)


@router.websocket("/projects/{project_id}/session/logs")
async def session_logs(websocket: WebSocket, project_id: str) -> None:
    """
    WebSocket endpoint streaming live stdout from the session subprocess.

    Sends { "line": "..." } messages until client disconnects.
    Sends { "line": "(no active session)" } and closes if no session running.
    """
    await websocket.accept()
    try:
        async for line in CONTEXT.session_manager.tail_logs(project_id):
            await websocket.send_json({"line": line})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@router.websocket("/projects/{project_id}/clone/stream")
async def clone_stream(websocket: WebSocket, project_id: str) -> None:
    """
    WebSocket endpoint streaming git clone progress for a project.

    Sends { "type": "progress", "line": "..." } lines during clone.
    Sends { "type": "done", "success": true } on success.
    Sends { "type": "done", "success": false, "error": "..." } on failure.
    Closes immediately with { "type": "done", "success": false } if no clone in progress.
    """
    await websocket.accept()
    try:
        async for msg in CONTEXT.git_manager.tail_clone(project_id):
            await websocket.send_json(msg)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
```

- [ ] **Step 3: Write tests/test_sessions_router.py**

```python
# tests/test_sessions_router.py
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient, ASGITransport
from tests.conftest import setup_context
from libs.state.models import Project
from backend import create_app, CONTEXT


@pytest.fixture
async def client(tmp_data, tmp_path):
    setup_context(tmp_data, tmp_path)
    CONTEXT.state_manager.upsert_project(Project(
        id="myproj", name="myproj",
        repo_url="https://github.com/u/myproj",
        workspace_path="/workspaces/myproj",
    ))
    app = create_app(app_name="test", debug=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_start_session(client):
    mock_proc = MagicMock()
    mock_proc.pid = 999
    mock_proc.stdout = AsyncMock()
    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        resp = await client.post("/api/v1/projects/myproj/session/start")
    assert resp.status_code == 200
    assert resp.json()["session"]["pid"] == 999


@pytest.mark.asyncio
async def test_start_session_already_active(client):
    mock_proc = MagicMock()
    mock_proc.pid = 1
    mock_proc.stdout = AsyncMock()
    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        await client.post("/api/v1/projects/myproj/session/start")
    resp = await client.post("/api/v1/projects/myproj/session/start")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_stop_session(client):
    mock_proc = MagicMock()
    mock_proc.pid = 2
    mock_proc.stdout = AsyncMock()
    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        await client.post("/api/v1/projects/myproj/session/start")
    with patch("os.kill"):
        resp = await client.post("/api/v1/projects/myproj/session/stop")
    assert resp.status_code == 204
    p = CONTEXT.state_manager.get_project("myproj")
    assert p.session is None
```

- [ ] **Step 4: Register router in app.py and routers/__init__.py** (same pattern as projects)

- [ ] **Step 5: Run tests**

```bash
uv run pytest tests/test_sessions_router.py -v
```
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/dev_center_app/backend/routers/sessions/ src/dev_center_app/tests/test_sessions_router.py
git commit -m "feat(dev-center): sessions router — start/stop/renew + WebSocket logs"
```

---

## Task 11: Memory router

**Files:**
- Create: `src/dev_center_app/backend/routers/memory/models.py`
- Create: `src/dev_center_app/backend/routers/memory/router.py`
- Create: `src/dev_center_app/backend/routers/memory/__init__.py`

No separate test — covered by manual smoke test (memory discovery requires real Claude session).

- [ ] **Step 1: Write models.py**

```python
from libs.state.models import _CamelModel


class MemoryFile(_CamelModel):
    name: str
    content: str
    updated_at: str  # ISO-8601


class MemoryResponse(_CamelModel):
    files: list[MemoryFile]
    hash_discovered: bool
```

- [ ] **Step 2: Write router.py**

```python
# ====== Code Summary ======
# /memory router — reads Claude auto-memory files for a project.

import datetime
import pathlib
from fastapi import APIRouter, HTTPException
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import MemoryFile, MemoryResponse

router = APIRouter()

DISCOVERY_WINDOW_SECONDS = 10


def _discover_hash(claude_dir: pathlib.Path) -> str | None:
    """
    Scan ~/.claude/projects/ for recently-modified dirs containing memory/.

    Returns:
        str | None: Directory name (hash) or None if not found.
    """
    projects_dir = claude_dir / "projects"
    if not projects_dir.exists():
        return None
    now = datetime.datetime.now().timestamp()
    candidates = []
    for d in projects_dir.iterdir():
        if not d.is_dir():
            continue
        memory_dir = d / "memory"
        if not memory_dir.exists():
            continue
        mtime = d.stat().st_mtime
        age = now - mtime
        # Only consider dirs modified within the last 10 seconds
        if age <= DISCOVERY_WINDOW_SECONDS:
            candidates.append((age, d.name))
    if not candidates:
        return None
    # Return the most recently modified candidate within the window
    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]


def _read_memory_files(claude_dir: pathlib.Path, hash_value: str) -> list[MemoryFile]:
    """Read all .md files from the memory directory."""
    memory_dir = claude_dir / "projects" / hash_value / "memory"
    if not memory_dir.exists():
        return []
    files = []
    for f in sorted(memory_dir.glob("*.md")):
        mtime = datetime.datetime.fromtimestamp(f.stat().st_mtime, tz=datetime.UTC)
        files.append(MemoryFile(
            name=f.name,
            content=f.read_text(encoding="utf-8", errors="replace"),
            updated_at=mtime.isoformat(),
        ))
    return files


@router.get("/projects/{project_id}/memory", response_model=MemoryResponse)
@auto_handle_errors
async def get_memory(project_id: str) -> MemoryResponse:
    """
    Return all Claude auto-memory files for a project.

    Retries hash discovery on each call if hash not yet found.
    """
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    claude_dir = CONTEXT.RUNTIME_CONFIG.CLAUDE_DIR
    hash_value = p.session.claude_project_hash if p.session else ""

    # 1. Retry discovery if hash not yet known
    if not hash_value:
        discovered = _discover_hash(claude_dir)
        if discovered:
            hash_value = discovered
            CONTEXT.session_manager.update_hash(project_id, hash_value)

    if not hash_value:
        return MemoryResponse(files=[], hash_discovered=False)

    # 2. Read memory files
    files = _read_memory_files(claude_dir, hash_value)
    return MemoryResponse(files=files, hash_discovered=True)
```

- [ ] **Step 3: Register router** (same pattern as previous routers)

- [ ] **Step 4: Commit**

```bash
git add src/dev_center_app/backend/routers/memory/
git commit -m "feat(dev-center): memory router — Claude auto-memory file reader"
```

---

## Task 12: Rules router

**Files:**
- Create: `src/dev_center_app/backend/routers/rules/models.py`
- Create: `src/dev_center_app/backend/routers/rules/router.py`
- Create: `src/dev_center_app/backend/routers/rules/__init__.py`
- Create: `src/dev_center_app/tests/test_rules_router.py`

- [ ] **Step 1: Write models.py**

```python
from libs.state.models import _CamelModel


class RulesResponse(_CamelModel):
    content: str
    global_rules_out_of_sync: bool = False


class UpdateRulesRequest(_CamelModel):
    content: str
```

- [ ] **Step 2: Write router.py**

```python
# ====== Code Summary ======
# /rules router — CLAUDE.md read/write + global rules sync.

import pathlib
from fastapi import APIRouter, HTTPException
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import GLOBAL_RULES_START, GLOBAL_RULES_END
from .models import RulesResponse, UpdateRulesRequest

router = APIRouter()


def _claude_md_path(workspace: str) -> pathlib.Path:
    return pathlib.Path(workspace) / "CLAUDE.md"


def _extract_global_block(content: str) -> str:
    """Extract text between global-rules markers, or empty string."""
    start_idx = content.find(GLOBAL_RULES_START)
    end_idx = content.find(GLOBAL_RULES_END)
    if start_idx == -1 or end_idx == -1:
        return ""
    block_start = start_idx + len(GLOBAL_RULES_START)
    return content[block_start:end_idx].strip()


def _inject_global_block(content: str, global_rules: str) -> str:
    """Replace the global-rules block with updated content."""
    new_block = f"{GLOBAL_RULES_START}\n{global_rules}\n{GLOBAL_RULES_END}"
    start_idx = content.find(GLOBAL_RULES_START)
    end_idx = content.find(GLOBAL_RULES_END)
    if start_idx == -1:
        # No block yet — prepend
        return new_block + "\n\n" + content
    return content[:start_idx] + new_block + content[end_idx + len(GLOBAL_RULES_END):]


def _is_out_of_sync(content: str, global_rules: str) -> bool:
    extracted = _extract_global_block(content)
    return extracted.strip() != global_rules.strip()


@router.get("/projects/{project_id}/rules", response_model=RulesResponse)
@auto_handle_errors
async def get_rules(project_id: str) -> RulesResponse:
    """Read CLAUDE.md for a project and check global rules sync status."""
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    claude_md = _claude_md_path(p.workspace_path)
    if not claude_md.exists():
        raise HTTPException(status_code=404, detail="workspace not ready")
    content = claude_md.read_text(encoding="utf-8")
    global_rules = CONTEXT.state_manager.load_global_rules()
    return RulesResponse(content=content, global_rules_out_of_sync=_is_out_of_sync(content, global_rules))


@router.put("/projects/{project_id}/rules", response_model=RulesResponse)
@auto_handle_errors
async def update_rules(project_id: str, body: UpdateRulesRequest) -> RulesResponse:
    """Save CLAUDE.md content for a project."""
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    claude_md = _claude_md_path(p.workspace_path)
    claude_md.parent.mkdir(parents=True, exist_ok=True)
    claude_md.write_text(body.content, encoding="utf-8")
    global_rules = CONTEXT.state_manager.load_global_rules()
    return RulesResponse(content=body.content, global_rules_out_of_sync=_is_out_of_sync(body.content, global_rules))


@router.post("/projects/{project_id}/rules/sync", response_model=RulesResponse)
@auto_handle_errors
async def sync_rules(project_id: str) -> RulesResponse:
    """Re-inject the current global rules block into CLAUDE.md."""
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    claude_md = _claude_md_path(p.workspace_path)
    existing = claude_md.read_text(encoding="utf-8") if claude_md.exists() else ""
    global_rules = CONTEXT.state_manager.load_global_rules()
    updated = _inject_global_block(existing, global_rules)
    claude_md.parent.mkdir(parents=True, exist_ok=True)
    claude_md.write_text(updated, encoding="utf-8")
    return RulesResponse(content=updated, global_rules_out_of_sync=False)
```

- [ ] **Step 3: Write tests/test_rules_router.py**

```python
# tests/test_rules_router.py
import pathlib
import pytest
from httpx import AsyncClient, ASGITransport
from tests.conftest import setup_context
from libs.state.models import Project
from backend import create_app, CONTEXT


@pytest.fixture
async def client_with_project(tmp_data, tmp_path):
    setup_context(tmp_data, tmp_path)
    ws = tmp_path / "workspaces" / "myproj"
    ws.mkdir(parents=True)
    (ws / "CLAUDE.md").write_text("# My rules\n- Use type hints\n")
    CONTEXT.state_manager.upsert_project(Project(
        id="myproj", name="myproj",
        repo_url="https://github.com/u/r",
        workspace_path=str(ws),
    ))
    app = create_app(app_name="test", debug=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_get_rules(client_with_project):
    resp = await client_with_project.get("/api/v1/projects/myproj/rules")
    assert resp.status_code == 200
    assert "# My rules" in resp.json()["content"]


@pytest.mark.asyncio
async def test_update_rules(client_with_project):
    resp = await client_with_project.put("/api/v1/projects/myproj/rules", json={"content": "# Updated"})
    assert resp.status_code == 200
    assert resp.json()["content"] == "# Updated"


@pytest.mark.asyncio
async def test_sync_rules(client_with_project, tmp_data):
    CONTEXT.state_manager.save_global_rules("- Always use uv\n")
    resp = await client_with_project.post("/api/v1/projects/myproj/rules/sync")
    assert resp.status_code == 200
    assert "dev-center: global-rules-start" in resp.json()["content"]
    assert "Always use uv" in resp.json()["content"]
    assert resp.json()["globalRulesOutOfSync"] is False


@pytest.mark.asyncio
async def test_out_of_sync_detection(client_with_project, tmp_data):
    CONTEXT.state_manager.save_global_rules("- New global rule\n")
    resp = await client_with_project.get("/api/v1/projects/myproj/rules")
    # CLAUDE.md has no global block → out of sync
    assert resp.json()["globalRulesOutOfSync"] is True
```

- [ ] **Step 4: Register router + run tests**

```bash
uv run pytest tests/test_rules_router.py -v
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/dev_center_app/backend/routers/rules/ src/dev_center_app/tests/test_rules_router.py
git commit -m "feat(dev-center): rules router — CLAUDE.md read/write + global sync"
```

---

## Task 13: Auth router + WebSocket

**Files:**
- Create: `src/dev_center_app/backend/routers/auth/models.py`
- Create: `src/dev_center_app/backend/routers/auth/router.py`
- Create: `src/dev_center_app/backend/routers/auth/__init__.py`

- [ ] **Step 1: Write models.py**

```python
from libs.state.models import _CamelModel


class AuthStatusResponse(_CamelModel):
    authenticated: bool
    email: str | None = None
```

- [ ] **Step 2: Write router.py**

```python
# ====== Code Summary ======
# /auth router — Claude CLI credential status + OAuth flow streaming.

import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import AuthStatusResponse

router = APIRouter()
AUTH_TIMEOUT_SECONDS = 300  # 5 minutes


@router.get("/auth/status", response_model=AuthStatusResponse)
@auto_handle_errors
async def auth_status() -> AuthStatusResponse:
    """Return Claude CLI authentication status."""
    authenticated = CONTEXT.auth_checker.is_authenticated()
    email = CONTEXT.auth_checker.get_email() if authenticated else None
    # Update CONTEXT flag
    CONTEXT.auth_ok = authenticated
    return AuthStatusResponse(authenticated=authenticated, email=email)


@router.post("/auth/login", status_code=200)
@auto_handle_errors
async def start_login() -> dict:
    """Spawn `claude auth login`. Connect to WS /auth/login/stream for output."""
    try:
        await CONTEXT.auth_checker.start_login()
    except FileNotFoundError:
        raise HTTPException(status_code=422, detail="claude CLI not found in PATH")
    return {"status": "started"}


@router.websocket("/auth/login/stream")
async def login_stream(websocket: WebSocket) -> None:
    """
    Stream output from the running `claude auth login` subprocess.

    Sends { "line": "..." } per output line.
    Closes with { "done": true, "success": bool } on completion.
    Closes immediately with success=false if no process is running.
    Times out after 5 minutes.
    """
    await websocket.accept()
    try:
        proc = CONTEXT.auth_checker.get_active_login_process()
        if proc is None or proc.stdout is None:
            await websocket.send_json({"done": True, "success": False})
            return

        async def _stream() -> bool:
            async for raw in proc.stdout:
                line = raw.decode(errors="replace").rstrip()
                await websocket.send_json({"line": line})
            await proc.wait()
            return proc.returncode == 0

        success = await asyncio.wait_for(_stream(), timeout=AUTH_TIMEOUT_SECONDS)
        CONTEXT.auth_ok = CONTEXT.auth_checker.is_authenticated()
        await websocket.send_json({"done": True, "success": success})

    except asyncio.TimeoutError:
        await websocket.send_json({"done": True, "success": False})
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
```

- [ ] **Step 3: Register router + commit**

```bash
git add src/dev_center_app/backend/routers/auth/
git commit -m "feat(dev-center): auth router — status + WebSocket OAuth flow"
```

---

## Task 14: Monitoring router + WebSocket events

**Files:**
- Create: `src/dev_center_app/backend/routers/monitoring/models.py`
- Create: `src/dev_center_app/backend/routers/monitoring/router.py`
- Create: `src/dev_center_app/backend/routers/monitoring/__init__.py`

- [ ] **Step 1: Write models.py**

```python
from libs.state.models import _CamelModel, SessionState


class ProjectMonitorRow(_CamelModel):
    project_id: str
    status: str
    session: SessionState | None
    workspace_path: str


class MonitoringResponse(_CamelModel):
    projects: list[ProjectMonitorRow]
```

- [ ] **Step 2: Write router.py**

```python
# ====== Code Summary ======
# /monitoring router — global session status + real-time event feed.

import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import MonitoringResponse, ProjectMonitorRow

router = APIRouter()


@router.get("/monitoring", response_model=MonitoringResponse)
@auto_handle_errors
async def get_monitoring() -> MonitoringResponse:
    """Return current status of all projects."""
    state = CONTEXT.state_manager.load_projects()
    rows = [
        ProjectMonitorRow(
            project_id=p.id,
            status="active" if p.session else "idle",
            session=p.session,
            workspace_path=p.workspace_path,
        )
        for p in state.projects.values()
    ]
    return MonitoringResponse(projects=rows)


@router.websocket("/monitoring/events")
async def monitoring_events(websocket: WebSocket) -> None:
    """
    WebSocket feed of all session lifecycle events.

    Sends { "type": event_name, "project_id": str, "data": {} } messages.
    """
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue()

    # Subscribe to all relevant events
    event_types = [
        "session.started", "session.stopped",
        "session.expired", "session.renewed", "clone.done",
    ]

    async def enqueue(event_type: str, data: dict) -> None:
        await queue.put({"type": event_type, **data})

    for et in event_types:
        CONTEXT.event_bus.subscribe(et, enqueue)

    try:
        while True:
            event = await asyncio.wait_for(queue.get(), timeout=30)
            await websocket.send_json(event)
    except asyncio.TimeoutError:
        # Send keepalive ping and continue waiting
        try:
            await websocket.send_json({"type": "ping"})
            continue
        except Exception:
            break
    except WebSocketDisconnect:
        pass
    finally:
        for et in event_types:
            CONTEXT.event_bus.unsubscribe(et, enqueue)
        try:
            await websocket.close()
        except Exception:
            pass
```

- [ ] **Step 3: Register router + commit**

```bash
git add src/dev_center_app/backend/routers/monitoring/
git commit -m "feat(dev-center): monitoring router — global status + WebSocket events"
```

---

## Task 15: Settings router

**Files:**
- Create: `src/dev_center_app/backend/routers/settings/models.py`
- Create: `src/dev_center_app/backend/routers/settings/router.py`
- Create: `src/dev_center_app/backend/routers/settings/__init__.py`
- Create: `src/dev_center_app/tests/test_settings_router.py`

- [ ] **Step 1: Write models.py**

```python
from libs.state.models import _CamelModel, GlobalDefaults, ScheduleConfig


class GlobalConfigResponse(_CamelModel):
    defaults: GlobalDefaults
    schedule: ScheduleConfig


class UpdateGlobalConfigRequest(_CamelModel):
    defaults: GlobalDefaults | None = None
    schedule: ScheduleConfig | None = None


class GlobalRulesResponse(_CamelModel):
    content: str
    out_of_sync_projects: int = 0


class UpdateGlobalRulesRequest(_CamelModel):
    content: str
```

- [ ] **Step 2: Write router.py**

```python
# ====== Code Summary ======
# /settings router — global config + global rules CRUD.

import pathlib
from fastapi import APIRouter
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import GLOBAL_RULES_START, GLOBAL_RULES_END
from .models import (
    GlobalConfigResponse, UpdateGlobalConfigRequest,
    GlobalRulesResponse, UpdateGlobalRulesRequest,
)

router = APIRouter()


def _count_out_of_sync(global_rules: str) -> int:
    """Count projects whose CLAUDE.md global block differs from global_rules."""
    state = CONTEXT.state_manager.load_projects()
    count = 0
    for project in state.projects.values():
        claude_md = pathlib.Path(project.workspace_path) / "CLAUDE.md"
        if not claude_md.exists():
            continue
        content = claude_md.read_text(encoding="utf-8")
        start_idx = content.find(GLOBAL_RULES_START)
        end_idx = content.find(GLOBAL_RULES_END)
        if start_idx == -1:
            count += 1
            continue
        block = content[start_idx + len(GLOBAL_RULES_START):end_idx].strip()
        if block != global_rules.strip():
            count += 1
    return count


@router.get("/settings", response_model=GlobalConfigResponse)
@auto_handle_errors
async def get_settings() -> GlobalConfigResponse:
    cfg = CONTEXT.state_manager.load_global_config()
    return GlobalConfigResponse(defaults=cfg.defaults, schedule=cfg.schedule)


@router.put("/settings", response_model=GlobalConfigResponse)
@auto_handle_errors
async def update_settings(body: UpdateGlobalConfigRequest) -> GlobalConfigResponse:
    cfg = CONTEXT.state_manager.load_global_config()
    if body.defaults is not None:
        cfg.defaults = body.defaults
    if body.schedule is not None:
        cfg.schedule = body.schedule
    CONTEXT.state_manager.save_global_config(cfg)
    return GlobalConfigResponse(defaults=cfg.defaults, schedule=cfg.schedule)


@router.get("/settings/rules", response_model=GlobalRulesResponse)
@auto_handle_errors
async def get_global_rules() -> GlobalRulesResponse:
    content = CONTEXT.state_manager.load_global_rules()
    return GlobalRulesResponse(content=content, out_of_sync_projects=_count_out_of_sync(content))


@router.put("/settings/rules", response_model=GlobalRulesResponse)
@auto_handle_errors
async def update_global_rules(body: UpdateGlobalRulesRequest) -> GlobalRulesResponse:
    CONTEXT.state_manager.save_global_rules(body.content)
    return GlobalRulesResponse(content=body.content, out_of_sync_projects=_count_out_of_sync(body.content))
```

- [ ] **Step 3: Write tests/test_settings_router.py**

```python
# tests/test_settings_router.py
import pytest
from httpx import AsyncClient, ASGITransport
from tests.conftest import setup_context
from backend import create_app, CONTEXT


@pytest.fixture
async def client(tmp_data, tmp_path):
    setup_context(tmp_data, tmp_path)
    app = create_app(app_name="test", debug=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_get_settings_defaults(client):
    resp = await client.get("/api/v1/settings")
    assert resp.status_code == 200
    assert resp.json()["defaults"]["defaultModel"] == "claude-sonnet-4-6"


@pytest.mark.asyncio
async def test_update_settings(client):
    resp = await client.put("/api/v1/settings", json={
        "defaults": {"defaultModel": "claude-opus-4-6", "defaultProvider": "anthropic",
                     "defaultTtlHours": 12, "renewThresholdMinutes": 20}
    })
    assert resp.status_code == 200
    assert resp.json()["defaults"]["defaultModel"] == "claude-opus-4-6"


@pytest.mark.asyncio
async def test_global_rules_roundtrip(client):
    await client.put("/api/v1/settings/rules", json={"content": "# My global rules\n"})
    resp = await client.get("/api/v1/settings/rules")
    assert "My global rules" in resp.json()["content"]
```

- [ ] **Step 4: Register router + run all tests**

```bash
uv run pytest tests/ -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/dev_center_app/backend/routers/settings/ src/dev_center_app/tests/test_settings_router.py
git commit -m "feat(dev-center): settings router — global config + rules CRUD"
```

---

## Task 16: Docker + Compose

**Files:**
- Create: `src/dev_center_app/Dockerfile`
- Create: `src/dev_center_app/entrypoint.sh`
- Rewrite: `docker-compose.yml`
- Rewrite: `docker-compose.dev.yml`
- Create: `services/dev-center-app/.env` (copy from .env.example + fill values)

- [ ] **Step 1: Write Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.7

###############################################################################
# Build note:
# Built from the repository root with the src/ directory as context.
# Example:
#   docker build -f src/dev_center_app/Dockerfile -t dev-center-app:latest src
###############################################################################

###############################################################################
# Stage 1: Python dependency builder
# Goal: install locked production deps into /opt/venv using uv
###############################################################################
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS py-build

WORKDIR /workspace

# UV_PROJECT_ENVIRONMENT tells uv where to create the venv
ENV UV_PROJECT_ENVIRONMENT=/opt/venv

# Copy lock metadata first to maximise layer cache reuse
COPY dev_center_app/pyproject.toml dev_center_app/uv.lock /workspace/dev_center_app/

# Install locked production dependencies only
# --frozen: fail if lock is out of sync
# --no-dev: skip test dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --project /workspace/dev_center_app

###############################################################################
# Stage 2: Frontend builder
# Goal: build the React+Vite production bundle into frontend/dist
###############################################################################
FROM node:22-bookworm-slim AS ui-build

WORKDIR /workspace/dev_center_app/frontend

# Copy package descriptors first to enable npm cache layer
COPY dev_center_app/frontend/package.json dev_center_app/frontend/package-lock.json ./

# Reproducible install from lock file
RUN npm ci

# Copy frontend source and compile production bundle
COPY dev_center_app/frontend/ ./
RUN npm run build

###############################################################################
# Stage 3: Runtime image
# Goal: minimal image with Python + built frontend, no build tools
###############################################################################
FROM python:3.12-slim-bookworm AS runtime

# Runtime Python best practices
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}"

# Install git (required for git clone operations at runtime)
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy prebuilt Python venv from builder stage
COPY --from=py-build /opt/venv /opt/venv

# Copy backend application source
COPY dev_center_app /app/dev_center_app

# Copy compiled React bundle so FastAPI can serve it as static files
COPY --from=ui-build /workspace/dev_center_app/frontend/dist /app/dev_center_app/frontend/dist

EXPOSE 8000

# Start FastAPI via uvicorn, targeting the app object in entrypoint.py
CMD ["uvicorn", "dev_center_app.entrypoint:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Write docker-compose.yml**

```yaml
# dev-center — Production Docker Compose
#
# Setup:
#   cp services/dev-center-app/.env.example services/dev-center-app/.env
#   cp services/vscode/.env.example services/vscode/.env
#   docker compose --env-file services/common/.env up -d --build
#
# The --env-file flag loads services/common/.env for variable interpolation.

services:
  dev-center-app:
    # FastAPI backend + React dashboard + session manager
    build:
      context: src
      dockerfile: dev_center_app/Dockerfile
    image: dev-center-app:latest
    restart: unless-stopped
    ports:
      - "${DEV_CENTER_PORT:-8000}:8000"
    env_file:
      - services/dev-center-app/.env
    volumes:
      # Project workspace storage — shared with code-server
      - ${DATA_ROOT}/workspaces:/workspaces
      # Persistent state (projects.json, global-config.json, global-rules.md)
      - ${DATA_ROOT}/data:/data
      # Claude CLI credentials — read-write so token refreshes persist to host
      - ~/.claude:/home/app/.claude
      - ~/.claude.json:/home/app/.claude.json
      # SSH key for git clone via SSH (optional)
      - ${SSH_KEY_PATH:-~/.ssh}:/home/app/.ssh:ro
    environment:
      - DATA_DIR=/data
      - WORKSPACES_DIR=/workspaces
      - CLAUDE_DIR=/home/app/.claude
    networks:
      - dev-center-net

  code-server:
    # VS Code in the browser — file browsing of project workspaces
    image: codercom/code-server:latest
    restart: unless-stopped
    ports:
      - "${CODE_SERVER_PORT:-8443}:8080"
    env_file:
      - services/vscode/.env
    volumes:
      - ${DATA_ROOT}/workspaces:/workspaces
    networks:
      - dev-center-net
    entrypoint: ["/bin/sh", "-c"]
    command: ['if [ -n "$$PASSWORD" ]; then exec code-server --auth password /workspaces; else exec code-server --auth none /workspaces; fi']

networks:
  dev-center-net:
    driver: bridge
```

- [ ] **Step 3: Write docker-compose.dev.yml**

```yaml
# Development overrides — use with:
#   docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

services:
  dev-center-app:
    volumes:
      # Mount source code for hot reload — overlays the Docker build copy
      - ./src/dev_center_app:/app/dev_center_app
    environment:
      - DEV_MODE=true
      - FASTAPI_DEBUG_MODE=true
    command: >
      uvicorn dev_center_app.entrypoint:app
      --host 0.0.0.0
      --port 8000
      --reload
      --reload-dir /app/dev_center_app
```

- [ ] **Step 4: Create services/common/.env.example**

```bash
# Shared Docker Compose variables
DATA_ROOT=/opt/dev-center
DEV_CENTER_PORT=8000
CODE_SERVER_PORT=8443
SSH_KEY_PATH=~/.ssh
```

- [ ] **Step 5: Create services/vscode/.env.example**

```bash
# VS Code Server environment
# PASSWORD=changeme   ← uncomment to enable password auth; leave blank for no-auth
```

Create the working copy:
```bash
mkdir -p services/vscode
cp services/vscode/.env.example services/vscode/.env
```

- [ ] **Step 6: Create working env files**

```bash
cp services/dev-center-app/.env.example services/dev-center-app/.env
# Edit services/common/.env: set DATA_ROOT to a local path, e.g. /tmp/dev-center-data
cp services/common/.env.example services/common/.env
```

- [ ] **Step 7: Verify Docker build**

```bash
docker compose build dev-center-app
```
Expected: build completes without errors.

- [ ] **Step 8: Run full test suite one last time**

```bash
cd src/dev_center_app
uv run pytest tests/ -v
```
Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/dev_center_app/ docker-compose.yml docker-compose.dev.yml services/
git commit -m "feat(dev-center): Dockerfile + Docker Compose — dev-center-app + code-server"
```

---

## Final verification

- [ ] Start the stack locally:

```bash
cp services/common/.env.example services/common/.env
# Edit services/common/.env: set DATA_ROOT to a local path e.g. /tmp/dev-center-data
mkdir -p /tmp/dev-center-data/{workspaces,data}
docker compose --env-file services/common/.env up --build
```

- [ ] Verify health endpoint:

```bash
curl http://localhost:8000/api/v1/health
```
Expected: `{"status":"ok"}`

- [ ] Verify projects list:

```bash
curl http://localhost:8000/api/v1/projects
```
Expected: `{"projects":[]}`

- [ ] Verify auth status:

```bash
curl http://localhost:8000/api/v1/auth/status
```
Expected: `{"authenticated":true,"email":"..."}` (if `~/.claude` is populated on host)

- [ ] Commit any fixes, then mark backend plan complete.

```bash
git commit -m "feat(dev-center): backend implementation complete — all routes, tests passing"
```
