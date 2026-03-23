# UI Redesign — IDH App Frontend

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Complete frontend redesign — layout, navigation, all pages, theme

---

## 1. Design Direction

**Inspiration:** Linear, Vercel, Railway — ops/DevOps dashboard aesthetic.
**Principles:** Sober, dense, readable, no decorative elements. Every pixel carries information.
**Key terminology change:** "bridge" is replaced everywhere by "session Telegram" and "session code".

---

## 2. Theme

### Colors

| Token | Value | Usage |
|---|---|---|
| `bg` | `#0a0a0a` | Page background |
| `surface` | `#111111` | Cards, panels |
| `border` | `#222222` | Card borders, dividers |
| `borderStrong` | `#333333` | Active states, focus rings |
| `text` | `#fafafa` | Primary text |
| `textSecondary` | `#a1a1aa` | Labels, secondary info |
| `muted` | `#52525b` | Disabled, placeholders |
| `accent` | `#ffffff` | Interactive elements, buttons |
| `active` | `#22c55e` | Session active, healthy |
| `warning` | `#f97316` | Expiring soon, warnings |
| `danger` | `#ef4444` | Errors, critical |
| `nav` | `#111111` | Top navigation bar |
| `navBorder` | `#1f1f1f` | Bottom border of nav |

### Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Body | Inter | 400/500 | All UI text |
| Labels | Inter | 500 | Uppercase + letter-spacing for section headers |
| Mono | Geist Mono | 400 | Models, timestamps, IDs, countdowns |

No display fonts (Teko removed). No acid green accent.

### Spacing & Radius

- Base unit: 4px
- Card padding: 16px
- Section gap: 24px
- Border radius: 6px (cards), 4px (buttons/inputs), 2px (badges)

---

## 3. Layout

### Top Navigation (fixed, full width)

```
[IDH]    Home  Monitoring  Settings              [+ New Project]
```

- Height: 48px
- Background: `#111111`, bottom border: `#1f1f1f`
- Logo: "IDH" in Inter 600, white
- Nav links: Inter 500, `#a1a1aa` default → `#fafafa` active, underline active state
- "+ New Project" button: white background, black text, 500 weight, right-aligned
- No sidebar — full page width below nav

### Content area

- Max width: 1200px, centered
- Padding: 0 24px
- Top padding below nav: 32px

---

## 4. Pages

### 4.1 Home (`/`)

**Stats strip** — 4 chips in a horizontal row, small, low visual weight:

```
● 3 sessions actives    ○ 2 projets idle    ⚠ 1 expiration proche    ✦ 5 projets total
```

Each chip: icon + count + label, muted background, subtle border.

**Main grid — 2 columns (60% / 40%)**

**Left column — Projects**

Section header: `PROJECTS` (uppercase, Inter 500, muted) + `+ New` button (ghost, right-aligned).

One card per project:

```
┌─────────────────────────────────────────────────────┐
│ ● my-project                    [SESSION ACTIVE]    │
│   github.com/org/repo                               │
│                                                     │
│   Telegram   anthropic · claude-opus-4-6            │
│   Code       anthropic · claude-sonnet-4-6          │
│                                                     │
│   Session code expire dans  1h 42m              [→] │
└─────────────────────────────────────────────────────┘
```

Idle project:
```
┌─────────────────────────────────────────────────────┐
│ ○ other-project                 [IDLE]              │
│   github.com/org/repo2                              │
│                                                     │
│   Telegram   anthropic · claude-opus-4-6            │
│   Code       —                                      │
│                                                 [→] │
└─────────────────────────────────────────────────────┘
```

- Status dot: green pulse (active) or muted static (idle)
- Badge: `SESSION ACTIVE` green bg / `IDLE` muted bg
- Countdown shown only when session code active, turns orange < 30 min
- `[→]` arrow links to project detail page

**Right column — Recent Activity**

Section header: `RECENT ACTIVITY` + last-updated timestamp (muted, right).

Feed of 20 most recent events, style:
```
14:32  session_started   my-project
14:28  warning_sent      other-project   15 min
14:15  session_renewed   my-project
13:50  project_created   new-api
```

- Each row: timestamp (mono, muted) + event type (colored by type) + project name
- Event type colors: `session_started/renewed` → green, `warning_sent` → orange, `session_stopped` → muted, `project_created` → white
- Scrollable, max height fills the column
- Data source: `getActivityLog(20)` from `api/monitoring.ts` — existing endpoint, no new API needed
- Auto-refreshes every 15 seconds

---

### 4.2 Project Page (`/projects/:groupId`)

**Header strip** (48px, below nav):
```
← Projects    my-project    ● SESSION ACTIVE    1h 42m restant    [Arrêter]  [Renouveler]
```
- Breadcrumb: `← Projects` (link back)
- Project name: Inter 600, white
- Status badge inline
- Countdown: Geist Mono, color-coded
- Action buttons right-aligned: primary action (Démarrer/Arrêter) + secondary (Renouveler, only when active)

**Tab bar** (below header, 40px):
```
OVERVIEW    SESSION TELEGRAM    SESSION CODE
```
Active tab: white text + 2px bottom border white. Inactive: muted text.

**Tab content area** — padding 24px 0.

#### OVERVIEW tab

2-column layout (50/50):

Left:
- **Session code** card — status badge + countdown + buttons (Démarrer / Arrêter / Renouveler)
- **Session Telegram** card — status badge (always active) + current model

Right:
- **Context Budget** card — progress bar + breakdown (CLAUDE.md / System Prompt / Session Memory), percentage + raw counts
- **Projet** card — Repo URL (link), Group ID, Project ID (all in Geist Mono)

#### SESSION TELEGRAM tab

Two cards stacked:

1. **Modèle** — ModelSelector dropdown + Save button
2. **Prompt personnalisé** — Textarea (markdown) + Save button

#### SESSION CODE tab

Three cards stacked:

1. **Modèle** — ModelSelector dropdown + Save button
2. **Plages horaires actives** — simplified schedule editor (see Section 5)
3. **Règles de code (CLAUDE.md)** — Markdown editor + Save button

---

### 4.3 Monitoring (`/monitoring`)

**Header:**
```
MONITORING    ● LIVE    mis à jour il y a 3s    [↻ Rafraîchir]
```

**Stats row:**
```
3 actives    12 événements aujourd'hui    1 warning    0 erreurs
```

**2-column grid (50/50):**

Left — **Événements live** (WebSocket)
- Section header with `● LIVE` pulse indicator
- Real-time feed, same row format as home activity feed
- New events prepended at top
- Max height: fills viewport

Right — **Log d'activité**
- Section header + entry count
- Filter bar: dropdown by project + dropdown by event type
- Scrollable list of up to 200 entries
- Empty state: "Aucune activité enregistrée"

---

### 4.4 Settings (`/settings`)

**Tab bar:**
```
TELEGRAM    CODE SESSION
```

#### TELEGRAM tab

Default values applied to every new project's Telegram session:

- **Modèle par défaut** — ModelSelector
- **Contexte par défaut** — Textarea (markdown prompt injected into every agent)

#### CODE SESSION tab

Default values applied to every new project's code session:

- **Modèle par défaut** — ModelSelector
- **Règles de code globales (CLAUDE.md)** — Markdown editor (global coding rules)
- **Contexte commun** — Textarea (context injected into every code session)
- **Plages horaires par défaut** — simplified schedule editor (see Section 5)

---

### 4.5 New Project Wizard (`/projects/new`)

3 steps, centered card layout:

1. **Dépôt** — GitHub repo URL input + validation
2. **Modèle** — ModelSelector for the **code session only** (pre-filled with default from Settings → Code Session). Telegram model is automatically set from the global default — no user input needed.
3. **Confirmation** — summary card + Create button

Progress indicator: `1 · 2 · 3` at top of card.

---

## 5. Simplified Schedule Editor

Replaces the current complex ScheduleEditor. The user specifies only **active time ranges** — the backend handles start/stop automatically.

**UI:**

```
Plages horaires actives

  [ 08:00 ] → [ 00:00 ]   [×]
  [ Add a range ]

  Jours actifs
  [L] [M] [M] [J] [V] [S] [D]   (tous sélectionnés par défaut)

  [ Démarrer manuellement ]   (always available, overrides schedule)
```

- Each range: start time input + end time input + remove button
- "+ Add a range" adds a new row (max 3 ranges)
- Days: toggles, all selected by default
- Manual start button always visible — starts/stops immediately regardless of schedule
- No warnLeadMinutes, no alertTemplate, no warnIntervalMinutes — backend handles all that

**Data model simplification:**
```typescript
interface ScheduleConfig {
  enabled: boolean;
  ranges: Array<{ start: string; end: string }>;  // "08:00" → "00:00"
  days: string[];  // ["mon","tue","wed","thu","fri","sat","sun"] = all days
}
```

---

## 6. Shared Components (updated/simplified)

| Component | Change |
|---|---|
| `StatusBadge` | Simplified: `active` (green) / `idle` (muted) / `warning` (orange) / `error` (red) |
| `CountdownTimer` | Keep, update colors to new palette |
| `ModelSelector` | Keep, restyle to match new theme |
| `ContextSizeMeter` | Keep, restyle to match new theme |
| `ScheduleEditor` | Replace entirely with `TimeRangeScheduler` (simpler, see Section 5) |
| `ActivityFeed` | Keep, restyle rows |
| `EventFeed` | Keep, restyle rows |

---

## 7. Files to Create / Replace

### New files
- `src/theme.ts` — complete rewrite with new palette
- `src/App.tsx` — top nav layout, remove sidebar
- `src/pages/Dashboard/Dashboard.tsx` — rewrite (home with 2-col grid)
- `src/pages/Dashboard/ProjectCard.tsx` — new card component
- `src/pages/Project/ProjectPage.tsx` — rewrite (header + tabs)
- `src/pages/Project/tabs/OverviewTab.tsx` — rewrite
- `src/pages/Project/tabs/TelegramTab.tsx` — rewrite
- `src/pages/Project/tabs/CodeSessionTab.tsx` — rewrite
- `src/pages/Monitoring/MonitoringPage.tsx` — rewrite
- `src/pages/GlobalSettings/SettingsPage.tsx` — rewrite (2 tabs)
- `src/components/TimeRangeScheduler.tsx` — new component replacing ScheduleEditor

### Files to remove
- `src/components/ScheduleEditor.tsx` — replaced by `TimeRangeScheduler`
- `src/pages/GlobalSettings/CodingRulesEditor.tsx` — merged into SettingsPage tabs
- `src/pages/GlobalSettings/CommonContextEditor.tsx` — merged into SettingsPage tabs
- `src/pages/GlobalSettings/DefaultsEditor.tsx` — merged into SettingsPage tabs
- `src/pages/GlobalSettings/SchedulingEditor.tsx` — merged into SettingsPage tabs

### Files to keep (restyle only)
- `src/components/StatusBadge.tsx`
- `src/components/CountdownTimer.tsx`
- `src/components/ModelSelector.tsx`
- `src/components/ContextSizeMeter.tsx`
- `src/components/ActivityFeed.tsx`
- `src/components/EventFeed.tsx`
- `src/api/*` — no changes needed

---

## 8. Backend Impact

### 8.1 ScheduleConfig model change

The new `ScheduleConfig` replaces `{ renewalTimes, days, warnLeadMinutes, warnIntervalMinutes, alertTemplate }` with `{ enabled, ranges, days }`. `warnLeadMinutes`, `warnIntervalMinutes`, and `alertTemplate` are dropped entirely — the backend uses fixed sensible defaults (warn 30 min before range end, repeat every 15 min, generic message).

**Migration strategy for persisted state files** (`idh-projects.state.json`, `idh-global-config.json`):

Both files embed `ScheduleConfig`. A Pydantic `model_validator(mode='before')` on `ScheduleConfig` detects the old format (presence of `renewalTimes` key) and converts it to the new format:
- `renewalTimes: ["08:00", "18:00"]` → `ranges: [{"start": "08:00", "end": "00:00"}]` (end defaults to midnight)
- `days` stays as-is
- Old keys (`renewalTimes`, `warnLeadMinutes`, `warnIntervalMinutes`, `alertTemplate`) are discarded

This validator runs transparently on load — no manual migration script required.

**Files to update:**
- `libs/state/models.py` — `ScheduleConfig` Pydantic model + migration validator
- `libs/scheduler/scheduler_service.py` — interpret `ranges` (start session when time enters range, stop when it exits)
- `backend/routers/settings/router.py` — schedule endpoints accept new schema
- `backend/routers/projects/router.py` — project-level schedule endpoint accepts new schema

### 8.2 Action button visibility rules (Project Page header)

The three action buttons follow these visibility rules:
- **Session idle:** show `[Démarrer]` only
- **Session active:** show `[Arrêter]` + `[Renouveler]`
- `[Renouveler]` is never shown when idle (nothing to renew)

### 8.3 New Project Wizard — single model selector

The wizard step 2 collects **one model** (for the code session only). The Telegram model is not collected during creation — it is automatically set from the global default (`Settings → Telegram → Modèle par défaut`). This keeps `CreateProjectRequest` unchanged. No backend API changes needed for the wizard.

### 8.4 Home page activity feed

The home page right column calls `getActivityLog(20)` from `api/monitoring.ts` and auto-refreshes every 15 seconds. No new endpoint needed — this reuses the existing `GET /api/v1/monitoring/activity?limit=20`.

### 8.5 Project card Telegram model

`ProjectCard` fetches the Telegram model via the existing `getTelegramModel(groupId)` call — one HTTP call per project (N+1). This is acceptable given typical small project counts (< 20). A future aggregated endpoint can be added later if needed; it is not in scope for this redesign.

`telegramPrompt` is not displayed in the project card and remains a separate fetch inside `TelegramTab` only, as today.

---

## 9. Tab label changes

The following tab labels are explicitly changed as part of this redesign:

| Location | Old label | New label |
|---|---|---|
| Project Page | OVERVIEW | OVERVIEW (unchanged) |
| Project Page | TELEGRAM | SESSION TELEGRAM |
| Project Page | CODE SESSION | SESSION CODE |
| Settings | CODING RULES | TELEGRAM |
| Settings | COMMON CONTEXT | CODE SESSION |
| Settings | DEFAULTS | (removed) |
| Settings | SCHEDULING | (removed) |

---

## 10. Out of Scope

- No new API endpoints (except schedule schema update per Section 8.1)
- No new features — this is a pure UI/UX redesign
- No mobile responsiveness (desktop-only app)
- No animations beyond existing status dot pulse
