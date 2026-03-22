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
| TelegramTab | Model selector | TelegramTab (unchanged) — becomes **Telegram model** only |
| TelegramTab | SESSION_MEMORY.md editor | CodeSessionTab — read-only viewer |
| (missing) | Coding rules upload → CLAUDE.md | CodeSessionTab |
| Overview | Bridge start/stop/status | CodeSessionTab |
| Overview | Schedule settings | CodeSessionTab |
| Overview | Bridge expiry / PID | CodeSessionTab |
| Monitoring | Static activity feed | Monitoring — live WebSocket feed |

### Terminology rename

`bridge` → `code session` / `session` everywhere in the UI. Backend field names (`bridge`, `bridgeManager`, etc.) are **not** renamed — only display labels and TypeScript API wrappers change.

---

## 2. Telegram Tab

### Content

| Element | Source | R/W |
|---|---|---|
| Provider selector | `GET/PUT /api/v1/settings/{group_id}/telegram-model` | R/W |
| Model selector | same endpoint | R/W |
| System prompt editor | `GET/PUT /api/v1/settings/{group_id}/telegram-prompt` | R/W |
| Context size meter | `GET /api/v1/settings/{group_id}/context-size` | R |
| Group ID | `project.groupId` | R |

### Backend — new Telegram model endpoint

**`OpenClawConfigWriter`** — two new methods:
```python
def get_agent_model(self, agent_id: str) -> tuple[str, str]:
    """Return (provider, model) for the agent. Empty strings if unset."""

def update_agent_model(self, agent_id: str, provider: str, model: str) -> None:
    """Set provider and model for the agent in openclaw.json (atomic)."""
```

`openclaw.json` agent structure becomes:
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

**New routes** in `settings/router.py`:
```
GET  /api/v1/settings/{group_id}/telegram-model  → TelegramModelResponse(provider, model)
PUT  /api/v1/settings/{group_id}/telegram-model  → SettingsResponse
```

**New Pydantic models** in `settings/models.py`:
```python
class TelegramModelResponse(_CamelModel):
    provider: str
    model: str

class TelegramModelRequest(_CamelModel):
    provider: str
    model: str
```

---

## 3. Code Session Tab

### Content

| Element | Source | R/W |
|---|---|---|
| Provider + model selector | `GET/PUT /api/v1/settings/{group_id}/model` | R/W |
| Session state (running/stopped) | `project.bridge` | R |
| PID | `project.bridge.pid` | R |
| Expiry countdown | `project.bridge.expiresAt` | R (live countdown) |
| Start / Stop buttons | `POST /api/v1/bridge/{group_id}/start|stop` | W |
| Schedule editor | `GET/PUT /api/v1/settings/{group_id}/schedule` | R/W |
| Relaunch config (message, warning duration) | part of `ScheduleConfig` | R/W |
| Coding rules upload → CLAUDE.md | `GET/PUT /api/v1/memory/{project_id}` | R/W |
| SESSION_MEMORY.md viewer | `GET /api/v1/memory/{project_id}/session` | R (polling 10s) |

### Coding rules upload behaviour (frontend only, no new endpoint)

1. User selects N `.md` files via `<input type="file" multiple>`.
2. Files are read with `FileReader`, sorted alphabetically by filename.
3. Contents are concatenated with `\n\n---\n\n` separators.
4. Result is injected into the CLAUDE.md textarea (user can edit before saving).
5. Save button calls `PUT /api/v1/memory/{project_id}` with the textarea content.

### SESSION_MEMORY.md viewer

- Read-only `<pre>` / `MarkdownPreview` component.
- Polls `GET /api/v1/memory/{project_id}/session` every 10 seconds.
- Shows "No session memory yet" placeholder on 404.
- Last-updated timestamp shown below.

---

## 4. Monitoring Tab — WebSocket Event Feed

### Backend — EventBus

New class `libs/event_bus/event_bus.py`:
```python
class EventBus:
    """Asyncio-based pub/sub for broadcasting real-time events to WebSocket clients."""

    async def publish(self, event_type: str, payload: dict) -> None: ...
    async def subscribe(self) -> AsyncGenerator[dict, None]: ...
```

Injected into `CONTEXT.event_bus`.

### Event schema

```json
{
  "type": "session.started",
  "ts": "2026-03-22T14:32:00Z",
  "group_id": "-123456",
  "payload": { ... }
}
```

Event types emitted:

| Type | Emitted by | Payload |
|---|---|---|
| `session.started` | BridgeManager | `pid`, `workspace`, `expires_at` |
| `session.stopped` | BridgeManager | `group_id` |
| `session.expired` | BridgeManager watchdog | `group_id` |
| `session.renewed` | BridgeManager | `pid`, `expires_at` |
| `scheduler.tick` | SchedulerService | `active_projects` count |
| `scheduler.warning_sent` | SchedulerService | `group_id`, `remaining_minutes` |
| `summarizer.started` | CodexSummarizer | `project_id` |
| `summarizer.completed` | CodexSummarizer | `project_id`, `output_length` |
| `memory.updated` | MemoryManager | `project_id`, `file` (`CLAUDE.md` or `SESSION_MEMORY.md`) |
| `error` | any service | `source`, `message` |

### WebSocket endpoint

New router `backend/routers/monitoring/router.py`:
```
WS /api/v1/monitoring/ws
```

- On connect: subscribe to `EventBus`.
- Stream events as JSON to the client.
- On disconnect: clean up subscription.

### Frontend — EventFeed component

- Connects to `ws(s)://<host>/api/v1/monitoring/ws` on mount.
- Displays events in a scrollable list, newest at top.
- Each row: timestamp, coloured badge for event type, group_id (if present), payload summary.
- Auto-reconnect on disconnect (exponential backoff, max 30s).
- "Clear" button to wipe displayed events.

---

## 5. Frontend Component Tree

```
ProjectPage
├── OverviewTab          (unchanged)
├── TelegramTab          (refactored)
│   ├── TelegramModelSelector   (new — uses telegram-model endpoint)
│   ├── SystemPromptEditor      (existing, moved)
│   ├── ContextSizeMeter        (existing, unchanged)
│   └── GroupInfoCard           (new — shows groupId)
├── CodeSessionTab       (refactored from existing tabs)
│   ├── SessionModelSelector    (existing ModelSelector, uses /model endpoint)
│   ├── SessionStatusCard       (state, PID, expiry countdown, start/stop)
│   ├── ScheduleEditor          (existing, moved here)
│   ├── CodingRulesEditor       (new — file upload + CLAUDE.md textarea)
│   └── SessionMemoryViewer     (new — read-only, polling)
└── MonitoringPage
    └── EventFeed               (new — WebSocket)
```

---

## 6. API Layer Changes (Frontend)

New functions in `src/api/settings.ts`:
```typescript
getTelegramModel(groupId: string): Promise<{ provider: string; model: string }>
putTelegramModel(groupId: string, provider: string, model: string): Promise<void>
```

New file `src/api/monitoring.ts`:
```typescript
createMonitoringSocket(): WebSocket   // returns connected WS, caller manages lifecycle
```

---

## 7. Out of Scope

- Renaming backend field names (`bridge`, `bridgeManager`) — display labels only
- Group name from Telegram — not stored, not displayed
- Telegram conversation transcript / agent session memory — deferred
- Authentication on WebSocket endpoint
