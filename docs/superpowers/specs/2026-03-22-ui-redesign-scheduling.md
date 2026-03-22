# IDH App — UI Redesign + Session Scheduling — Design Spec

**Date:** 2026-03-22
**Status:** Approved

---

## Goal

Full redesign of the IDH App frontend (project pages, monitoring, global settings) into a modern
tech-SaaS dark UI, while adding session scheduling, per-project config overrides, and several
UX innovations (auto-renew, context meter, log search, transcript chat view, quick commands).

---

## Architecture Overview

This spec covers changes across three layers:

1. **Design system** — evolve `theme.ts` tokens
2. **Frontend** — restructure pages and add new components
3. **Backend** — new data models, endpoints, and the `SchedulerService`

No existing backend routes are removed. All new endpoints follow the `/api/v1` prefix and
`@auto_handle_errors` convention.

---

## 1. Design System — `theme.ts`

Replace existing color tokens with this evolved palette (same OLED dark base, tightened
hierarchy):

```ts
colors: {
  bg:              '#030712',   // OLED near-black
  surface:         '#0D1117',   // Cards and panels (was #0F172A)
  surfaceElevated: '#161B22',   // Inputs, hover states (was #1E293B)
  surfaceHover:    '#21262D',   // Hover target overlay

  border:          '#21262D',   // Default border (was #1E293B)
  borderSubtle:    '#161B22',   // Subtle border — kept, value updated (was #0F172A)
  borderAccent:    '#30363D',   // Interactive/focused border (new)

  primary:         '#2F81F7',   // Blue primary (was #2563EB — brighter on dark)
  primaryHover:    '#1F6FEB',
  accent:          '#8B5CF6',   // Purple — Telegram/agent distinction (replaces orange)
  accentHover:     '#7C3AED',
  cta:             '#F97316',   // Orange CTA — was `accent`, renamed to `cta`
  ctaHover:        '#EA6C0A',

  success:         '#3FB950',   // Green (was #10B981)
  successBg:       '#0F2D1A',
  warning:         '#D29922',   // Amber (was #F59E0B)
  warningBg:       '#2D1F0A',
  danger:          '#F85149',   // Red (was #EF4444)
  dangerBg:        '#2D0F0F',
  info:            '#60A5FA',
  infoBg:          '#0E1E35',

  text:            '#E6EDF3',   // Primary text (was #F1F5F9)
  textSecondary:   '#8B949E',   // Secondary text
  muted:           '#7D8590',   // Captions, placeholders (was #64748B)
  link:            '#60A5FA',
  onPrimary:       '#FFFFFF',

  terminalBg:      '#010409',   // Terminal panel bg (was #020617)
}
```

**Breaking token changes — migration required:**

- `accent` (`#F97316` orange) is renamed to `cta`. Any existing usage of
  `theme.colors.accent` must be replaced with `theme.colors.cta`.
  Search: `theme.colors.accent` — expected occurrences: Dashboard `ProjectCard.tsx`
  (create button hover), `Layout.tsx` (none expected), `NewProject` wizard (CTA button).
  All must be updated to `theme.colors.cta` in the same PR as the theme change.
- `borderSubtle` value changes from `#0F172A` to `#161B22` — no reference updates needed,
  the visual difference is negligible.
- New token `accent` is now purple (`#8B5CF6`) — used only in new code (Telegram card
  border, agent-related UI). No existing component uses this new value.

Add new tokens:
```ts
font: {
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",  // upgrade
}
```

All other tokens (`spacing`, `radius`, `shadow`, `transition`, `sidebar`) remain unchanged.

---

## 2. Project Page — 3 Tabs

Replace existing 4-tab structure (`overview / bridge / memory / settings`) with 3 tabs.

```
type Tab = 'overview' | 'telegram' | 'code-session'
```

### 2.1 — Overview Tab (redesigned)

Two-column layout: left = project identity card, right = two stacked status cards.

**Left — Project card:**
- Project name (`project.projectId`) large bold
- Repo URL as a clickable `<a>` link (mono font, truncated with title tooltip)
- `project.groupId` in a mono chip below

**Right — Two stacked cards:**

*Telegram Agent card* (purple accent border when state ≠ idle):
- Pulsing dot + status text ("Active" / "Idle")
- Group ID (mono)
- Model badge: pill showing provider/model (e.g. "Claude Sonnet 4.6")
- Last activity timestamp (if available from transcript, else "–")

*Code Session card* (blue accent border when bridge active):
- Pulsing dot + bridge status
- PID in mono (if active)
- Workspace path (truncated, full on hover)
- Countdown timer — large, turns `warning` color when < 60 min
- Auto-Renew toggle: a pill-shaped toggle `[○ Auto-Renew]` that becomes
  `[● Auto-Renew]` when enabled. Stored as `auto_renew: bool` on `BridgeState`.

**Quick Actions strip** (full width below cards):
Row of secondary buttons: `Start Bridge` / `Stop Bridge` / `Renew` — same logic as
current BridgeTab but inline. Visible only in relevant state.

**Context Size Meter** (bottom of overview, always visible):
A labeled horizontal progress bar:
```
Context budget ──────────────────────────── 14,200 / ~200,000 tokens
[████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░]  7%
CLAUDE.md 8,400  •  System Prompt 4,200  •  SESSION_MEMORY.md 1,600
```
Color: green < 50%, orange 50–80%, red > 80%.
Data source: new `GET /api/v1/settings/{groupId}/context-size` endpoint.

---

### 2.2 — Telegram Tab

Two-column layout (60/40 split):

**Left panel — configuration:**

*AI Model* section card:
- `ModelSelector` dropdown
- Save button

*System Prompt* section card:
- `<textarea>` (10 rows, resizable, monospace)
- Character count + estimated token hint (`~{n} tokens`) below the textarea
- Save button

*SESSION_MEMORY.md* section card:
- `MarkdownEditor` component (existing)
- Sub-header shows word count + last modified timestamp (ISO to local)
- Save button + Reset button (clears to empty with confirmation dialog)

**Right panel — context:**

*Agent State* section card:
- Read-only display of `project.bridge` presence as a status line
- Placeholder for future `state` field from the Telegram agent

*Quick Commands* section card:
- Label: "Inject into agent"
- Pre-defined command chips (pills, clickable):
  - "Show progress summary"
  - "Commit and push current changes"
  - "Run tests and report"
  - "+ Add custom command" (opens a small inline form to create a custom chip,
    stored in `localStorage` per project)
- Clicking a chip copies the text to clipboard and shows a brief "Copied!" toast.

---

### 2.3 — Code Session Tab

This tab has **4 sub-tabs**:

```
type CodeSessionSubTab = 'bridge' | 'files' | 'transcript' | 'schedule'
```

Sub-tab bar rendered as a secondary (smaller, indented) tab strip below the main tab bar.

#### Sub-tab A — Bridge

- Compact status bar (single row):
  `[● Active  PID 12847  Expires in 2h 14m]  [Renew]  [Stop]`
  or when idle: `[○ No bridge running]  [Start Bridge]`
- Auto-Renew status shown as a small pill: `[● Auto-Renew ON]` or `[○ Auto-Renew OFF]` —
  clicking toggles it (calls `PUT /api/v1/bridge/{groupId}/auto-renew`).
- Live output panel: same WebSocket streaming as current BridgeTab.
  - Add a search bar above the log panel: `<input placeholder="Filter output…" />` that
    filters displayed lines client-side (no server call).
- Error display below status bar (same pattern as current).

#### Sub-tab B — Files

*CLAUDE.md* section card:
- `MarkdownEditor` component
- Section header shows: "CLAUDE.md" + last-modified badge + Save button
- Diff badge: after any unsaved change, show `[+N / −M lines]` pill next to the title.
  Computed client-side by comparing current value to last-saved value.

#### Sub-tab C — Transcript

- Toggle bar: `[Raw]  [Chat]` — switches between two views.
- **Raw view**: same as current MemoryTab transcript viewer (terminal bg, monospace,
  pre-wrap, scrollable).
- **Chat view**: renders transcript as conversation bubbles. Lines starting with "Human:"
  or "User:" are right-aligned blue bubbles; lines starting with "Assistant:" are
  left-aligned surface bubbles. Other lines are rendered as small muted banners.
- Search bar above: filters visible lines/bubbles in both views client-side.
- Loads from `GET /api/v1/memory/{projectId}/transcript`.

#### Sub-tab D — Schedule

*Session schedule config for this project.*

- Toggle: `[○ Inherit global defaults]  [● Custom schedule]`
  - "Inherit global defaults" maps to `project.schedule === null` in the state model.
    In this mode, render a read-only preview of the global schedule by calling
    `getGlobalScheduling()` — this is a second API call made only when the tab mounts
    in inherit mode.
  - "Custom schedule" maps to `project.schedule` being a `ScheduleConfig` object.
    Switching from inherit to custom initialises with a copy of the global defaults
    (fetched via `getGlobalScheduling()`) so the user starts from a sensible baseline.
  - Saving while in "Custom" mode calls `PUT /api/v1/settings/{groupId}/schedule` with the
    `ScheduleConfig` body.
  - Reverting to "Inherit" calls `PUT /api/v1/settings/{groupId}/schedule` with a `null`
    body (JSON `null`). The backend endpoint must accept `null` and store
    `project.schedule = None`.
  When "Custom schedule", show the full schedule editor (same UI as Global Settings
  Scheduling section, described in §4.4).
- **Schedule editor:**
  - List of time windows. Each window row:
    `[08:00] → [16:00]  [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]  [×]`
    Days are clickable pills that toggle on/off.
  - `[+ Add window]` button appends a new row with default `00:00 → 08:00`, all days on.
  - Sliders:
    - "Warn me N minutes before end" (15 to 180, step 15, default 60)
    - "Repeat warning every N minutes" (5 to 60, step 5, default 10)
  - Telegram alert message template (textarea, shows what will be sent):
    `⏰ Session ending in {remaining}. Ready to transition? [✅ Now] [⏳ +30 min] [🔄 Wait]`
    Editable.
  - Save button.
- **Next transition panel** (read-only, shown when schedule is active):
  Countdown to the next scheduled start or stop, plus the next window label.
  `Next: Stop in 1h 23m  ·  Then: Start at 16:00`

Data source: `GET/PUT /api/v1/settings/{groupId}/schedule`

---

## 3. Monitoring Page (redesigned)

Replaces the current simple table. Four sections:

### 3.1 — Stat Cards (keep existing)

Three cards: Total Projects, Active Bridges, Idle Projects.
Keep current `StatCard` component, update colors to new palette.

### 3.2 — Session Timeline (new)

A horizontal Gantt-style timeline widget.
- Y-axis: one row per project (project name)
- X-axis: current time ± 24h (centered on now)
- Blocks: colored rectangles for scheduled/active windows
  - Active bridge: solid `primary` color
  - Scheduled future window: `primary` at 30% opacity
  - Past window: `muted` at 20% opacity
- "Now" marker: a vertical dashed line
- Upcoming transitions highlighted with a warning dot

Data source: `GET /api/v1/monitoring/timeline` — returns per-project schedule windows
expanded into absolute timestamps for the next 48h.

### 3.3 — Upcoming Transitions (new)

A compact list of imminent transitions across all projects, sorted by time:
```
Patrimonium  —  Stop in 1h 23m          [Prepare now]
Dev-Center   —  Start in 3h 05m         [View]
```
"Prepare now" triggers the same renew flow. "View" navigates to the project.
Data source: derived from monitoring timeline response.

### 3.4 — Activity Log (new)

A chronological feed of recent events across all projects:
```
14:32:01  Patrimonium   Bridge started (PID 18293)
14:30:00  Dev-Center    Telegram alert sent — "Session ending in 1h"
12:15:44  Dev-Center    Bridge renewed (old PID 17102 → new PID 18102)
09:00:00  Patrimonium   Bridge auto-started by scheduler (window: 08:00–16:00)
```
Scrollable panel, max 100 events.
Data source: `GET /api/v1/monitoring/activity` — returns recent log entries from a
new in-memory `ActivityLog` service (ring buffer, 200 entries max).

Auto-refresh every 15s (same as current, keep existing pattern).

---

## 4. Global Settings Page (extended)

Existing 2-tab structure (`coding-rules / common-context`) gains 2 new tabs.

```
type Tab = 'coding-rules' | 'common-context' | 'defaults' | 'scheduling'
```

### 4.1 — Coding Rules (unchanged)

Keep existing `RulesFilesManager` component.

### 4.2 — Common Context (unchanged)

Keep existing `CommonContextEditor` component.

### 4.3 — Defaults (new tab)

Default values applied automatically to every new project at creation time.

- **Default AI model**: `ModelSelector` + Save
- **Default bridge TTL**: slider (1h → 24h, step 1h, default 8h). Shown as
  `{n} hours`. Saves to `PUT /api/v1/settings/global/defaults`.
- **Default Telegram system prompt**: `<textarea>` (6 rows) + Save

### 4.4 — Scheduling (new tab)

Global session scheduling defaults. Same editor UI as §2.3 sub-tab D (Schedule),
but applies to all projects that have "Inherit global defaults" toggled on.

- Master ON/OFF toggle for the scheduling system
- Schedule windows editor (same component, reused)
- Warning lead time + frequency sliders
- Telegram alert template textarea

Data source: `GET/PUT /api/v1/settings/global/scheduling`

---

## 5. Backend — New Data Models

### 5.1 — Extend `BridgeState` (state/models.py)

```python
class BridgeState(_CamelModel):
    pid: int
    workspace: str
    expires_at: str
    auto_renew: bool = False          # new — auto-renew toggle
```

### 5.2 — New `ScheduleWindow` model

```python
class ScheduleWindow(_CamelModel):
    start_time: str   # "HH:MM" 24h format, e.g. "08:00"
    end_time: str     # "HH:MM" 24h format, e.g. "16:00"
    days: list[str]   # ["mon","tue","wed","thu","fri","sat","sun"]
```

### 5.3 — New `ScheduleConfig` model

```python
class ScheduleConfig(_CamelModel):
    enabled: bool = False
    windows: list[ScheduleWindow] = []
    warn_lead_minutes: int = 60       # warn this many minutes before end
    warn_interval_minutes: int = 10   # resend warning every N minutes
    alert_template: str = (
        "⏰ Session ending in {remaining}. Ready to transition? "
        "[✅ Now] [⏳ +30 min] [🔄 Wait]"
    )
```

### 5.4 — Extend `Project` model

```python
class Project(_CamelModel):
    group_id: str
    project_id: str
    repo_url: str
    bridge: BridgeState | None = None
    model_override: ModelOverride | None = None
    schedule: ScheduleConfig | None = None    # new — None = inherit global
```

### 5.5 — New `GlobalConfig` model (stored in one JSON file)

`GlobalDefaults` and the global `ScheduleConfig` are both fields of a single root model
`GlobalConfig`, stored at `{PATH_DATA}/idh-global-config.json`. There is only one file
and one model — `GlobalScheduleConfig` is not a separate class; it reuses `ScheduleConfig`
defined in §5.3.

```python
class GlobalDefaults(_CamelModel):
    default_provider: str = "anthropic"
    default_model: str = "claude-sonnet-4-6"
    default_bridge_ttl_hours: int = 8
    default_telegram_prompt: str = ""


class GlobalConfig(_CamelModel):
    """
    Root structure of idh-global-config.json.
    Holds defaults applied to new projects and the global scheduling config.
    """
    defaults: GlobalDefaults = GlobalDefaults()
    schedule: ScheduleConfig = ScheduleConfig()   # reuses §5.3 model
```

`GlobalConfigManager` (§7, new service) reads/writes this file.

**Applying defaults at project creation time:**
The existing `POST /api/v1/projects/` route (in `backend/routers/projects/router.py`)
must be updated to read `CONTEXT.global_config_manager.get_config()` and populate the
new project's `model_override` from `defaults.default_provider` / `defaults.default_model`
if the creation request does not supply a model override. The `default_bridge_ttl_hours`
value is passed to `BridgeManager.start_bridge()` when starting the first bridge for
the project. The `default_telegram_prompt` is written to the project's system prompt file
via `CONTEXT.openclaw_writer` at creation time. This requires `backend/routers/projects/router.py`
to be added to the modified files list.

### 5.6 — New `ActivityEntry` model (in-memory only)

Extends `_CamelModel` so Pydantic serialises it with camelCase aliases for the monitoring
endpoint — matching the frontend TypeScript interface in §9.

```python
class ActivityEntry(_CamelModel):
    """
    Single activity log entry.

    Attributes:
        timestamp (str): ISO-8601 UTC timestamp of the event.
        group_id (str): Telegram group ID of the affected project.
        project_id (str): Project slug.
        event (str): Human-readable description, e.g. "Bridge started (PID 18293)".
        level (str): Severity — "info" | "warning" | "error".
    """
    timestamp: str
    group_id: str
    project_id: str
    event: str
    level: str = "info"
```

---

## 6. Backend — New Endpoints

All new endpoints live in new or extended routers, follow `@auto_handle_errors`, and
use `/api/v1` prefix.

### 6.1 — Extend Bridge Router

| Method | Path | Purpose |
|--------|------|---------|
| `PUT` | `/bridge/{group_id}/auto-renew` | Toggle `auto_renew` on `BridgeState` |

Request body: `{ "autoRenew": bool }`
Response: `BridgeActionResponse`

### 6.2 — Extend Settings Router (per-project)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/settings/{group_id}/context-size` | Token count per file |
| `GET` | `/settings/{group_id}/schedule` | Per-project schedule config |
| `PUT` | `/settings/{group_id}/schedule` | Save per-project schedule config |

`context-size` response:
```json
{
  "total": 14200,
  "claudeMd": 8400,
  "systemPrompt": 4200,
  "sessionMemory": 1600,
  "estimatedMax": 200000
}
```
Token count uses a simple 4-chars-per-token heuristic (no external library needed).

**Path resolution for each component** (handler calls CONTEXT services already used by
existing routes in the same router):
- `claudeMd`: read via `CONTEXT.openclaw_writer.get_claude_md(group_id)` or directly from
  `RUNTIME_CONFIG.PATH_WORKSPACES / project.project_id / "CLAUDE.md"`.
- `systemPrompt`: read via `CONTEXT.openclaw_writer` — the same path already used by
  `GET /settings/{group_id}/telegram-prompt`.
- `sessionMemory`: read via `CONTEXT.memory_manager` — the same path already used by
  `GET /memory/{project_id}/session-memory`.
- `estimatedMax`: hard-coded constant `200_000` (conservative Claude context window).

`schedule` GET returns the project's `ScheduleConfig` if `project.schedule is not None`,
else `ScheduleConfig()` (defaults). PUT accepts either a `ScheduleConfig` body or JSON
`null` — when `null`, stores `project.schedule = None` (revert to inherit global).

### 6.3 — Extend Settings Router (global)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/settings/global/defaults` | Global default config |
| `PUT` | `/settings/global/defaults` | Save global defaults |
| `GET` | `/settings/global/scheduling` | Global schedule config |
| `PUT` | `/settings/global/scheduling` | Save global schedule |

### 6.4 — New Monitoring Router

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/monitoring/timeline` | Per-project schedule windows, expanded to absolute timestamps ±48h |
| `GET` | `/monitoring/activity` | Last N activity log entries (default 100) |

`timeline` response per project:
```json
{
  "projects": [
    {
      "groupId": "-5104943549",
      "projectId": "Patrimonium",
      "windows": [
        { "start": "2026-03-22T08:00:00Z", "end": "2026-03-22T16:00:00Z", "status": "active" },
        { "start": "2026-03-22T16:00:00Z", "end": "2026-03-23T00:00:00Z", "status": "scheduled" }
      ]
    }
  ]
}
```

---

## 7. Backend — New Services

### 7.1 — `ActivityLog` service (`libs/activity/activity_log.py`)

A thread-safe in-memory ring buffer (200 entries). Receives entries from
`BridgeManager`, `SchedulerService`, etc. via `log(entry)`.

```python
class ActivityLog:
    def log(self, group_id: str, project_id: str, event: str, level: str = "info") -> None
    def recent(self, limit: int = 100) -> list[ActivityEntry]
```

### 7.2 — `SchedulerService` (`libs/scheduler/scheduler.py`)

Background service that drives session scheduling. Runs as an `asyncio.Task` started in
`lifespan.py` alongside the existing bridge watchdog. It is an async class with an
`async def _run_loop()` method so it can `await` bridge manager calls without blocking
the event loop.

```python
class SchedulerService(LoggerClass):
    def __init__(
        self,
        state_manager: StateManager,
        bridge_manager: BridgeManager,
        global_config_manager: GlobalConfigManager,
        activity_log: ActivityLog,
    ) -> None: ...

    async def start(self) -> asyncio.Task:
        """Schedule and return the background asyncio task."""
        return asyncio.create_task(self._run_loop())

    async def _run_loop(self) -> None:
        """Run indefinitely, checking schedules every 60 seconds."""
        while True:
            await asyncio.sleep(60)
            await self._tick()

    async def _tick(self) -> None:
        """Single scheduler pass — scan all projects."""
        ...
```

Responsibilities:
1. `_tick()` every 60 seconds: scan all projects for active schedules.
2. For each project: compute whether the current time is inside a scheduled window.
   - If inside a window and no bridge running: `await bridge_manager.start_bridge(...)`.
   - If outside all windows and bridge running: `await bridge_manager.stop_bridge(group_id)`.
3. Pre-warning phase: if a window ends within `warn_lead_minutes`:
   - Track last-warned timestamp per project in `_warn_state: dict[str, datetime]`.
   - If now >= last_warn + `warn_interval_minutes`: send Telegram alert via
     `TelegramNotifier.send_alert(group_id, message)` and update `_warn_state`.
4. Auto-renew: if `bridge.auto_renew is True` and bridge expires within 5 minutes:
   `await bridge_manager.renew_bridge(group_id)`.

The scheduler resolves the effective schedule for a project:
- If `project.schedule is not None` and `project.schedule.enabled` → use project schedule.
- Else if `global_config.schedule.enabled` → use global schedule.
- Else → no scheduling for this project.

Window boundary logic: `start_time` and `end_time` are local wall-clock HH:MM strings.
The scheduler parses them using `datetime.datetime.combine(date.today(), time(...))` in
the host's local timezone. Day filtering uses `datetime.today().weekday()` mapped to
`["mon","tue","wed","thu","fri","sat","sun"]`.

### 7.3 — `TelegramNotifier` (`libs/scheduler/telegram_notifier.py`)

Sends Telegram messages for session transition alerts.

```python
class TelegramNotifier(LoggerClass):
    def __init__(self, bot_token: str) -> None: ...
    async def send_alert(self, group_id: str, message: str) -> None: ...
```

The bot token is read from `RUNTIME_CONFIG.TELEGRAM_BOT_TOKEN` (an existing env var —
the same token used by the Telegram gateway service). If this attribute does not yet
exist on `RUNTIME_CONFIG`, add it as:
```python
TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN")
```
This requires adding `TELEGRAM_BOT_TOKEN` to `runtime_config.py` and to `services/idh-app/.env`.
`runtime_config.py` must therefore be added to the modified files list.

`send_alert` calls `POST https://api.telegram.org/bot{token}/sendMessage` with
`chat_id = group_id` and `text = message`. Uses `aiohttp` or `httpx` (whichever is
already in the project's `pyproject.toml` — check before adding a dependency).

The `SchedulerService` formats `alert_template` before calling `send_alert`:
```python
remaining = _format_remaining(project.bridge.expires_at)  # e.g. "47 minutes"
message = schedule.alert_template.format(remaining=remaining)
```

---

## 8. Frontend — New API Functions

New functions to add to `src/api/`:

In `settings.ts`:
- `getContextSize(groupId: string): Promise<ContextSizeResponse>`
- `getProjectSchedule(groupId: string): Promise<ScheduleConfig>`
- `putProjectSchedule(groupId: string, config: ScheduleConfig): Promise<FileWriteResponse>`
- `getGlobalDefaults(): Promise<GlobalDefaults>`
- `putGlobalDefaults(defaults: GlobalDefaults): Promise<FileWriteResponse>`
- `getGlobalScheduling(): Promise<ScheduleConfig>`
- `putGlobalScheduling(config: ScheduleConfig): Promise<FileWriteResponse>`

In `bridge.ts`:
- `putAutoRenew(groupId: string, autoRenew: boolean): Promise<BridgeActionResponse>`

New file `src/api/monitoring.ts`:
- `getTimeline(): Promise<TimelineResponse>`
- `getActivityLog(limit?: number): Promise<ActivityLogResponse>`

---

## 9. Frontend — New Types (`api/types.ts` additions)

```typescript
export interface ScheduleWindow {
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  days: string[];      // ["mon","tue","wed","thu","fri","sat","sun"]
}

export interface ScheduleConfig {
  enabled: boolean;
  windows: ScheduleWindow[];
  warnLeadMinutes: number;
  warnIntervalMinutes: number;
  alertTemplate: string;
}

export interface GlobalDefaults {
  defaultProvider: string;
  defaultModel: string;
  defaultBridgeTtlHours: number;
  defaultTelegramPrompt: string;
}

export interface ContextSizeResponse {
  total: number;
  claudeMd: number;
  systemPrompt: number;
  sessionMemory: number;
  estimatedMax: number;
}

export interface TimelineWindow {
  start: string;    // ISO-8601
  end: string;      // ISO-8601
  status: 'active' | 'scheduled' | 'past';
}

export interface TimelineProject {
  groupId: string;
  projectId: string;
  windows: TimelineWindow[];
}

export interface TimelineResponse {
  projects: TimelineProject[];
}

export interface ActivityEntry {
  timestamp: string;
  groupId: string;
  projectId: string;
  event: string;
  level: 'info' | 'warning' | 'error';
}

export interface ActivityLogResponse {
  entries: ActivityEntry[];
}
```

Also extend `BridgeState` with `autoRenew: boolean`.
Also extend `Project` with `schedule: ScheduleConfig | null`.

---

## 10. Frontend — New/Reusable Components

- **`ScheduleEditor`** (`components/ScheduleEditor.tsx`): the schedule windows editor.
  Used in both Code Session sub-tab D and Global Settings Scheduling tab.
  Props: `value: ScheduleConfig`, `onChange: (c: ScheduleConfig) => void`.

- **`ContextSizeMeter`** (`components/ContextSizeMeter.tsx`): the horizontal progress bar
  with breakdown legend. Props: `response: ContextSizeResponse`.

- **`ActivityFeed`** (`components/ActivityFeed.tsx`): the chronological log feed.
  Props: `entries: ActivityEntry[]`.

- **`TimelineChart`** (`components/TimelineChart.tsx`): the Gantt-style timeline.
  Built with plain `<div>` elements (no chart library dependency).
  Props: `projects: TimelineProject[]`.

  **Layout rationale:**
  The viewport spans 48 hours (configurable constant `WINDOW_HOURS = 48`). The left
  edge represents `now - 24h`, the right edge `now + 24h`. Block widths and offsets
  are computed as percentages of the total container width:
  ```
  const totalMs = WINDOW_HOURS * 60 * 60 * 1000;
  const leftEdge = Date.now() - (WINDOW_HOURS / 2) * 60 * 60 * 1000;
  const blockLeft  = ((windowStart - leftEdge) / totalMs) * 100;  // %
  const blockWidth = ((windowEnd - windowStart) / totalMs) * 100; // %
  ```
  Blocks with `blockLeft < 0` or `blockLeft + blockWidth > 100` are clamped.
  The "now" marker is a `position: absolute; left: 50%` vertical line.

---

## 11. File Changes Summary

### Modified files (frontend)
- `src/theme.ts` — updated color tokens + mono font
- `src/api/types.ts` — new interfaces, extend existing
- `src/api/settings.ts` — new functions
- `src/api/bridge.ts` — `putAutoRenew`
- `src/pages/Project/ProjectPage.tsx` — 3 tabs, updated routing
- `src/pages/GlobalSettings/SettingsPage.tsx` — 2 new tabs
- `src/pages/Monitoring/MonitoringPage.tsx` — redesigned sections

### New files (frontend)
- `src/api/monitoring.ts`
- `src/components/ScheduleEditor.tsx`
- `src/components/ContextSizeMeter.tsx`
- `src/components/ActivityFeed.tsx`
- `src/components/TimelineChart.tsx`
- `src/pages/Project/tabs/OverviewTab.tsx` — full rewrite
- `src/pages/Project/tabs/TelegramTab.tsx` — new (was SettingsTab partially)
- `src/pages/Project/tabs/CodeSessionTab.tsx` — new wrapper with sub-tabs
- `src/pages/Project/tabs/code-session/BridgeSubTab.tsx`
- `src/pages/Project/tabs/code-session/FilesSubTab.tsx`
- `src/pages/Project/tabs/code-session/TranscriptSubTab.tsx`
- `src/pages/Project/tabs/code-session/ScheduleSubTab.tsx`
- `src/pages/GlobalSettings/DefaultsEditor.tsx`
- `src/pages/GlobalSettings/SchedulingEditor.tsx`

### Deleted files (frontend)
- `src/pages/Project/tabs/BridgeTab.tsx` — replaced by `CodeSessionTab` + `BridgeSubTab`
- `src/pages/Project/tabs/MemoryTab.tsx` — content moved to `TelegramTab` + `TranscriptSubTab`
- `src/pages/Project/tabs/SettingsTab.tsx` — content split to `TelegramTab` + `FilesSubTab`

### Modified files (backend)
- `libs/state/models.py` — extend `BridgeState`, `Project`; add `ScheduleWindow`, `ScheduleConfig`, `GlobalDefaults`, `GlobalConfig`, `ActivityEntry`
- `backend/routers/bridge/router.py` — add `PUT /bridge/{group_id}/auto-renew`
- `backend/routers/settings/router.py` — add context-size + schedule + global defaults/scheduling endpoints
- `backend/routers/projects/router.py` — apply global defaults at project creation
- `backend/routers/__init__.py` — export `monitoring_router`
- `backend/context.py` — add `activity_log`, `scheduler`, `global_config_manager`
- `backend/lifespan.py` — instantiate `ActivityLog`, `GlobalConfigManager`, `SchedulerService`; start scheduler task; add to shutdown guards
- `backend/app.py` — register monitoring router
- `config/runtime/runtime_config.py` — add `TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN")`
- `services/idh-app/.env` — add `TELEGRAM_BOT_TOKEN=<value>` (document in env file, do not commit the actual token)

### New files (backend)
- `libs/scheduler/scheduler.py` — `SchedulerService`
- `libs/scheduler/telegram_notifier.py` — `TelegramNotifier`
- `libs/scheduler/__init__.py`
- `libs/activity/activity_log.py` — `ActivityLog`
- `libs/activity/__init__.py`
- `libs/global_config/global_config_manager.py` — `GlobalConfigManager` (read/write `idh-global-config.json`)
- `libs/global_config/__init__.py`
- `backend/routers/monitoring/router.py`
- `backend/routers/monitoring/models.py`
- `backend/routers/monitoring/__init__.py`
- `backend/routers/settings/models.py` additions (ContextSizeResponse, ScheduleConfigResponse, etc.)

---

## 12. Routing Changes

Current URL: `/projects/:groupId/bridge` used by `MonitoringPage` links.
New URL structure:
- `/projects/:groupId` → defaults to `overview` tab
- `/projects/:groupId/telegram`
- `/projects/:groupId/code-session` → defaults to `bridge` sub-tab
- `/projects/:groupId/code-session/files`
- `/projects/:groupId/code-session/transcript`
- `/projects/:groupId/code-session/schedule`

Tab state is reflected in the URL (React Router `useParams` / `useNavigate`).
Old URL `/projects/:groupId/bridge` redirects to `/projects/:groupId/code-session`.

**BridgeRow link migration:** The existing `MonitoringPage.tsx` `BridgeRow` component
(line 63) has a `Link` pointing to `/projects/${encodeURIComponent(project.groupId)}/bridge`.
This must be updated to `/projects/${encodeURIComponent(project.groupId)}/code-session`
as part of the MonitoringPage redesign task.

---

## 13. Out of Scope

- Telegram bot inbound response handling (the bot receiving "✅ Now" / "⏳ +30 min" replies
  is not in this spec — alert sending only is in scope). Inbound handling is a separate feature.
- Mobile/responsive layout: the app targets desktop browsers inside a local network.
- Dark/light mode toggle: OLED dark only.
- Real-time push from server to Monitoring page (polling every 15s is sufficient).
