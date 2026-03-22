# Project Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate Telegram model endpoint, an asyncio EventBus with WebSocket monitoring, and refactor TelegramTab + CodeSessionTab to cleanly separate Telegram and Code Session concerns.

**Architecture:** Nine tasks in sequence: backend first (OpenClawConfigWriter, new endpoint, EventBus, service wiring, WebSocket), then frontend (API layer, TelegramTab, CodeSessionTab, EventFeed). Each task is independently testable. Frontend tasks depend on the API layer task completing first.

**Tech Stack:** FastAPI, Python 3.12, asyncio, pytest + pytest-asyncio, React 18, TypeScript, native WebSocket API, Vite

---

## File Map

### New files
| Path | Purpose |
|---|---|
| `src/idh-app/libs/event_bus/__init__.py` | Package export |
| `src/idh-app/libs/event_bus/event_bus.py` | EventBus asyncio pub/sub |
| `src/idh-app/tests/test_event_bus.py` | EventBus unit tests |
| `src/idh-app/tests/test_settings_telegram_model.py` | Telegram-model endpoint tests |
| `src/idh-app/tests/test_monitoring_ws.py` | WebSocket endpoint tests |
| `src/idh-app/frontend/src/components/EventFeed.tsx` | Real-time event feed component |
| `src/idh-app/frontend/src/components/CodingRulesEditor.tsx` | File upload + CLAUDE.md textarea editor |

### Modified files
| Path | What changes |
|---|---|
| `src/idh-app/libs/openclaw_config/config_writer.py` | Add `get_agent_model` + `update_agent_model` |
| `src/idh-app/tests/test_openclaw_config_writer.py` | Add 4 new tests |
| `src/idh-app/backend/routers/settings/models.py` | Add `TelegramModelResponse`, `TelegramModelRequest` |
| `src/idh-app/backend/routers/settings/router.py` | Add two `telegram-model` routes |
| `src/idh-app/backend/context.py` | Add `event_bus: EventBus` annotation |
| `src/idh-app/entrypoint.py` | Instantiate EventBus, pass to services |
| `src/idh-app/libs/bridge/bridge_manager.py` | Accept `event_bus`, emit session events |
| `src/idh-app/libs/memory/codex_summarizer.py` | Accept `event_bus`, emit summarizer events |
| `src/idh-app/libs/memory/memory_manager.py` | Accept `event_bus`, emit `memory.updated` events |
| `src/idh-app/libs/scheduler/scheduler.py` | Accept `event_bus`, emit scheduler events |
| `src/idh-app/backend/routers/monitoring/router.py` | Add `WS /monitoring/ws` endpoint |
| `src/idh-app/frontend/src/api/types.ts` | Add `TelegramModelResponse` type |
| `src/idh-app/frontend/src/api/settings.ts` | Add `getTelegramModel`, `putTelegramModel` |
| `src/idh-app/frontend/src/api/monitoring.ts` | Add `createMonitoringSocket` |
| `src/idh-app/frontend/src/pages/Project/tabs/TelegramTab.tsx` | Replace model calls, remove SESSION_MEMORY, add GroupInfoCard |
| `src/idh-app/frontend/src/pages/Project/tabs/CodeSessionTab.tsx` | Full rewrite — flat layout, no sub-tabs |
| `src/idh-app/frontend/src/pages/Monitoring/MonitoringPage.tsx` | Add EventFeed at bottom |

### Deleted files (sub-tabs replaced by flat CodeSessionTab)
- `src/idh-app/frontend/src/pages/Project/tabs/code-session/BridgeSubTab.tsx`
- `src/idh-app/frontend/src/pages/Project/tabs/code-session/FilesSubTab.tsx`
- `src/idh-app/frontend/src/pages/Project/tabs/code-session/TranscriptSubTab.tsx`
- `src/idh-app/frontend/src/pages/Project/tabs/code-session/ScheduleSubTab.tsx`

---

## Task 1: OpenClawConfigWriter — Telegram model methods

**Files:**
- Modify: `src/idh-app/libs/openclaw_config/config_writer.py`
- Modify: `src/idh-app/tests/test_openclaw_config_writer.py`

Background: `OpenClawConfigWriter` manages `openclaw.json`, which holds per-agent config under `agents.<agent_id>`. Currently each agent only has `system_prompt`. We're adding `model: {provider, model}` as a sibling key. The two new methods follow the same filelock + read-modify-write pattern as `update_agent_system_prompt`.

- [ ] **Step 1: Add 4 failing tests to `test_openclaw_config_writer.py`**

Append to the end of the existing file (after line 105):

```python
def test_update_agent_model_persists(
    writer: OpenClawConfigWriter, openclaw_path: pathlib.Path
) -> None:
    """update_agent_model writes provider and model into openclaw.json."""
    writer.update_agent_model("agent-1", "anthropic", "claude-sonnet-4-6")

    raw = json.loads(openclaw_path.read_text())
    assert raw["agents"]["agent-1"]["model"]["provider"] == "anthropic"
    assert raw["agents"]["agent-1"]["model"]["model"] == "claude-sonnet-4-6"


def test_update_agent_model_preserves_system_prompt(
    writer: OpenClawConfigWriter, openclaw_path: pathlib.Path
) -> None:
    """update_agent_model does not overwrite the agent's system_prompt."""
    writer.update_agent_system_prompt("agent-1", "Be helpful.")
    writer.update_agent_model("agent-1", "anthropic", "claude-opus-4-6")

    raw = json.loads(openclaw_path.read_text())
    assert raw["agents"]["agent-1"]["system_prompt"] == "Be helpful."
    assert raw["agents"]["agent-1"]["model"]["provider"] == "anthropic"


def test_get_agent_model_returns_empty_strings_when_unset(
    writer: OpenClawConfigWriter,
) -> None:
    """get_agent_model returns ('', '') for unknown agent."""
    provider, model = writer.get_agent_model("nonexistent")
    assert provider == ""
    assert model == ""


def test_get_agent_model_returns_set_values(
    writer: OpenClawConfigWriter,
) -> None:
    """get_agent_model returns the values written by update_agent_model."""
    writer.update_agent_model("agent-1", "anthropic", "claude-haiku-4-5")
    provider, model = writer.get_agent_model("agent-1")
    assert provider == "anthropic"
    assert model == "claude-haiku-4-5"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src/idh-app && uv run pytest tests/test_openclaw_config_writer.py -v
```

Expected: 4 new tests fail with `AttributeError: 'OpenClawConfigWriter' object has no attribute 'update_agent_model'`

- [ ] **Step 3: Add the two methods to `config_writer.py`**

Append after `get_agent_system_prompt` (after line 145, before the end of the class):

```python
    def get_agent_model(self, agent_id: str) -> tuple[str, str]:
        """
        Read the provider and model for an agent from openclaw.json.

        Args:
            agent_id (str): OpenClaw agent identifier.

        Returns:
            tuple[str, str]: ``(provider, model)`` — both empty strings if unset.
        """
        # 1. Load config and extract model fields (empty strings if key absent)
        config = self._read()
        agent_model = config.get("agents", {}).get(agent_id, {}).get("model", {})
        return agent_model.get("provider", ""), agent_model.get("model", "")

    def update_agent_model(self, agent_id: str, provider: str, model: str) -> None:
        """
        Set the provider and model for an agent in openclaw.json.

        Args:
            agent_id (str): The agent identifier key in the ``agents`` dict.
            provider (str): AI provider slug (e.g. ``"anthropic"``).
            model (str): Model identifier (e.g. ``"claude-sonnet-4-6"``).
        """
        # 1. Load config, update model block atomically under filelock, persist
        with self._lock:
            data = self._read()
            if "agents" not in data:
                data["agents"] = {}
            if agent_id not in data["agents"]:
                data["agents"][agent_id] = {}
            data["agents"][agent_id]["model"] = {"provider": provider, "model": model}
            self._write(data)
            self.logger.info(f"Updated model for agent '{agent_id}' to {provider}/{model}")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd src/idh-app && uv run pytest tests/test_openclaw_config_writer.py -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/idh-app/libs/openclaw_config/config_writer.py src/idh-app/tests/test_openclaw_config_writer.py
git commit -m "feat: add get_agent_model and update_agent_model to OpenClawConfigWriter"
```

---

## Task 2: Settings — Telegram model endpoint

**Files:**
- Modify: `src/idh-app/backend/routers/settings/models.py`
- Modify: `src/idh-app/backend/routers/settings/router.py`
- Create: `src/idh-app/tests/test_settings_telegram_model.py`

Background: `GET/PUT /api/v1/settings/{group_id}/telegram-model` read/write `provider` + `model` in `openclaw.json` via the `OpenClawConfigWriter`. The agent_id is always `project.project_id` by convention. Routes follow the identical pattern to `get_model` / `put_model` (lines 367–414 of router.py), but target a different storage location.

- [ ] **Step 1: Create the test file**

```python
# src/idh-app/tests/test_settings_telegram_model.py
# ====== Code Summary ======
# Tests for GET/PUT /api/v1/settings/{group_id}/telegram-model.

# ====== Standard Library Imports ======
import json
import pathlib

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _seed_project(client: TestClient) -> None:
    """Register a test project so all telegram-model tests have a valid group_id."""
    import hmac, hashlib
    from config import RUNTIME_CONFIG

    payload = json.dumps({
        "project_id": "test-tg-model",
        "group_id": "-9001",
        "repo_url": "https://example.com/repo.git",
        "agent_id": "test-tg-model",
    }).encode()
    secret = RUNTIME_CONFIG.IDH_WEBHOOK_SECRET.encode()
    sig = "sha256=" + hmac.new(secret, payload, hashlib.sha256).hexdigest()
    client.post("/api/v1/settings/webhook", content=payload, headers={"X-IDH-Signature": sig})


def test_get_telegram_model_returns_empty_strings_initially(client: TestClient) -> None:
    """GET telegram-model returns empty provider/model before any update."""
    r = client.get("/api/v1/settings/-9001/telegram-model")
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == ""
    assert data["model"] == ""


def test_put_telegram_model_persists(client: TestClient) -> None:
    """PUT telegram-model stores provider and model, GET retrieves them."""
    r = client.put(
        "/api/v1/settings/-9001/telegram-model",
        json={"provider": "anthropic", "model": "claude-sonnet-4-6"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    r2 = client.get("/api/v1/settings/-9001/telegram-model")
    assert r2.json()["provider"] == "anthropic"
    assert r2.json()["model"] == "claude-sonnet-4-6"


def test_get_telegram_model_404_for_unknown_group(client: TestClient) -> None:
    """GET telegram-model returns 404 for a group_id that has no project."""
    r = client.get("/api/v1/settings/-0000/telegram-model")
    assert r.status_code == 404


def test_put_telegram_model_404_for_unknown_group(client: TestClient) -> None:
    """PUT telegram-model returns 404 for a group_id that has no project."""
    r = client.put(
        "/api/v1/settings/-0000/telegram-model",
        json={"provider": "anthropic", "model": "claude-sonnet-4-6"},
    )
    assert r.status_code == 404
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd src/idh-app && uv run pytest tests/test_settings_telegram_model.py -v
```

Expected: all 4 tests fail with 404 or 422 (routes don't exist yet)

- [ ] **Step 3: Add models to `settings/models.py`**

Append after the `ScheduleRequest` class (end of file):

```python

class TelegramModelResponse(_CamelModel):
    """
    Response model for reading a Telegram agent's model.

    Attributes:
        provider (str): AI provider slug.
        model (str): Model identifier.
    """

    provider: str
    model: str


class TelegramModelRequest(_CamelModel):
    """
    Request body for updating a Telegram agent's model.

    Attributes:
        provider (str): AI provider slug (e.g. ``"anthropic"``).
        model (str): Model identifier (e.g. ``"claude-sonnet-4-6"``).
    """

    provider: str = Field(..., description="AI provider slug.")
    model: str = Field(..., description="Model identifier.")
```

- [ ] **Step 4: Update the import line in `settings/router.py`**

The existing import of `.models` (line 17) is:
```python
from .models import ContextSizeResponse, FileContentResponse, FileWriteRequest, ModelResponse, ModelUpdateRequest, ScheduleRequest, SettingsResponse, TelegramPromptRequest, TelegramPromptResponse, WebhookPayload
```

Replace it with:
```python
from .models import ContextSizeResponse, FileContentResponse, FileWriteRequest, ModelResponse, ModelUpdateRequest, ScheduleRequest, SettingsResponse, TelegramModelRequest, TelegramModelResponse, TelegramPromptRequest, TelegramPromptResponse, WebhookPayload
```

- [ ] **Step 5: Add the two new routes to `settings/router.py`**

Append after `put_project_schedule` (end of file):

```python

@router.get("/settings/{group_id}/telegram-model", response_model=TelegramModelResponse)
@auto_handle_errors
async def get_telegram_model(group_id: str) -> TelegramModelResponse:
    """
    Read the Telegram agent model (provider + model) for a project.

    The agent_id is always equal to project.project_id by convention.

    Args:
        group_id (str): Telegram group ID.

    Returns:
        TelegramModelResponse: Current provider and model (empty strings if unset).

    Raises:
        HTTPException: 404 if the project is not found.
    """
    # 1. Look up project
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Read from openclaw.json (agent_id == project_id by convention)
    provider, model = CONTEXT.openclaw_writer.get_agent_model(project.project_id)
    return TelegramModelResponse(provider=provider, model=model)


@router.put("/settings/{group_id}/telegram-model", response_model=SettingsResponse)
@auto_handle_errors
async def put_telegram_model(group_id: str, body: TelegramModelRequest) -> SettingsResponse:
    """
    Update the Telegram agent model for a project.

    Writes provider and model into openclaw.json under agents.<project_id>.model.

    Args:
        group_id (str): Telegram group ID.
        body (TelegramModelRequest): New provider and model.

    Returns:
        SettingsResponse: Success status.

    Raises:
        HTTPException: 404 if the project is not found.
    """
    # 1. Look up project
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Write to openclaw.json (agent_id == project_id by convention)
    CONTEXT.openclaw_writer.update_agent_model(project.project_id, body.provider, body.model)
    return SettingsResponse(status="ok")
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd src/idh-app && uv run pytest tests/test_settings_telegram_model.py -v
```

Expected: all 4 tests PASS

- [ ] **Step 7: Run full test suite to confirm no regressions**

```bash
cd src/idh-app && uv run pytest -v
```

Expected: all existing tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/idh-app/backend/routers/settings/models.py src/idh-app/backend/routers/settings/router.py src/idh-app/tests/test_settings_telegram_model.py
git commit -m "feat: add GET/PUT /settings/{group_id}/telegram-model endpoint"
```

---

## Task 3: EventBus

**Files:**
- Create: `src/idh-app/libs/event_bus/__init__.py`
- Create: `src/idh-app/libs/event_bus/event_bus.py`
- Create: `src/idh-app/tests/test_event_bus.py`

Background: `EventBus` is a pure-asyncio publish/subscribe bus. It holds one `asyncio.Queue(maxsize=100)` per connected subscriber. `publish()` copies the event into every queue. `subscribe()` is an async generator that adds its queue on entry and removes it in a `finally` block — this prevents memory leaks when WebSocket clients disconnect. Tests require `pytest-asyncio` (already in the project's dev deps).

- [ ] **Step 1: Create the test file**

```python
# src/idh-app/tests/test_event_bus.py
# ====== Code Summary ======
# Unit tests for the EventBus asyncio pub/sub bus.

# ====== Standard Library Imports ======
import asyncio

# ====== Third-Party Library Imports ======
import pytest

# ====== Internal Project Imports ======
from libs.event_bus.event_bus import EventBus


@pytest.mark.asyncio
async def test_publish_delivers_event_to_subscriber() -> None:
    """A subscriber receives events published after it started listening."""
    bus = EventBus()
    received: list[dict] = []

    async def consume() -> None:
        async for event in bus.subscribe():
            received.append(event)
            break  # stop after first event

    task = asyncio.create_task(consume())
    await asyncio.sleep(0)  # yield control so the task registers its queue
    await bus.publish("test.event", {"key": "value"}, group_id="-123")
    await task

    assert len(received) == 1
    assert received[0]["type"] == "test.event"
    assert received[0]["group_id"] == "-123"
    assert received[0]["payload"] == {"key": "value"}
    assert "ts" in received[0]


@pytest.mark.asyncio
async def test_publish_delivers_to_multiple_subscribers() -> None:
    """All active subscribers receive the same event."""
    bus = EventBus()
    results: list[list[str]] = [[], []]

    async def consume(idx: int) -> None:
        async for event in bus.subscribe():
            results[idx].append(event["type"])
            break

    t1 = asyncio.create_task(consume(0))
    t2 = asyncio.create_task(consume(1))
    await asyncio.sleep(0)
    await bus.publish("broadcast", {})
    await t1
    await t2

    assert results[0] == ["broadcast"]
    assert results[1] == ["broadcast"]


@pytest.mark.asyncio
async def test_subscribe_removes_queue_on_exit() -> None:
    """subscribe() cleans up its queue from _queues when the generator exits."""
    bus = EventBus()

    async def consume_one() -> None:
        async for _ in bus.subscribe():
            break

    task = asyncio.create_task(consume_one())
    await asyncio.sleep(0)
    assert len(bus._queues) == 1
    await bus.publish("cleanup.test", {})
    await task
    assert len(bus._queues) == 0


@pytest.mark.asyncio
async def test_publish_with_no_subscribers_does_not_raise() -> None:
    """publish() is a no-op when there are no subscribers."""
    bus = EventBus()
    await bus.publish("orphan.event", {"x": 1})  # must not raise
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src/idh-app && uv run pytest tests/test_event_bus.py -v
```

Expected: `ModuleNotFoundError: No module named 'libs.event_bus'`

- [ ] **Step 3: Create `libs/event_bus/__init__.py`**

```python
# ------------------- EventBus -------------------- #
from .event_bus import EventBus

# ------------------- Public API ------------------- #
__all__ = ["EventBus"]
```

- [ ] **Step 4: Create `libs/event_bus/event_bus.py`**

```python
# ====== Code Summary ======
# EventBus — asyncio pub/sub bus for broadcasting real-time events to WebSocket clients.

# ====== Standard Library Imports ======
import asyncio
import datetime
from collections.abc import AsyncGenerator

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass


class EventBus(LoggerClass):
    """
    Asyncio pub/sub bus for broadcasting real-time events to WebSocket clients.

    Maintains one ``asyncio.Queue`` per connected subscriber. ``publish()``
    enqueues a copy of the event into every active queue. ``subscribe()`` is an
    async generator that registers its queue on entry and removes it on exit,
    preventing memory leaks when WebSocket clients disconnect.

    Attributes:
        _queues (list[asyncio.Queue]): One queue per active subscriber.
    """

    def __init__(self) -> None:
        """Initialise the EventBus with an empty subscriber list."""
        LoggerClass.__init__(self)
        self._queues: list[asyncio.Queue] = []

    # ──────────────────────────── Public API ────────────────────────────────

    async def publish(
        self,
        event_type: str,
        payload: dict,
        group_id: str | None = None,
    ) -> None:
        """
        Enqueue an event to all active subscribers.

        Silently drops the event for subscribers whose queue is full (maxsize=100)
        rather than blocking — a slow consumer should not block the publisher.

        Args:
            event_type (str): Event type string (e.g. ``"session.started"``).
            payload (dict): Event-specific data fields.
            group_id (str | None): Telegram group ID, if applicable.
        """
        # 1. Build the standard event envelope
        event: dict = {
            "type": event_type,
            "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "group_id": group_id,
            "payload": payload,
        }

        # 2. Non-blocking enqueue to all subscribers
        for q in list(self._queues):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                self.logger.warning(f"EventBus: queue full for event '{event_type}', dropping")

    async def subscribe(self) -> AsyncGenerator[dict, None]:
        """
        Async generator that yields events as they arrive.

        Registers a dedicated queue on entry and removes it in the ``finally``
        block, ensuring cleanup even when the consumer is cancelled or raises.

        Yields:
            dict: Event envelope containing ``type``, ``ts``, ``group_id``, ``payload``.
        """
        # 1. Register a per-subscriber queue (max 100 buffered events)
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._queues.append(q)
        try:
            # 2. Yield indefinitely until the generator is closed
            while True:
                event = await q.get()
                yield event
        finally:
            # 3. Remove the queue — prevents memory leak on disconnect
            self._queues.remove(q)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd src/idh-app && uv run pytest tests/test_event_bus.py -v
```

Expected: all 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/idh-app/libs/event_bus/ src/idh-app/tests/test_event_bus.py
git commit -m "feat: add EventBus asyncio pub/sub for real-time WebSocket events"
```

---

## Task 4: Wire EventBus into CONTEXT and services

**Files:**
- Modify: `src/idh-app/backend/context.py`
- Modify: `src/idh-app/entrypoint.py`
- Modify: `src/idh-app/libs/bridge/bridge_manager.py`
- Modify: `src/idh-app/libs/memory/codex_summarizer.py`
- Modify: `src/idh-app/libs/memory/memory_manager.py`
- Modify: `src/idh-app/libs/scheduler/scheduler.py`

Background: Services in `libs/` must not import `backend/context.py` (circular import). Instead, we pass `EventBus` as an optional constructor parameter to each service that should emit events. `entrypoint.py` creates the single `EventBus` instance and passes it to each service. Existing tests don't pass `event_bus`, so they get `None` and nothing breaks.

- [ ] **Step 1: Add `event_bus` annotation to `backend/context.py`**

Add the import and annotation. The current imports section ends around line 19. Add the EventBus import after the existing libs imports:

```python
from libs.event_bus.event_bus import EventBus
```

Then add to the `CONTEXT` class body (after `scheduler: SchedulerService`):

```python
    event_bus: EventBus
```

- [ ] **Step 2: Add optional `event_bus` to `BridgeManager.__init__`**

In `libs/bridge/bridge_manager.py`, add the import at the top (after existing imports):

```python
from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from libs.event_bus.event_bus import EventBus
```

Change `__init__` signature (line 37) to add the new parameter:

```python
    def __init__(
        self,
        state_manager: StateManager,
        codex_dir: pathlib.Path,
        claude_dir: pathlib.Path,
        bridge_ttl_hours: int,
        event_bus: "EventBus | None" = None,
    ) -> None:
```

Add to the body of `__init__` (after `self._processes = {}`):

```python
        self._event_bus: "EventBus | None" = event_bus
```

- [ ] **Step 3: Emit events from BridgeManager methods**

In `start_bridge`, after `self.logger.info(f"Bridge PID {proc.pid} started ...")` (line 167), add:

```python
        # 5. Emit session.started event
        if self._event_bus is not None:
            await self._event_bus.publish(
                "session.started",
                {"pid": proc.pid, "workspace": str(workspace), "expires_at": expires},
                group_id=group_id,
            )
```

In `stop_bridge`, after `self.logger.info(f"Bridge stopped for group '{group_id}'")` (line 188), add:

```python
        # 3. Emit session.stopped event
        if self._event_bus is not None:
            await self._event_bus.publish("session.stopped", {}, group_id=group_id)
```

In `_check_expired`, after `project.bridge = None` inside the loop (line 111), add:

```python
                # 3. Emit session.expired event
                if self._event_bus is not None:
                    await self._event_bus.publish(
                        "session.expired", {}, group_id=group_id
                    )
```

Note: `renew_bridge` calls `stop_bridge` then `start_bridge`, so the `session.stopped` and `session.started` events fire automatically — no additional code needed there.

- [ ] **Step 4: Add optional `event_bus` to `CodexSummarizer.__init__`**

In `libs/memory/codex_summarizer.py`, add TYPE_CHECKING import at top:

```python
from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from libs.event_bus.event_bus import EventBus
```

Change `__init__` signature:

```python
    def __init__(self, codex_dir: pathlib.Path, event_bus: "EventBus | None" = None) -> None:
```

Add to body of `__init__`:

```python
        self._event_bus: "EventBus | None" = event_bus
```

In `summarize`, after `self.logger.info(f"Running codex compress ...")` (line 50), add:

```python
        # 1b. Emit summarizer.started event
        if self._event_bus is not None:
            await self._event_bus.publish(
                "summarizer.started",
                {"workspace": str(workspace)},
            )
```

After `return stdout.decode().strip()` (change to capture first), replace the return with:

```python
        # 3b. Emit summarizer.completed and return
        result = stdout.decode().strip()
        if self._event_bus is not None:
            await self._event_bus.publish(
                "summarizer.completed",
                {"workspace": str(workspace), "output_length": len(result)},
            )
        return result
```

- [ ] **Step 5: Add optional `event_bus` to `MemoryManager.__init__` and emit `memory.updated`**

In `libs/memory/memory_manager.py`, add TYPE_CHECKING import at top:

```python
from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from libs.event_bus.event_bus import EventBus
```

Change `__init__` signature:

```python
    def __init__(
        self,
        claude_dir: pathlib.Path,
        workspaces_dir: pathlib.Path,
        event_bus: "EventBus | None" = None,
    ) -> None:
```

Add to body of `__init__` (after `self._workspaces_dir = workspaces_dir`):

```python
        self._event_bus: "EventBus | None" = event_bus
```

At the end of `write_memory` (after `self.logger.info(...)`, add:

```python
        # Emit memory.updated event for CLAUDE.md changes
        if self._event_bus is not None:
            import asyncio
            asyncio.create_task(
                self._event_bus.publish(
                    "memory.updated",
                    {"project_id": project_id, "file": "CLAUDE.md"},
                )
            )
```

At the end of `write_session_memory` (after `self.logger.info(...)`), add:

```python
        # Emit memory.updated event for SESSION_MEMORY.md changes
        if self._event_bus is not None:
            import asyncio
            asyncio.create_task(
                self._event_bus.publish(
                    "memory.updated",
                    {"project_id": project_id, "file": "SESSION_MEMORY.md"},
                )
            )
```

Note: `write_memory` and `write_session_memory` are sync methods — we use `asyncio.create_task` to fire-and-forget the async publish call without blocking. This is safe in a FastAPI async context.

- [ ] **Step 6: Add optional `event_bus` to `SchedulerService.__init__`**

In `libs/scheduler/scheduler.py`, add TYPE_CHECKING import after existing imports:

```python
from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from libs.event_bus.event_bus import EventBus
```

Change `__init__` signature (add `event_bus` at the end):

```python
    def __init__(
        self,
        state_manager: StateManager,
        bridge_manager: BridgeManager,
        global_config_manager: GlobalConfigManager,
        activity_log: ActivityLog,
        telegram_notifier: TelegramNotifier,
        workspaces_dir: pathlib.Path,
        event_bus: "EventBus | None" = None,
    ) -> None:
```

Add to body of `__init__` (after `self._warn_state = {}`):

```python
        self._event_bus: "EventBus | None" = event_bus
```

Then in the `_tick` method (which is async), find the point where a warning is sent to Telegram and add after it:

```python
                    if self._event_bus is not None:
                        await self._event_bus.publish(
                            "scheduler.warning_sent",
                            {"remaining_minutes": remaining_minutes},
                            group_id=group_id,
                        )
```

At the **end** of `_tick` (after processing expirations), emit the tick event — this way `active_projects` reflects the post-tick state:

```python
        if self._event_bus is not None:
            state = self._state_manager.load()
            await self._event_bus.publish(
                "scheduler.tick",
                {"active_projects": sum(1 for p in state.projects.values() if p.bridge is not None)},
            )
```

For the warning event, find the section in `_tick` where `self._telegram_notifier` is called to send a warning. That section computes a remaining duration (minutes). Add the emit **after** the telegram notifier call, using whatever integer variable holds the remaining minutes in that scope. If the variable is named `remaining_minutes`, use that; if it's computed inline, extract it:

```python
                    # Compute remaining minutes from bridge expires_at
                    _remaining_min = max(0, int((expires - now).total_seconds() / 60))
                    if self._event_bus is not None:
                        await self._event_bus.publish(
                            "scheduler.warning_sent",
                            {"remaining_minutes": _remaining_min},
                            group_id=group_id,
                        )
```

- [ ] **Step 7: Update `entrypoint.py` to instantiate EventBus and pass it to services**

Add the import at the top of the internal imports section:

```python
from libs.event_bus.event_bus import EventBus
```

In `_build_app()`, add `CONTEXT.event_bus = EventBus()` **before** `CONTEXT.bridge_manager = BridgeManager(...)` (i.e., at step 2, before line 49 in the current entrypoint). `EventBus` must exist before the services that reference it are constructed. Change:

```python
    CONTEXT.bridge_manager = BridgeManager(
        state_manager=CONTEXT.state_manager,
        codex_dir=RUNTIME_CONFIG.PATH_CODEX_DIR,
        claude_dir=RUNTIME_CONFIG.PATH_CLAUDE_DIR,
        bridge_ttl_hours=RUNTIME_CONFIG.BRIDGE_TTL_HOURS,
    )
```

to:

```python
    CONTEXT.bridge_manager = BridgeManager(
        state_manager=CONTEXT.state_manager,
        codex_dir=RUNTIME_CONFIG.PATH_CODEX_DIR,
        claude_dir=RUNTIME_CONFIG.PATH_CLAUDE_DIR,
        bridge_ttl_hours=RUNTIME_CONFIG.BRIDGE_TTL_HOURS,
        event_bus=CONTEXT.event_bus,
    )
```

Change `CodexSummarizer` construction:

```python
    CONTEXT.codex_summarizer = CodexSummarizer(
        codex_dir=RUNTIME_CONFIG.PATH_CODEX_DIR,
        event_bus=CONTEXT.event_bus,
    )
```

Change `SchedulerService` construction to add `event_bus=CONTEXT.event_bus` as the last keyword argument.

Also change `MemoryManager` construction:

```python
    CONTEXT.memory_manager = MemoryManager(
        claude_dir=RUNTIME_CONFIG.PATH_CLAUDE_DIR,
        workspaces_dir=RUNTIME_CONFIG.PATH_WORKSPACES,
        event_bus=CONTEXT.event_bus,
    )
```

Note: `CONTEXT.event_bus` must be assigned BEFORE the services that use it. Move the `EventBus()` instantiation line to just before `BridgeManager` is constructed (step 2 of `_build_app`, before line 46).

- [ ] **Step 8: Run full test suite**

```bash
cd src/idh-app && uv run pytest -v
```

Expected: all tests PASS (services receive `None` for event_bus in tests — no event emitting)

- [ ] **Step 9: Commit**

```bash
git add src/idh-app/backend/context.py src/idh-app/entrypoint.py src/idh-app/libs/bridge/bridge_manager.py src/idh-app/libs/memory/codex_summarizer.py src/idh-app/libs/memory/memory_manager.py src/idh-app/libs/scheduler/scheduler.py
git commit -m "feat: wire EventBus into CONTEXT and services for real-time event emission"
```

---

## Task 5: WebSocket monitoring endpoint

**Files:**
- Modify: `src/idh-app/backend/routers/monitoring/router.py`
- Create: `src/idh-app/tests/test_monitoring_ws.py`

Background: FastAPI WebSocket routes cannot use `@auto_handle_errors` (the decorator raises `HTTPException` after the HTTP upgrade, which has no effect on an already-upgraded connection). Instead, the handler uses a plain `try/except`. The `EventBus.subscribe()` generator's `finally` block handles queue cleanup automatically.

- [ ] **Step 1: Create the test file**

```python
# src/idh-app/tests/test_monitoring_ws.py
# ====== Code Summary ======
# Tests for the WS /api/v1/monitoring/ws WebSocket endpoint.

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient


def test_monitoring_ws_connects_and_receives_events(client: TestClient) -> None:
    """WebSocket client connects and receives JSON events published on the bus."""
    from backend.context import CONTEXT
    import asyncio

    received: list[dict] = []

    with client.websocket_connect("/api/v1/monitoring/ws") as ws:
        # Publish an event from outside the WebSocket connection
        asyncio.get_event_loop().run_until_complete(
            CONTEXT.event_bus.publish("test.ws", {"hello": "world"})
        )
        msg = ws.receive_json(timeout=2)
        received.append(msg)

    assert len(received) == 1
    assert received[0]["type"] == "test.ws"
    assert received[0]["payload"] == {"hello": "world"}


def test_monitoring_ws_accepts_connection(client: TestClient) -> None:
    """WebSocket endpoint accepts connections without error."""
    with client.websocket_connect("/api/v1/monitoring/ws") as ws:
        # Connection opened successfully — no assertion needed beyond no exception
        assert ws is not None
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd src/idh-app && uv run pytest tests/test_monitoring_ws.py -v
```

Expected: fail — WebSocket route doesn't exist yet

- [ ] **Step 3: Add the WebSocket endpoint to `monitoring/router.py`**

Add the FastAPI WebSocket import at the top of the file (update the existing fastapi import line):

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
```

Append at the end of `router.py` (after `get_activity`):

```python

@router.websocket("/monitoring/ws")
async def monitoring_ws(websocket: WebSocket) -> None:
    """
    Stream real-time events to a connected WebSocket client.

    Accepts the connection, subscribes to the EventBus, and forwards each
    event as a JSON message until the client disconnects.

    Note: This route cannot use ``@auto_handle_errors`` — HTTPException has
    no effect on an already-upgraded WebSocket connection. Errors are logged
    and the connection is closed cleanly.

    Args:
        websocket (WebSocket): The incoming WebSocket connection.
    """
    # 1. Upgrade the HTTP connection to WebSocket
    await websocket.accept()
    try:
        # 2. Subscribe to the EventBus and stream events indefinitely
        async for event in CONTEXT.event_bus.subscribe():
            await websocket.send_json(event)
    except WebSocketDisconnect:
        # Client disconnected cleanly — no error to log
        pass
    except Exception as exc:
        # 3. Log unexpected errors; subscribe() finally block cleans up the queue
        CONTEXT.logger.error(f"[monitoring_ws] unexpected error: {exc}")
    finally:
        # 4. Ensure the WebSocket is closed on any exit path
        await websocket.close()
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd src/idh-app && uv run pytest tests/test_monitoring_ws.py -v
```

Expected: PASS (or skip if TestClient WebSocket + asyncio event loop interaction is complex — see note below)

Note: If the asyncio event loop test is tricky with TestClient, the `test_monitoring_ws_accepts_connection` test is the minimum needed to confirm the endpoint exists and accepts connections.

- [ ] **Step 5: Run full test suite**

```bash
cd src/idh-app && uv run pytest -v
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/idh-app/backend/routers/monitoring/router.py src/idh-app/tests/test_monitoring_ws.py
git commit -m "feat: add WS /monitoring/ws WebSocket endpoint for real-time event streaming"
```

---

## Task 6: Frontend API layer

**Files:**
- Modify: `src/idh-app/frontend/src/api/types.ts`
- Modify: `src/idh-app/frontend/src/api/settings.ts`
- Modify: `src/idh-app/frontend/src/api/monitoring.ts`

Background: Three small additions. `TelegramModelResponse` mirrors the new backend model. `getTelegramModel` / `putTelegramModel` call the new endpoint. `createMonitoringSocket` opens a native WebSocket to the new `/api/v1/monitoring/ws` endpoint — the caller (EventFeed) owns the lifecycle.

- [ ] **Step 1: Add `TelegramModelResponse` to `types.ts`**

After the `ModelResponse` interface (around line 60), add:

```typescript
export interface TelegramModelResponse {
  provider: string;
  model: string;
}
```

- [ ] **Step 2: Add `getTelegramModel` and `putTelegramModel` to `settings.ts`**

After `putModel` (around line 60), add:

```typescript
export function getTelegramModel(groupId: string): Promise<TelegramModelResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/telegram-model`, { method: 'GET' });
}

export function putTelegramModel(groupId: string, provider: string, model: string): Promise<FileWriteResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/telegram-model`, {
    method: 'PUT',
    body: JSON.stringify({ provider, model }),
  });
}
```

Also update the import in `settings.ts` — add `TelegramModelResponse` to the types import:

```typescript
import type { FileContentResponse, FileWriteResponse, TelegramModelResponse, TelegramPromptResponse, ModelResponse, ContextSizeResponse, ScheduleConfig, GlobalDefaults } from './types';
```

- [ ] **Step 3: Add `createMonitoringSocket` to `monitoring.ts`**

Append after `getActivityLog`:

```typescript
/** Opens a WebSocket to the real-time monitoring event stream. Caller owns lifecycle. */
export function createMonitoringSocket(): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${protocol}//${window.location.host}/api/v1/monitoring/ws`);
}
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd src/idh-app/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/idh-app/frontend/src/api/types.ts src/idh-app/frontend/src/api/settings.ts src/idh-app/frontend/src/api/monitoring.ts
git commit -m "feat: add telegram model + monitoring WebSocket to frontend API layer"
```

---

## Task 7: TelegramTab refactor

**Files:**
- Modify: `src/idh-app/frontend/src/pages/Project/tabs/TelegramTab.tsx`

Background: Replace `getModel/putModel` with `getTelegramModel/putTelegramModel`. Remove the `SESSION_MEMORY.md` section entirely (it moves to CodeSessionTab). Add a small GroupInfoCard showing `project.groupId`. The layout stays two-column (3fr left, 2fr right). The right panel's Quick Commands section is unchanged.

- [ ] **Step 1: Rewrite `TelegramTab.tsx`**

Replace the entire file content with:

```typescript
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { theme } from '../../../theme';
import ModelSelector from '../../../components/ModelSelector';
import ContextSizeMeter from '../../../components/ContextSizeMeter';
import { getTelegramModel, putTelegramModel, getTelegramPrompt, putTelegramPrompt } from '../../../api/settings';
import { MODEL_OPTIONS } from '../../../api/types';
import type { Project } from '../../../api/types';

interface TelegramTabProps {
  project: Project;
}

const QUICK_COMMANDS = [
  'Show progress summary',
  'Commit and push current changes',
  'Run tests and report',
];

const STORAGE_KEY = (groupId: string) => `idh-quick-commands-${groupId}`;

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      boxShadow: theme.shadow.card,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.surfaceElevated,
      }}>
        <span style={{
          fontSize: theme.font.size.sm,
          fontFamily: theme.font.sans,
          fontWeight: theme.font.weight.semibold,
          color: theme.colors.text,
        }}>
          {title}
        </span>
        {action}
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  );
}

// ── Save button ───────────────────────────────────────────────────────────────

function SaveButton({ id, saving, onClick }: { id: string; saving: string | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving !== null}
      style={{
        padding: '4px 12px',
        background: theme.colors.accent,
        border: 'none',
        borderRadius: theme.radius.md,
        color: theme.colors.onPrimary,
        cursor: saving !== null ? 'not-allowed' : 'pointer',
        fontSize: theme.font.size.sm,
        fontFamily: theme.font.sans,
        fontWeight: theme.font.weight.medium,
        opacity: saving !== null && saving !== id ? 0.5 : 1,
        transition: theme.transition.fast,
      }}
    >
      {saving === id ? 'Saving…' : 'Save'}
    </button>
  );
}

// ── TelegramTab ───────────────────────────────────────────────────────────────

export default function TelegramTab({ project }: TelegramTabProps) {
  const [provider, setProvider] = useState(project.modelOverride?.provider ?? MODEL_OPTIONS[0].provider);
  const [model, setModel] = useState(project.modelOverride?.model ?? MODEL_OPTIONS[0].model);
  const [telegramPrompt, setTelegramPrompt] = useState('');
  const [agentId, setAgentId] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [customCommands, setCustomCommands] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY(project.groupId)) ?? '[]') as string[]; }
    catch { return []; }
  });
  const [newCommandInput, setNewCommandInput] = useState('');
  const [showAddCommand, setShowAddCommand] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getTelegramModel(project.groupId),
      getTelegramPrompt(project.groupId),
    ]).then(([m, t]) => {
      if (cancelled) return;
      if (m.provider) { setProvider(m.provider); setModel(m.model); }
      setAgentId(t.agentId);
      setTelegramPrompt(t.systemPrompt);
    }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [project.groupId]);

  const save = async (id: string, fn: () => Promise<unknown>) => {
    setSaving(id); setError(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(null); }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard?.writeText(cmd).catch(() => {});
    showToast(`Copied: "${cmd}"`);
  };

  const addCustomCommand = () => {
    if (!newCommandInput.trim()) return;
    const updated = [...customCommands, newCommandInput.trim()];
    setCustomCommands(updated);
    localStorage.setItem(STORAGE_KEY(project.groupId), JSON.stringify(updated));
    setNewCommandInput('');
    setShowAddCommand(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', alignItems: 'start' }}>
      {/* Left panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <div style={{
            padding: '8px 12px',
            background: theme.colors.dangerBg,
            border: `1px solid ${theme.colors.danger}44`,
            borderRadius: theme.radius.sm,
            color: theme.colors.danger,
            fontSize: theme.font.size.sm,
          }}>
            {error}
          </div>
        )}

        <SectionCard
          title="Telegram Model"
          action={
            <SaveButton
              id="model"
              saving={saving}
              onClick={() => save('model', () => putTelegramModel(project.groupId, provider, model))}
            />
          }
        >
          <ModelSelector provider={provider} model={model} onChange={(p, m) => { setProvider(p); setModel(m); }} />
        </SectionCard>

        <SectionCard
          title="System Prompt"
          action={
            <SaveButton
              id="prompt"
              saving={saving}
              onClick={() => save('prompt', () => putTelegramPrompt(project.groupId, agentId, telegramPrompt))}
            />
          }
        >
          <textarea
            value={telegramPrompt}
            onChange={(e) => setTelegramPrompt(e.target.value)}
            rows={8}
            style={{
              width: '100%',
              background: theme.colors.bg,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              color: theme.colors.text,
              fontFamily: theme.font.mono,
              fontSize: theme.font.size.sm,
              padding: '10px 12px',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
              lineHeight: 1.6,
            }}
          />
          <div style={{ marginTop: '6px', fontSize: theme.font.size.xs, color: theme.colors.muted, textAlign: 'right', fontFamily: theme.font.mono }}>
            {telegramPrompt.length} chars · ~{Math.round(telegramPrompt.length / 4)} tokens
          </div>
        </SectionCard>

        <ContextSizeMeter groupId={project.groupId} />
      </div>

      {/* Right panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SectionCard title="Quick Commands">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {[...QUICK_COMMANDS, ...customCommands].map((cmd, i) => (
              <button
                key={i}
                onClick={() => copyCommand(cmd)}
                style={{
                  padding: '4px 10px',
                  background: theme.colors.surfaceElevated,
                  border: `1px solid ${theme.colors.borderAccent}`,
                  borderRadius: theme.radius.full,
                  color: theme.colors.textSecondary,
                  fontSize: theme.font.size.xs,
                  fontFamily: theme.font.sans,
                  cursor: 'pointer',
                  transition: theme.transition.fast,
                }}
              >
                {cmd}
              </button>
            ))}
            <button
              onClick={() => setShowAddCommand(!showAddCommand)}
              style={{
                padding: '4px 10px',
                background: 'none',
                border: `1px dashed ${theme.colors.border}`,
                borderRadius: theme.radius.full,
                color: theme.colors.muted,
                fontSize: theme.font.size.xs,
                cursor: 'pointer',
              }}
            >
              + Add custom
            </button>
          </div>

          {showAddCommand && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={newCommandInput}
                onChange={(e) => setNewCommandInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustomCommand(); }}
                placeholder="Type a command…"
                style={{
                  flex: 1,
                  background: theme.colors.bg,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  color: theme.colors.text,
                  fontSize: theme.font.size.sm,
                  fontFamily: theme.font.mono,
                  padding: '5px 10px',
                  outline: 'none',
                }}
              />
              <button
                onClick={addCustomCommand}
                style={{
                  padding: '5px 12px',
                  background: theme.colors.accent,
                  border: 'none',
                  borderRadius: theme.radius.md,
                  color: theme.colors.onPrimary,
                  fontSize: theme.font.size.sm,
                  fontFamily: theme.font.sans,
                  cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>
          )}

          {toast && (
            <div style={{ marginTop: '8px', fontSize: theme.font.size.xs, color: theme.colors.success, fontFamily: theme.font.sans }}>
              {toast}
            </div>
          )}
        </SectionCard>

        {/* Group Info */}
        <SectionCard title="Group Info">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.sans, marginBottom: '2px' }}>
                Group ID
              </div>
              <div style={{ fontSize: theme.font.size.sm, fontFamily: theme.font.mono, color: theme.colors.text }}>
                {project.groupId}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd src/idh-app/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/idh-app/frontend/src/pages/Project/tabs/TelegramTab.tsx
git commit -m "feat: refactor TelegramTab — separate telegram model, remove session memory, add group info"
```

---

## Task 8: CodeSessionTab refactor (flat layout)

**Files:**
- Create: `src/idh-app/frontend/src/components/CodingRulesEditor.tsx`
- Modify: `src/idh-app/frontend/src/pages/Project/tabs/CodeSessionTab.tsx`
- Delete: `src/idh-app/frontend/src/pages/Project/tabs/code-session/BridgeSubTab.tsx`
- Delete: `src/idh-app/frontend/src/pages/Project/tabs/code-session/FilesSubTab.tsx`
- Delete: `src/idh-app/frontend/src/pages/Project/tabs/code-session/TranscriptSubTab.tsx`
- Delete: `src/idh-app/frontend/src/pages/Project/tabs/code-session/ScheduleSubTab.tsx`

Background: The current `CodeSessionTab` is a shell with 4 sub-tabs. We're replacing it with a flat two-column layout. Left column: model selector, CLAUDE.md editor (with multi-file upload via `CodingRulesEditor`), SESSION_MEMORY.md read-only viewer. Right column: session status (state, PID, expiry countdown, start/stop), schedule editor. The `ScheduleEditor` component at `src/components/ScheduleEditor.tsx` already exists. The `CountdownTimer` component at `src/components/CountdownTimer.tsx` already exists. `getClaudeMd`/`putClaudeMd` in `settings.ts` use `groupId`. `getSessionMemory` in `memory.ts` uses `projectId`.

- [ ] **Step 1: Create `CodingRulesEditor.tsx`**

Create `src/idh-app/frontend/src/components/CodingRulesEditor.tsx`:

```typescript
import { useRef } from 'react';
import { theme } from '../theme';

interface CodingRulesEditorProps {
  value: string;
  onChange: (content: string) => void;
}

export default function CodingRulesEditor({ value, onChange }: CodingRulesEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sort files alphabetically, read with FileReader, concat with separators
  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).sort((a, b) => a.name.localeCompare(b.name));
    if (files.length === 0) return;
    const readers = files.map(
      (f) =>
        new Promise<{ name: string; content: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: f.name, content: reader.result as string });
          reader.onerror = reject;
          reader.readAsText(f);
        })
    );
    Promise.all(readers).then((results) => {
      const concatenated = results.map((r) => `# ${r.name}\n\n${r.content}`).join('\n\n---\n\n');
      onChange(concatenated);
    });
    // Reset so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <div style={{ marginBottom: '8px' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '4px 10px',
            background: theme.colors.surfaceElevated,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            fontSize: theme.font.size.xs,
            fontFamily: theme.font.sans,
          }}
        >
          Upload .md files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,.txt"
          onChange={handleFilesUpload}
          style={{ display: 'none' }}
        />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        style={{
          width: '100%',
          background: theme.colors.bg,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          color: theme.colors.text,
          fontFamily: theme.font.mono,
          fontSize: theme.font.size.sm,
          padding: '10px 12px',
          resize: 'vertical',
          boxSizing: 'border-box',
          outline: 'none',
          lineHeight: 1.6,
        }}
      />
      <div style={{ marginTop: '6px', fontSize: theme.font.size.xs, color: theme.colors.muted, textAlign: 'right', fontFamily: theme.font.mono }}>
        {value.length} chars · ~{Math.round(value.length / 4)} tokens
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete the four sub-tab files**

```bash
rm "src/idh-app/frontend/src/pages/Project/tabs/code-session/BridgeSubTab.tsx"
rm "src/idh-app/frontend/src/pages/Project/tabs/code-session/FilesSubTab.tsx"
rm "src/idh-app/frontend/src/pages/Project/tabs/code-session/TranscriptSubTab.tsx"
rm "src/idh-app/frontend/src/pages/Project/tabs/code-session/ScheduleSubTab.tsx"
```

- [ ] **Step 3: Rewrite `CodeSessionTab.tsx`**

Replace the entire file content with:

```typescript
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { theme } from '../../../theme';
import ModelSelector from '../../../components/ModelSelector';
import ScheduleEditor from '../../../components/ScheduleEditor';
import CountdownTimer from '../../../components/CountdownTimer';
import CodingRulesEditor from '../../../components/CodingRulesEditor';
import { getModel, putModel, getClaudeMd, putClaudeMd, getProjectSchedule, putProjectSchedule } from '../../../api/settings';
import { getSessionMemory } from '../../../api/memory';
import type { ScheduleConfig } from '../../../api/types';
import { startBridge, stopBridge } from '../../../api/bridge';
import { ApiError } from '../../../api/client';
import { MODEL_OPTIONS } from '../../../api/types';
import type { Project } from '../../../api/types';

interface CodeSessionTabProps {
  project: Project;
  onProjectChange: (updated: Project) => void;
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      boxShadow: theme.shadow.card,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.surfaceElevated,
      }}>
        <span style={{
          fontSize: theme.font.size.sm,
          fontFamily: theme.font.sans,
          fontWeight: theme.font.weight.semibold,
          color: theme.colors.text,
        }}>
          {title}
        </span>
        {action}
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  );
}

function SaveButton({ id, saving, onClick }: { id: string; saving: string | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving !== null}
      style={{
        padding: '4px 12px',
        background: theme.colors.accent,
        border: 'none',
        borderRadius: theme.radius.md,
        color: theme.colors.onPrimary,
        cursor: saving !== null ? 'not-allowed' : 'pointer',
        fontSize: theme.font.size.sm,
        fontFamily: theme.font.sans,
        fontWeight: theme.font.weight.medium,
        opacity: saving !== null && saving !== id ? 0.5 : 1,
        transition: theme.transition.fast,
      }}
    >
      {saving === id ? 'Saving…' : 'Save'}
    </button>
  );
}

// ── CodeSessionTab ────────────────────────────────────────────────────────────

export default function CodeSessionTab({ project, onProjectChange }: CodeSessionTabProps) {
  const [provider, setProvider] = useState(project.modelOverride?.provider ?? MODEL_OPTIONS[0].provider);
  const [model, setModel] = useState(project.modelOverride?.model ?? MODEL_OPTIONS[0].model);
  const [claudeMd, setClaudeMd] = useState('');
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [sessionMemory, setSessionMemory] = useState('');
  const [memoryUpdatedAt, setMemoryUpdatedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Load model, CLAUDE.md, and schedule on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getModel(project.groupId),
      getClaudeMd(project.groupId).catch(() => ({ content: '' })),
      getProjectSchedule(project.groupId).catch(() => null),
    ]).then(([m, c, s]) => {
      if (cancelled) return;
      if (m.provider) { setProvider(m.provider); setModel(m.model); }
      setClaudeMd(c.content);
      setSchedule(s);
    }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [project.groupId]);

  // 2. Poll SESSION_MEMORY.md every 10 s (read-only viewer)
  useEffect(() => {
    let cancelled = false;
    const fetch = () => {
      getSessionMemory(project.projectId)
        .then((r) => { if (!cancelled) { setSessionMemory(r.content); setMemoryUpdatedAt(new Date()); } })
        .catch((e) => { if (!cancelled && e instanceof ApiError && e.status === 404) setSessionMemory(''); });
    };
    fetch();
    const id = setInterval(fetch, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [project.projectId]);

  const save = async (id: string, fn: () => Promise<unknown>) => {
    setSaving(id); setError(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(null); }
  };

  // 3. Bridge start / stop
  const handleStart = async () => {
    setActionBusy(true); setError(null);
    try {
      await startBridge(project.groupId);
      // Reload project so bridge state is fresh
      const { getProject } = await import('../../../api/projects');
      const updated = await getProject(project.groupId);
      onProjectChange(updated);
    } catch (e) { setError(e instanceof Error ? e.message : 'Start failed'); }
    finally { setActionBusy(false); }
  };

  const handleStop = async () => {
    setActionBusy(true); setError(null);
    try {
      await stopBridge(project.groupId);
      const { getProject } = await import('../../../api/projects');
      const updated = await getProject(project.groupId);
      onProjectChange(updated);
    } catch (e) { setError(e instanceof Error ? e.message : 'Stop failed'); }
    finally { setActionBusy(false); }
  };

  const isRunning = project.bridge !== null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', alignItems: 'start' }}>
      {/* Left panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <div style={{
            padding: '8px 12px',
            background: theme.colors.dangerBg,
            border: `1px solid ${theme.colors.danger}44`,
            borderRadius: theme.radius.sm,
            color: theme.colors.danger,
            fontSize: theme.font.size.sm,
          }}>
            {error}
          </div>
        )}

        {/* Model selector */}
        <SectionCard
          title="Session Model"
          action={
            <SaveButton
              id="model"
              saving={saving}
              onClick={() => save('model', () => putModel(project.groupId, provider, model))}
            />
          }
        >
          <ModelSelector provider={provider} model={model} onChange={(p, m) => { setProvider(p); setModel(m); }} />
        </SectionCard>

        {/* CLAUDE.md editor with multi-file upload */}
        <SectionCard
          title="Coding Rules (CLAUDE.md)"
          action={
            <SaveButton
              id="claude-md"
              saving={saving}
              onClick={() => save('claude-md', () => putClaudeMd(project.groupId, claudeMd))}
            />
          }
        >
          <CodingRulesEditor value={claudeMd} onChange={setClaudeMd} />
        </SectionCard>

        {/* SESSION_MEMORY.md read-only viewer */}
        <SectionCard title="Session Memory (read-only)">
          {sessionMemory ? (
            <pre style={{
              margin: 0,
              padding: '10px 12px',
              background: theme.colors.bg,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              color: theme.colors.text,
              fontFamily: theme.font.mono,
              fontSize: theme.font.size.xs,
              lineHeight: 1.6,
              overflowY: 'auto',
              maxHeight: '300px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {sessionMemory}
            </pre>
          ) : (
            <div style={{ color: theme.colors.muted, fontSize: theme.font.size.sm, fontFamily: theme.font.sans, fontStyle: 'italic' }}>
              No session memory yet — updated after each session ends.
            </div>
          )}
          {memoryUpdatedAt && (
            <div style={{ marginTop: '6px', fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.mono }}>
              Last checked: {memoryUpdatedAt.toLocaleTimeString()}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Right panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Session status */}
        <SectionCard title="Code Session">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Status row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: theme.font.size.sm, fontFamily: theme.font.sans, color: theme.colors.muted }}>Status</span>
              <span style={{
                padding: '2px 8px',
                borderRadius: theme.radius.full,
                fontSize: theme.font.size.xs,
                fontFamily: theme.font.sans,
                fontWeight: theme.font.weight.semibold,
                background: isRunning ? `${theme.colors.success}22` : `${theme.colors.muted}22`,
                color: isRunning ? theme.colors.success : theme.colors.muted,
              }}>
                {isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>

            {/* PID row */}
            {project.bridge && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: theme.font.size.sm, fontFamily: theme.font.sans, color: theme.colors.muted }}>PID</span>
                <span style={{ fontSize: theme.font.size.sm, fontFamily: theme.font.mono, color: theme.colors.text }}>
                  {project.bridge.pid}
                </span>
              </div>
            )}

            {/* Expiry countdown */}
            {project.bridge && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: theme.font.size.sm, fontFamily: theme.font.sans, color: theme.colors.muted }}>Expires</span>
                <CountdownTimer expiresAt={project.bridge.expiresAt} />
              </div>
            )}

            {/* Start / Stop button */}
            <button
              onClick={isRunning ? handleStop : handleStart}
              disabled={actionBusy}
              style={{
                marginTop: '4px',
                padding: '8px 16px',
                background: isRunning ? theme.colors.dangerBg : theme.colors.accentDim,
                border: `1px solid ${isRunning ? theme.colors.danger : theme.colors.accent}44`,
                borderRadius: theme.radius.md,
                color: isRunning ? theme.colors.danger : theme.colors.accent,
                cursor: actionBusy ? 'not-allowed' : 'pointer',
                fontSize: theme.font.size.sm,
                fontFamily: theme.font.sans,
                fontWeight: theme.font.weight.semibold,
                transition: theme.transition.fast,
                opacity: actionBusy ? 0.6 : 1,
              }}
            >
              {actionBusy ? '…' : isRunning ? 'Stop Session' : 'Start Session'}
            </button>
          </div>
        </SectionCard>

        {/* Schedule editor */}
        {schedule !== null && (
          <ScheduleEditor
            value={schedule}
            onChange={(updated) => {
              setSchedule(updated);
              putProjectSchedule(project.groupId, updated).catch((e: Error) => setError(e.message));
            }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd src/idh-app/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/idh-app/frontend/src/components/CodingRulesEditor.tsx src/idh-app/frontend/src/pages/Project/tabs/CodeSessionTab.tsx
git rm src/idh-app/frontend/src/pages/Project/tabs/code-session/BridgeSubTab.tsx
git rm src/idh-app/frontend/src/pages/Project/tabs/code-session/FilesSubTab.tsx
git rm src/idh-app/frontend/src/pages/Project/tabs/code-session/TranscriptSubTab.tsx
git rm src/idh-app/frontend/src/pages/Project/tabs/code-session/ScheduleSubTab.tsx
git commit -m "feat: rewrite CodeSessionTab as flat layout — model, CLAUDE.md upload, session memory viewer, session status, schedule"
```

---

## Task 9: EventFeed component + MonitoringPage integration

**Files:**
- Create: `src/idh-app/frontend/src/components/EventFeed.tsx`
- Modify: `src/idh-app/frontend/src/pages/Monitoring/MonitoringPage.tsx`

Background: `EventFeed` opens a WebSocket via `createMonitoringSocket()`, displays events newest-first, auto-reconnects with exponential backoff (max 30 s), and caps the list at 200 entries. It is added at the bottom of `MonitoringPage` below the existing `TimelineChart` and `ActivityFeed` components, which remain unchanged.

- [ ] **Step 1: Create `EventFeed.tsx`**

```typescript
// src/idh-app/frontend/src/components/EventFeed.tsx
import { useEffect, useRef, useState } from 'react';
import { theme } from '../theme';
import { createMonitoringSocket } from '../api/monitoring';

interface WsEvent {
  type: string;
  ts: string;
  group_id: string | null;
  payload: Record<string, unknown>;
}

const MAX_EVENTS = 200;

// Colour mapping for event type prefixes
const EVENT_COLORS: Record<string, string> = {
  'session': theme.colors.accent,
  'scheduler': theme.colors.warning ?? '#f59e0b',
  'summarizer': theme.colors.info ?? '#38bdf8',
  'memory': theme.colors.success,
  'error': theme.colors.danger,
};

function eventColor(type: string): string {
  const prefix = type.split('.')[0];
  return EVENT_COLORS[prefix] ?? theme.colors.muted;
}

export default function EventFeed() {
  const [events, setEvents] = useState<WsEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(1000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = () => {
    if (unmountedRef.current) return;
    const ws = createMonitoringSocket();
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setConnected(true);
      retryDelayRef.current = 1000;  // reset backoff on successful connection
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as WsEvent;
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setConnected(false);
      // Exponential backoff reconnect (1s → 2s → 4s → … → 30s max)
      const delay = Math.min(retryDelayRef.current, 30_000);
      retryDelayRef.current = delay * 2;
      retryTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();  // triggers onclose which handles reconnect
    };
  };

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      boxShadow: theme.shadow.card,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.surfaceElevated,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: theme.font.size.sm,
            fontFamily: theme.font.sans,
            fontWeight: theme.font.weight.semibold,
            color: theme.colors.text,
          }}>
            Live Events
          </span>
          <span style={{
            width: '6px', height: '6px',
            borderRadius: '50%',
            background: connected ? theme.colors.success : theme.colors.muted,
            display: 'inline-block',
            transition: 'background 0.3s',
          }} />
          <span style={{ fontSize: theme.font.size.xs, fontFamily: theme.font.mono, color: theme.colors.muted }}>
            {connected ? 'connected' : 'reconnecting…'}
          </span>
        </div>
        <button
          onClick={() => setEvents([])}
          style={{
            padding: '2px 8px',
            background: 'none',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.muted,
            cursor: 'pointer',
            fontSize: theme.font.size.xs,
            fontFamily: theme.font.sans,
          }}
        >
          Clear
        </button>
      </div>

      {/* Event list */}
      <div style={{
        maxHeight: '360px',
        overflowY: 'auto',
        fontFamily: theme.font.mono,
        fontSize: theme.font.size.xs,
      }}>
        {events.length === 0 ? (
          <div style={{ padding: '24px 16px', color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.font.size.sm, fontStyle: 'italic' }}>
            Waiting for events…
          </div>
        ) : (
          events.map((ev, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '6px 16px',
                borderBottom: `1px solid ${theme.colors.border}22`,
              }}
            >
              {/* Timestamp */}
              <span style={{ color: theme.colors.muted, whiteSpace: 'nowrap', flexShrink: 0, paddingTop: '1px' }}>
                {new Date(ev.ts).toLocaleTimeString()}
              </span>

              {/* Event type badge */}
              <span style={{
                padding: '1px 6px',
                borderRadius: theme.radius.sm,
                background: `${eventColor(ev.type)}22`,
                color: eventColor(ev.type),
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {ev.type}
              </span>

              {/* Group ID */}
              {ev.group_id && (
                <span style={{ color: theme.colors.textSecondary, flexShrink: 0 }}>
                  {ev.group_id}
                </span>
              )}

              {/* Payload summary */}
              <span style={{ color: theme.colors.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {Object.entries(ev.payload).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add EventFeed to MonitoringPage**

Open `src/idh-app/frontend/src/pages/Monitoring/MonitoringPage.tsx`.

Add the import at the top (after existing component imports):

```typescript
import EventFeed from '../../components/EventFeed';
```

Scroll to the bottom of the JSX return. After the last existing component in the return (before the closing outer `</div>`), add:

```tsx
        {/* Real-time event feed */}
        <EventFeed />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd src/idh-app/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors

- [ ] **Step 4: Run full backend test suite one final time**

```bash
cd src/idh-app && uv run pytest -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/idh-app/frontend/src/components/EventFeed.tsx src/idh-app/frontend/src/pages/Monitoring/MonitoringPage.tsx
git commit -m "feat: add EventFeed component and wire to MonitoringPage for real-time WebSocket events"
```
