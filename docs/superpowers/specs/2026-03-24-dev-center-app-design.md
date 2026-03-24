# dev-center-app — Design Spec

**Date:** 2026-03-24
**Status:** Approved

---

## Goal

Replace the previous Telegram/OpenClaw-based IDH system with a simple, self-contained web application (`dev-center-app`) that manages development projects, links each to a GitHub repository, maintains always-active Claude Code remote sessions, and provides real-time visibility into sessions, memory, and coding rules.

No Telegram. No OpenClaw. No plugin. One web app that works.

---

## Architecture

**Stack:** FastAPI (Python) + React+Vite (TypeScript), served as static files by FastAPI. Single Docker container.

**Pattern:** Follows the project's standard FastAPI layout (`src/dev-center-app/`) with `CONTEXT` service locator, `entrypoint.py` factory, `@auto_handle_errors` on all routes, `/api/v1` prefix.

```
src/dev-center-app/
├── entrypoint.py
├── Dockerfile
├── pyproject.toml
├── config/
│   └── runtime/runtime_config.py
├── libs/
│   ├── session_manager/     # claude remote-control subprocess lifecycle + watchdog
│   ├── git_manager/         # git clone + progress streaming
│   ├── auth_checker/        # ~/.claude credential detection + auth flow
│   ├── scheduler/           # time-range schedule (start/stop on range entry/exit)
│   ├── state/               # JSON state read/write (projects.json + global-config.json)
│   └── event_bus/           # in-process pub/sub for real-time events
├── backend/
│   ├── app.py
│   ├── context.py
│   ├── lifespan.py
│   └── routers/
│       ├── projects/        # CRUD
│       ├── sessions/        # start/stop/renew + WebSocket logs
│       ├── memory/          # read ~/.claude/projects/*/memory/*.md
│       ├── rules/           # read/write CLAUDE.md per project
│       ├── auth/            # auth status + trigger OAuth flow
│       └── monitoring/      # global session status + activity feed
└── frontend/
    ├── vite.config.ts
    └── src/
        ├── theme.ts
        ├── App.tsx
        ├── api/             # typed API client + WebSocket helpers
        ├── components/      # shared components
        └── pages/
            ├── Dashboard/
            ├── ProjectDetail/
            ├── Monitoring/
            └── Settings/
```

---

## Data Model

Two JSON files in `/data/`:

- `/data/projects.json` — list of all projects + live session state
- `/data/global-config.json` — global defaults + schedule
- `/data/global-rules.md` — global coding rules (plain markdown text)

```python
class SessionState:
    pid: int
    workspace: str           # redundant with Project.workspace_path — kept for crash recovery
    started_at: str          # ISO-8601 UTC, used to compute elapsed time
    expires_at: str          # ISO-8601 UTC
    auto_renew: bool = True
    claude_project_hash: str = ""  # discovered after first session start (see Memory section)

class TimeRange:
    start: str               # "HH:MM" 24h format
    end: str                 # "HH:MM" — "00:00" means midnight (end of day)

class ScheduleConfig:
    enabled: bool = False
    ranges: list[TimeRange] = []
    days: list[str] = []     # subset of ["mon","tue","wed","thu","fri","sat","sun"] — empty = all days

class Project:
    id: str                  # slug: lowercase repo name, hyphens replace non-alphanumeric (e.g. "my-project")
    name: str                # display name, same as id by default
    repo_url: str            # GitHub HTTPS URL
    workspace_path: str      # absolute path on server, e.g. /workspaces/my-project
    provider: str = "anthropic"
    model: str = "claude-sonnet-4-6"
    schedule: ScheduleConfig = ScheduleConfig()
    session: SessionState | None = None

class StateFile:
    projects: dict[str, Project] = {}  # keyed by project id

class GlobalDefaults:
    default_provider: str = "anthropic"
    default_model: str = "claude-sonnet-4-6"
    default_ttl_hours: int = 8
    renew_threshold_minutes: int = 30  # renew when TTL < this value

class GlobalConfig:
    defaults: GlobalDefaults = GlobalDefaults()
    schedule: ScheduleConfig = ScheduleConfig()
```

**Project ID generation:** take the last path segment of the GitHub URL, strip `.git` suffix, lowercase, replace any non-alphanumeric character with `-`, collapse consecutive hyphens. Example: `https://github.com/user/My_Project.git` → `my-project`. If the derived ID already exists in state, append `-2`, `-3`, etc.

---

## Session Lifecycle

**Start:**
```bash
claude remote-control --workspace <workspace_path> --continue
```
`--continue` resumes the last conversation in that workspace. On first start, Claude creates a new session. Subprocess stdout+stderr piped together for log streaming.

**Stop:** Send SIGTERM to PID recorded in `SessionState.pid`. Clear `session` field in state.

**Renewal:** Stop current session, restart with `--continue`. Claude auto-memory and CLAUDE.md survive across restarts (they live in the workspace and `~/.claude`).

**Auto-renew watchdog (in `SessionManager`):**
- Runs every 60 seconds as an `asyncio` background task.
- `renew_threshold_minutes` is always read from `GlobalConfig.defaults.renew_threshold_minutes` — there is no per-project override.
- If `session.auto_renew = True` and `expires_at - now < renew_threshold_minutes` → call `renew()`.
- If `session.auto_renew = False` and `expires_at <= now` → call `stop()`, set session to None.

**Scheduler (in `SchedulerService`):**
- Runs every 60 seconds as a separate `asyncio` background task.
- Schedule priority: use `project.schedule` if `project.schedule.enabled = True`, otherwise use `GlobalConfig.schedule` if `GlobalConfig.schedule.enabled = True`, otherwise do nothing (no automatic start/stop for that project).
- If current time is inside an active range and no session running → start session.
- If current time is outside all ranges and a session is running → stop session.

**Concurrency:** both watchdog and scheduler acquire a per-project `asyncio.Lock` before any start/stop/renew call. `SessionManager` holds a `dict[str, asyncio.Lock]` keyed by project id. Locks are created on first access.

---

## Claude Auth

1. On startup, `AuthChecker.is_authenticated()` inspects `~/.claude/.credentials.json` (or equivalent) for a non-expired token.
2. If authenticated → proceed normally.
3. If not → `CONTEXT.auth_ok = False`. All API responses include an `X-Auth-Warning: unauthenticated` header. Frontend reads this header on any API call and shows a persistent alert banner.
4. `GET /api/v1/auth/status` returns `{ authenticated: bool, email: str | None }`.
5. `POST /api/v1/auth/login` spawns `claude auth login`, returns 200 immediately.
6. `WS /api/v1/auth/login/stream` streams the subprocess output line-by-line as `{ "line": "..." }` JSON messages until the process exits. On process exit, sends `{ "done": true, "success": bool }` and closes.
7. `~/.claude` mounted read-write so token refreshes persist to host.

---

## Coding Rules

**Injection format** — global rules are wrapped in a delimited block when injected into `CLAUDE.md`:

```
<!-- dev-center: global-rules-start -->
<content of /data/global-rules.md>
<!-- dev-center: global-rules-end -->
```

This block is placed at the top of `CLAUDE.md` on project creation. On sync, the block between the two markers is replaced with the current global-rules content. Text outside the markers is never touched.

**Sync detection:** on `GET /api/v1/projects/{id}/rules`, the backend extracts the content between the markers and compares it (stripped) to the current `/data/global-rules.md` content. If they differ, the response includes `"global_rules_out_of_sync": true`.

**Rules storage:**
- Global rules: `/data/global-rules.md` (plain markdown)
- Per-project rules: `<workspace>/CLAUDE.md` (contains the injected block + user additions)

---

## Memory Viewer

Claude auto-memory writes notes to `~/.claude/projects/<hash>/memory/*.md`. The hash is derived by Claude CLI from the workspace path, but the exact algorithm is not public.

**Discovery strategy:** After a session starts successfully, `SessionManager` waits 2 seconds then scans `~/.claude/projects/` for subdirectories modified within the last 10 seconds that contain a `memory/` subdirectory. The first match is stored as `session.claude_project_hash`. On subsequent starts, the stored hash is used directly.

If no hash is discovered at start time, the memory endpoint retries discovery on every poll request (i.e. each `GET /api/v1/projects/{id}/memory` call re-scans if `claude_project_hash` is still empty). This handles slow filesystem or container startup. Once a hash is found it is persisted to state and no further scanning occurs.

**Memory endpoint:** `GET /api/v1/projects/{id}/memory` returns:
```json
{
  "files": [
    { "name": "style.md", "content": "...", "updated_at": "2026-03-24T10:00:00Z" }
  ],
  "hash_discovered": true
}
```

Frontend polls every 30 seconds. Files are read-only from the UI.

---

## Git Clone Flow

`POST /api/v1/projects` accepts `{ repo_url, model?, provider? }`, derives the project ID, writes a pending project entry to state with `session: null`, then triggers the clone as a background `asyncio` task.

Clone progress is streamed via WebSocket: `WS /api/v1/projects/{id}/clone/stream`.

Message schema:
```json
{ "type": "progress", "line": "Cloning into '/workspaces/my-project'..." }
{ "type": "progress", "line": "Receiving objects: 42% (210/500)" }
{ "type": "done", "success": true }
{ "type": "done", "success": false, "error": "Repository not found" }
```

On success: workspace_path is set, project status becomes `ready`.
On failure: partial directory is removed (`shutil.rmtree`), project entry is removed from state, WebSocket closes with `{ "type": "done", "success": false, "error": "..." }`.

**Retry:** on clone failure, the project entry is removed from state entirely — the derived project ID is released back to the pool. `POST /api/v1/projects` with the same URL generates the same ID (no `-2` suffix) and creates a fresh entry.

Project status field (not persisted to state, computed on read):
- `cloning` — clone in progress
- `ready` — clone done, no session
- `active` — session running
- `error` — clone failed (entry removed, so this state is transient)

---

## API Surface

All routes under `/api/v1`. All return Pydantic models with camelCase JSON serialization.

### Projects
```
GET    /api/v1/projects                         → ProjectListResponse
POST   /api/v1/projects                         body: CreateProjectRequest → ProjectResponse (202 Accepted, clone runs in background)
GET    /api/v1/projects/{id}                    → ProjectResponse
DELETE /api/v1/projects/{id}                    → 204 (stops session if active, removes workspace)
PUT    /api/v1/projects/{id}                    body: UpdateProjectRequest (model, provider, schedule) → ProjectResponse
```

### Sessions
```
POST   /api/v1/projects/{id}/session/start      → SessionResponse (422 if already active)
POST   /api/v1/projects/{id}/session/stop       → 204
POST   /api/v1/projects/{id}/session/renew      → SessionResponse
WS     /api/v1/projects/{id}/session/logs       → streams { "line": "..." } until disconnect
```
Log WebSocket: does NOT replay history on connect (subprocess stdout is live-only). If no active session, sends `{ "line": "(no active session)" }` and closes.

### Clone
```
WS     /api/v1/projects/{id}/clone/stream       → see Git Clone Flow above
```

### Memory
```
GET    /api/v1/projects/{id}/memory             → MemoryResponse (see Memory section)
```

### Rules
```
GET    /api/v1/projects/{id}/rules              → RulesResponse { content, global_rules_out_of_sync }
PUT    /api/v1/projects/{id}/rules              body: { content: str } → RulesResponse
POST   /api/v1/projects/{id}/rules/sync         → RulesResponse (injects updated global block)
```

### Monitoring
```
GET    /api/v1/monitoring                       → MonitoringResponse { projects: [...] }
WS     /api/v1/monitoring/events                → streams { "type": "session.started"|"session.stopped"|"session.expired"|"session.renewed"|"clone.done", "project_id": str, "data": {} }
```

### Settings
```
GET    /api/v1/settings                         → GlobalConfigResponse
PUT    /api/v1/settings                         body: GlobalConfigRequest → GlobalConfigResponse
GET    /api/v1/settings/rules                   → { content: str }
PUT    /api/v1/settings/rules                   body: { content: str } → { content: str }
```

### Auth
```
GET    /api/v1/auth/status                      → { authenticated: bool, email: str | None }
POST   /api/v1/auth/login                       → 200 (spawns subprocess) | 422 if claude not in PATH
WS     /api/v1/auth/login/stream                → streams { "line": str } + { "done": true, "success": bool }
                                                   If no subprocess running, immediately sends { "done": true, "success": false } and closes.
                                                   Auth timeout after 5 minutes.
```

### Health
```
GET    /api/v1/health                           → { status: "ok" }
```

---

## Pages

### Dashboard
- Card per project: name, status badge (Active / Idle / Cloning), model, TTL countdown if active.
- Quick start/stop button per card.
- Global auth warning banner if `authenticated = false`.
- "Add Project" button opens the Add Project modal.

### Add Project Modal
1. Input: GitHub HTTPS URL.
2. Project name preview (derived slug).
3. Model selector (optional override).
4. Submit → `POST /api/v1/projects` → connect to clone WebSocket, show progress lines.
5. On success: modal closes, new card appears on Dashboard.
6. On failure: error message shown in modal, user can retry.

### ProjectDetail (`/projects/:id`)
Three tabs:

**Session tab**
- Status badge, PID, started_at, TTL countdown, expires_at.
- Auto-renew toggle (calls `PUT /api/v1/projects/{id}` with updated auto_renew).
- Start / Stop / Renew buttons.
- Live log pane (WebSocket to `/session/logs`, auto-scrolls).
- Model selector + per-project schedule toggle.

**Rules tab**
- Global rules block: read-only, rendered as markdown. "Out of sync" badge + "Sync" button if `global_rules_out_of_sync = true`.
- Project-specific rules: textarea editor. Save button calls `PUT /api/v1/projects/{id}/rules`.

**Memory tab**
- List of memory files with filename and last-updated timestamp.
- Content rendered as markdown.
- Auto-refresh every 30s.
- "No memory files yet" empty state if `files = []`.

### Monitoring (`/monitoring`)
- Table: all projects, status, PID, TTL, workspace path.
- Real-time activity feed (WebSocket to `/monitoring/events`): timestamped list of events, newest at top.

### Settings (`/settings`)
Three tabs:

**Defaults**
- Default model + provider selectors.
- Default TTL (hours) input.
- Renew threshold (minutes) input.
- Global schedule editor (time ranges + days checkboxes).

**Global Rules**
- Textarea editor for `/data/global-rules.md`.
- Save button.
- Badge showing how many projects have out-of-sync rules.

**Auth**
- Status: authenticated ✅ / not authenticated ❌, email if available.
- "Re-authenticate" button → opens modal with live output stream from `claude auth login`.

---

## Docker Compose

```yaml
services:
  dev-center-app:
    build:
      context: src
      dockerfile: dev-center-app/Dockerfile
    ports:
      - "${DEV_CENTER_PORT:-8000}:8000"
    env_file:
      - services/dev-center-app/.env
    volumes:
      - ${DATA_ROOT}/workspaces:/workspaces
      - ${DATA_ROOT}/data:/data
      - ~/.claude:/home/app/.claude
      - ~/.claude.json:/home/app/.claude.json
      - ${SSH_KEY_PATH:-~/.ssh}:/home/app/.ssh:ro
    environment:
      - DATA_DIR=/data
      - WORKSPACES_DIR=/workspaces
      - CLAUDE_DIR=/home/app/.claude

  code-server:
    image: codercom/code-server:latest
    ports:
      - "${CODE_SERVER_PORT:-8443}:8080"
    volumes:
      - ${DATA_ROOT}/workspaces:/workspaces
    env_file:
      - services/vscode/.env
    entrypoint: ["/bin/sh", "-c"]
    command: ['if [ -n "$$PASSWORD" ]; then exec code-server --auth password /workspaces; else exec code-server --auth none /workspaces; fi']

networks:
  dev-center-net:
    driver: bridge
```

---

## Error Handling

- All routes decorated with `@auto_handle_errors` — unhandled exceptions return HTTP 500 with full traceback in `FASTAPI_DEBUG_MODE=true` only, generic message in production.
- Session start failure (claude not in PATH, workspace missing, port conflict) → HTTP 422 with `{ "error": "<message>" }`.
- Git clone failure → WebSocket `{ "type": "done", "success": false, "error": "..." }`, partial workspace cleaned up, project entry removed from state.
- Auth flow timeout → WebSocket closes with `{ "done": true, "success": false }` after 5 minutes.
- Rules file missing (workspace not cloned yet) → 404 with `{ "error": "workspace not ready" }`.

---

## Testing Strategy

- **Backend:** pytest with `httpx.AsyncClient` against a real FastAPI test app. `StateManager` uses a `tmp_path` fixture. Subprocess calls (`asyncio.create_subprocess_exec`) mocked via `unittest.mock.patch`. Auth checker reads from a temp `~/.claude` directory. No external network calls in tests.
- **Frontend:** vitest for component logic and API client. No E2E in MVP.
- **One integration test** verifies the full project creation flow end-to-end with a mocked git clone subprocess.
