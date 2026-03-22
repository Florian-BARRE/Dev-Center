# Project Page Redesign — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise the project page into clearly separated Telegram and Code Session concerns, add a real-time WebSocket event feed to Monitoring, and introduce a distinct Telegram model separate from the Code Session model.

**Architecture:** Option A — refactor the existing 3-tab layout (Overview / Telegram / Code Session), redistribute content cleanly, extend the backend with a Telegram-model endpoint and a WebSocket event bus, enrich the Monitoring tab with a live event feed.

**Tech Stack:** FastAPI (Python), React + TypeScript + Vite, WebSocket (native browser API + FastAPI WebSocket), polling for SESSION_MEMORY.md refresh

---

## 1. Scope of Change

### What moves / changes

| Current location | Item | New location |
|---|---|---|
| TelegramTab | Model selector | TelegramTab — becomes **Telegram model** only (new endpoint) |
| TelegramTab | SESSION_MEMORY.md editor | CodeSessionTab — read-only viewer |
| (missing) | Coding rules upload → CLAUDE.md | CodeSessionTab |
| Overview | Bridge start/stop/status | CodeSessionTab |
| Overview | Schedule settings | CodeSessionTab |
| Overview | Bridge expiry / PID | CodeSessionTab |
| Monitoring | Static activity feed | Monitoring — live WebSocket feed replaces polling |

### Terminology rename (UI labels only — no backend field renames)

`bridge` → `code session` / `session` in all display labels and TypeScript variable names introduced in this feature. Existing backend field names (`bridge`, `bridgeManager`, `bridge_manager`) are left unchanged.

### Existing component removed

`FilesSubTab` (currently part of the Code Session tab) is **replaced** by the new `CodingRulesEditor`. The existing `PUT /api/v1/settings/{group_id}/claude-md` endpoint is reused by the new component — this is the canonical CLAUDE.md write path. The memory router's `PUT /api/v1/memory/{project_id}` endpoint writes `SESSION_MEMORY.md`, not CLAUDE.md — these are two different files (see Section 3).

---

## 2. Two Distinct Models

The project has two independent model configurations:

| | **Telegram model** | **Code Session model** |
|---|---|---|
| Used by | OpenClaw Telegram agent | Claude Code bridge process |
| Stored in | `openclaw.json` per agent | `state.json` as `model_override` per project |
| Existing endpoint | **None — new** | `GET/PUT /api/v1/settings/{group_id}/model` |
| New endpoint | `GET/PUT /api/v1/settings/{group_id}/telegram-model` | (unchanged) |

Both return `{provider, model}` but they are independent — changing one does not affect the other.

---

## 3. Telegram Tab

### Content

| Element | Source | Path param | R/W |
|---|---|---|---|
| Provider + model selector | `GET/PUT /api/v1/settings/{group_id}/telegram-model` | `groupId` | R/W |
| System prompt editor | `GET/PUT /api/v1/settings/{group_id}/telegram-prompt` | `groupId` | R/W |
| Context size meter | `GET /api/v1/settings/{group_id}/context-size` | `groupId` | R |
| Group ID | `project.groupId` (local) | — | R |

### Group ID display

Read-only text field showing `project.groupId`. No dedicated component needed — inline in the tab layout.

### Backend — new Telegram model endpoint

**`OpenClawConfigWriter`** — two new methods:

```python
def get_agent_model(self, agent_id: str) -> tuple[str, str]:
    """Return (provider, model) for the agent. Returns ('', '') if unset."""

def update_agent_model(self, agent_id: str, provider: str, model: str) -> None:
    """Set provider and model for the agent in openclaw.json (atomic, under filelock)."""
```

`openclaw.json` agent structure after this change:
```json
{
  "agents": {
    "<agent_id>": {
      "system_prompt": "...",
      "model": { "provider": "anthropic", "model": "claude-sonnet-4-6" }
    }
  }
}
```

Existing agents without the `"model"` key are handled gracefully — `get_agent_model` returns `('', '')` when the key is absent. No migration script required.

**New Pydantic models** in `settings/models.py`:

```python
class TelegramModelResponse(_CamelModel):
    provider: str
    model: str

class TelegramModelRequest(_CamelModel):
    provider: str
    model: str
```

Note: `TelegramModelResponse` is structurally identical to `ModelResponse` but is kept separate to make the conceptual distinction explicit at the API layer.

**New routes** in `settings/router.py`:

```
GET  /api/v1/settings/{group_id}/telegram-model  → TelegramModelResponse
PUT  /api/v1/settings/{group_id}/telegram-model  → SettingsResponse
```

Both decorated with `@auto_handle_errors`. The PUT route calls `openclaw_writer.update_agent_model(agent_id, body.provider, body.model)` where `agent_id == project.project_id` (existing convention).

---

## 4. Code Session Tab

### Content

| Element | Source | Path param | R/W |
|---|---|---|---|
| Provider + model selector | `GET/PUT /api/v1/settings/{group_id}/model` | `groupId` | R/W |
| Session state (running/stopped) | `project.bridge` | — | R |
| PID | `project.bridge.pid` | — | R |
| Expiry countdown | `project.bridge.expiresAt` | — | R (live countdown) |
| Start / Stop buttons | `POST /api/v1/bridge/{group_id}/start|stop` | `groupId` | W |
| Schedule editor | `GET/PUT /api/v1/settings/{group_id}/schedule` | `groupId` | R/W |
| Coding rules upload → CLAUDE.md | `GET/PUT /api/v1/settings/{group_id}/claude-md` | `groupId` | R/W |
| SESSION_MEMORY.md viewer | `GET /api/v1/memory/{project_id}/session-memory` | `projectId` | R (polling 10s) |

Note: `groupId` maps to `project.groupId`, `projectId` maps to `project.projectId`.

### Coding rules upload behaviour (frontend only — no new endpoint)

1. User selects N `.md` files via `<input type="file" multiple>`.
2. Files are read with `FileReader`, sorted alphabetically by filename.
3. Contents are concatenated with `\n\n---\n\n` separators and a `# <filename>` heading before each file.
4. Result is injected into the CLAUDE.md textarea (user can still edit manually before saving).
5. Save button calls `PUT /api/v1/settings/{group_id}/claude-md` with the textarea content.

### SESSION_MEMORY.md viewer

- Read-only `<pre>` block (monospace, scrollable, max-height 300px).
- Polls `GET /api/v1/memory/{project_id}/session-memory` every 10 seconds.
- On HTTP 404: shows "No session memory yet" placeholder (file does not exist until first session ends).
- Shows "Last updated: <timestamp>" below the viewer, updated on each successful poll.

---

## 5. Monitoring Tab — WebSocket Event Feed

### Backend — EventBus

New class at `libs/event_bus/event_bus.py`:

```python
class EventBus:
    """
    Asyncio pub/sub bus for broadcasting real-time events to WebSocket clients.

    Internally maintains a list of asyncio.Queue instances — one per connected
    subscriber. publish() puts a copy of the event into every queue. subscribe()
    yields from the caller's dedicated queue and removes it on cancellation/close.
    """

    def __init__(self) -> None:
        self._queues: list[asyncio.Queue] = []

    async def publish(self, event_type: str, payload: dict, group_id: str | None = None) -> None:
        """Enqueue an event to all active subscribers."""

    async def subscribe(self) -> AsyncGenerator[dict, None]:
        """
        Yield events as they arrive.
        The generator adds a queue on entry and removes it on exit (finally block),
        preventing memory leaks on client disconnect.
        """
```

Instantiated once in `entrypoint.py` and injected as `CONTEXT.event_bus`.

### Event schema

```json
{
  "type": "session.started",
  "ts": "2026-03-22T14:32:00Z",
  "group_id": "-123456",
  "payload": { ... }
}
```

### Event types

| Type | Emitted by | Payload fields |
|---|---|---|
| `session.started` | BridgeManager | `pid`, `workspace`, `expires_at` |
| `session.stopped` | BridgeManager | — |
| `session.expired` | BridgeManager watchdog | — |
| `session.renewed` | BridgeManager | `pid`, `expires_at` |
| `scheduler.tick` | SchedulerService | `active_projects` (count) |
| `scheduler.warning_sent` | SchedulerService | `remaining_minutes` |
| `summarizer.started` | CodexSummarizer | `project_id` |
| `summarizer.completed` | CodexSummarizer | `project_id`, `output_length` |
| `memory.updated` | MemoryManager | `project_id`, `file` (`CLAUDE.md` or `SESSION_MEMORY.md`) |
| `error` | any service | `source`, `message` |

### WebSocket endpoint

New router at `backend/routers/monitoring/router.py` (existing file — add to it):

```
WS /api/v1/monitoring/ws
```

**Note on `@auto_handle_errors`:** WebSocket routes cannot use `@auto_handle_errors` (the decorator raises `HTTPException` which is meaningless after the HTTP upgrade). Instead, the WebSocket handler wraps the event loop in a `try/except`, logs errors via `CONTEXT.logger.error`, and closes the connection cleanly on unexpected exceptions.

**Note on `response_model`:** WebSocket routes have no HTTP response body — `response_model` is not applicable. This is the only exception to the project-wide rule.

Connection lifecycle:
1. Client connects → subscribe to `EventBus`.
2. Stream events as JSON strings until client disconnects or an error occurs.
3. On `WebSocketDisconnect` or any exception: `finally` block unsubscribes from `EventBus` (queue is removed, preventing memory leak).

### Frontend — EventFeed component

Location: `src/components/EventFeed.tsx`

- Connects to `ws(s)://<host>/api/v1/monitoring/ws` on mount.
- Displays events in a scrollable list, newest at top, max 200 entries retained in state.
- Each row: timestamp, coloured badge for event type (colour map defined in component), `group_id` if present, payload key/value summary.
- Auto-reconnect on disconnect with exponential backoff (1s → 2s → 4s → … → 30s max). Reconnect logic lives entirely in `EventFeed` — `createMonitoringSocket()` simply returns a fresh `WebSocket`.
- "Clear" button wipes displayed events without disconnecting.
- Existing polling functions (`getTimeline`, `getActivityLog`) in `monitoring.ts` are **retained** — `TimelineChart` and the project status table on `MonitoringPage` continue to use them. `EventFeed` is added alongside, not replacing, these components.

---

## 6. Frontend Component Tree

```
ProjectPage
├── OverviewTab              (unchanged)
├── TelegramTab              (refactored)
│   ├── TelegramModelSelector  (new — telegram-model endpoint)
│   ├── SystemPromptEditor     (existing, moved)
│   ├── ContextSizeMeter       (existing, unchanged)
│   └── GroupInfoCard          (new — read-only display of groupId)
├── CodeSessionTab           (refactored)
│   ├── SessionModelSelector   (existing ModelSelector — /model endpoint)
│   ├── SessionStatusCard      (state, PID, expiry countdown, start/stop)
│   ├── ScheduleEditor         (existing, moved here from Overview)
│   ├── CodingRulesEditor      (new — file upload + CLAUDE.md textarea)
│   └── SessionMemoryViewer    (new — read-only, polling 10s)
└── MonitoringPage
    ├── TimelineChart          (existing, unchanged)
    ├── ProjectStatusTable     (existing, unchanged)
    └── EventFeed              (new — WebSocket live feed)
```

---

## 7. API Layer Changes (Frontend)

**`src/api/settings.ts`** — add:
```typescript
getTelegramModel(groupId: string): Promise<{ provider: string; model: string }>
putTelegramModel(groupId: string, provider: string, model: string): Promise<void>
```

**`src/api/monitoring.ts`** — add alongside existing functions:
```typescript
createMonitoringSocket(): WebSocket  // caller owns lifecycle; EventFeed handles reconnect
```

---

## 8. Out of Scope

- Renaming backend field names (`bridge`, `bridgeManager`) — display labels only
- Group name from Telegram — not stored, not displayed
- Telegram conversation transcript / agent session memory — deferred
- Authentication on WebSocket endpoint
- `openclaw.json` migration tooling — graceful defaults handle missing `"model"` keys
