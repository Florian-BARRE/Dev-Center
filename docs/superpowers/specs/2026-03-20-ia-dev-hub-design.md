# IA-Dev-Hub — Design Specification

**Date:** 2026-03-20
**Status:** Approved

---

## 0. Objective

Deploy a self-hosted, project-centric AI development hub via a single `docker compose up` on a Debian 12 VM (Proxmox). Each Telegram group acts as the console for one Git project. A dedicated web dashboard provides full configuration and monitoring. Two AI agents operate per project: a Telegram-facing conversational agent (Codex) and a coding agent accessed via Claude Code Remote Control.

---

## 1. Infrastructure

### 1.1 Services

Three Docker services share a single internal network (`idh-net`):

| Service | Base Image | Role |
|---|---|---|
| `openclaw-gateway` | `ghcr.io/openclaw/openclaw:latest` | AI agent runtime + Telegram bot + IDH plugin |
| `idh-app` | custom build (FastAPI + React + claude CLI) | Sidecar API + web dashboard + bridge manager |
| `code-server` | `codercom/code-server:latest` | VS Code in browser over shared workspace |

Zoraxy handles reverse-proxying for `openclaw-gateway` (dashboard port) and `code-server`. No app-level auth — network layer handles it.

### 1.2 Volume Mounts

**Host directory layout** (created by `setup.sh` on first run):

```
~/iah/
├── config/          # openclaw.json, agents/, sessions/
├── workspaces/      # all cloned repos (shared across all 3 services)
├── state/           # idh-projects.state.json (owned exclusively by idh-app)
├── rules/
│   ├── CODING_RULES.md       # user's coding standards
│   └── COMMON_CONTEXT.md     # dynamic context template (variables substituted per project)
└── .env             # TELEGRAM_BOT_TOKEN, TELEGRAM_USER_ID, ports, BRIDGE_TTL_HOURS
```

> **Note on `.env` placement:** `~/iah/.env` is intentionally placed in the data directory (not the project source tree) because this is a deployment-time configuration for a live system, not a development config. This is a deliberate exception to the `services/<app_name>/.env` convention from docker.md, which targets application source repositories.

**Per-service mounts:**

```yaml
openclaw-gateway:
  - ~/iah/config     → /home/node/.openclaw
  - ~/iah/workspaces → /workspaces
  - ~/.claude        → /home/node/.claude       :ro
  - ~/.codex         → /home/node/.codex        :ro
  - ./plugin         → /home/node/.openclaw/plugins/idh

idh-app:
  - ~/iah/workspaces → /workspaces
  - ~/iah/state      → /data
  - ~/iah/rules      → /rules                   :ro
  - ~/iah/config     → /openclaw-config          # idh-app is the sole writer of openclaw.json
  - ~/.claude        → /home/app/.claude        :ro
  - ~/.codex         → /home/app/.codex         :ro
  - ~/.ssh           → /home/app/.ssh           :ro

code-server:
  - ~/iah/workspaces → /workspaces
```

### 1.3 Authentication Strategy

No API keys — subscription OAuth only:

| Credential | Mount | Used by |
|---|---|---|
| `~/.claude` | `openclaw-gateway`, `idh-app` | Claude Code Remote Control process |
| `~/.codex` | `openclaw-gateway`, `idh-app` | Codex OAuth in OpenClaw + Codex API for auto-summary |
| `~/.ssh` | `idh-app` | Git clone/fetch via SSH |

OpenClaw uses Codex OAuth only (`openai-codex` provider). Using Claude OAuth in OpenClaw violates Anthropic ToS (blocked server-side since Jan 2026). Claude is exclusively accessed via the Remote Control bridge.

### 1.4 SSH Key Handling

`idh-app` entrypoint copies the SSH mount to a writable temp location and fixes permissions before starting uvicorn:

```bash
cp -r /home/app/.ssh /tmp/.ssh-rw
chmod 700 /tmp/.ssh-rw && chmod 600 /tmp/.ssh-rw/id_*
export GIT_SSH_COMMAND="ssh -i /tmp/.ssh-rw/id_ed25519 \
  -o StrictHostKeyChecking=accept-new \
  -o UserKnownHostsFile=/tmp/.ssh-rw/known_hosts"
```

### 1.5 Bootstrap (`setup.sh`)

Run once on the Proxmox VM. Non-interactive after initial prompts:

1. Create `~/iah/` directory tree
2. Prompt: Telegram bot token, Telegram user ID, bridge TTL hours (default: 8) → write `~/iah/.env`
3. Generate minimal `openclaw.json` (Telegram enabled, Codex OAuth, user allowlist)
4. `docker compose up -d`
5. Install IDH plugin: `docker exec openclaw-gateway openclaw extensions install /home/node/.openclaw/plugins/idh`
6. Pre-populate `known_hosts` with GitHub fingerprint

After `setup.sh`: `docker compose up` is sufficient for all subsequent starts.

### 1.6 Internal Communication Architecture

```
openclaw-gateway (plugin)  ←──HTTP──→  idh-app (sidecar)
        │                                     │
        │  plugin → sidecar: REST calls       │
        │  (git, bridge start/stop, status)   │
        │                                     │
        │  sidecar → plugin: webhook          │
        │  POST http://openclaw-gateway:      │
        │       ${OPENCLAW_GATEWAY_PORT}/     │
        │       api/plugins/idh/events        │
        │  (bridge expiry warnings,           │
        │   renewal notifications)            │
        │                                     │
        └──── shared secret: IDH_WEBHOOK_SECRET (in .env)
```

The plugin registers an inbound HTTP route via `api.registerHttpRoute`:
```typescript
api.registerHttpRoute({
  path: "/api/plugins/idh/events",
  auth: "plugin",
  match: "prefix",
  handler: async (req, res) => { /* handle watchdog events */ }
})
```

`idh-app` includes `IDH_WEBHOOK_SECRET` as a Bearer token in the `Authorization` header when calling this endpoint. The plugin validates it.

### 1.7 openclaw.json Ownership

**`idh-app` is the sole writer of `openclaw.json`** (mounted at `/openclaw-config/openclaw.json`). The plugin never writes this file directly. All config mutations go through `idh-app` routes, which apply file-level locking and call `openclaw config reload` after each write via `docker exec` or CLI. This prevents concurrent write corruption from two containers.

---

## 2. Per-Project Model

### 2.1 Two Agents, Two Sessions Per Project

```
Project "my-project"
│
├── Telegram Agent
│     agentId        : my-project-telegram
│     session key    : agent:my-project-telegram:telegram:group:-100xxx
│     session        : fixed — survives Docker restarts and model switches
│     provider/model : Codex OAuth, overridable via before_model_resolve
│     system prompt  : COMMON_CONTEXT.md rendered with project vars (injected dynamically)
│     memory         : OpenClaw native session persistence (sessions.json)
│
└── Coding Agent (Claude Code Remote Control)
      process        : claude remote-control --name "my-project"
      workdir        : /workspaces/my-project
      session        : renews on bridge expiration (8h default, configurable)
      memory         : SESSION_MEMORY.md (auto-generated on renewal)
      rules          : CLAUDE.md (common context + CODING_RULES.md, generated at project creation)
      auth           : ~/.claude OAuth (claude.ai subscription)
```

### 2.2 Memory Mechanisms

**Three complementary layers:**

**Layer 1 — OpenClaw native session (Telegram agent)**
Sessions persisted in `sessions.json`. Model switches use `before_model_resolve` to override provider/model without changing `agentId` → session key unchanged → full history preserved.

**Layer 2 — Continuous SESSION_MEMORY.md (coding agent)**
`CLAUDE.md` instructs Claude Code: "After each completed task, update `SESSION_MEMORY.md` with: current state, decisions made, next steps, modified files."

A Claude Code Stop hook commits the file at every turn end (only if the file has changed):
```bash
git diff --quiet SESSION_MEMORY.md || (git add SESSION_MEMORY.md && git commit -m "auto: session state")
# Parentheses required: without them bash operator precedence causes an empty
# git commit attempt when no changes exist.
```

**Layer 3 — Auto-summary on bridge renewal (coding agent)**
On bridge expiration, `idh-app` watchdog:
1. Discovers session transcript: finds the most recently modified `*.jsonl` file under `~/.claude/projects/` matching the project workspace path. Claude Code derives the directory name from a hash of the workspace path; `idh-app` discovers it by scanning `~/.claude/projects/` and selecting the directory containing the most recent JSONL file, validated by checking that the JSONL contains messages matching the known session start time.
2. Calls Codex API (via `~/.codex` OAuth) to generate a consolidated summary. Prompt format: "Summarize the following Claude Code session transcript into a structured memory document with sections: Current State, Recent Decisions, Next Steps, Modified Files. Transcript: [JSONL content converted to readable messages]"
3. Writes `SESSION_MEMORY.md` + `git add SESSION_MEMORY.md && git commit -m "auto: bridge renewal summary"`
4. New bridge session reads `SESSION_MEMORY.md` automatically via `CLAUDE.md` instruction: "At the start of every session, read `SESSION_MEMORY.md`. It contains your working memory from previous sessions."

Result: no manual action required for session continuity.

### 2.3 Project File Structure

```
/workspaces/my-project/
├── .git/
├── CLAUDE.md              # auto-generated at project creation
│                          # = rendered COMMON_CONTEXT.md + CODING_RULES.md
├── SESSION_MEMORY.md      # auto-maintained cross-bridge memory
├── .claude/
│   └── settings.json      # Stop hook configuration
└── (project source code)
```

### 2.4 openclaw.json Entries Per Project

Written by `idh-app` when a project is created. `openclaw.json` mutations always go through `idh-app`:

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": {
          requireMention: false,
          agentId: "my-project-telegram"
        }
      }
    }
  },
  agents: {
    "my-project-telegram": {
      systemPrompt: "",   // always an empty string in config; actual prompt injected
                          // dynamically by before_prompt_build hook at request time
      model: "openai-codex/gpt-5.3-codex"
    }
  }
}
```

The `before_prompt_build` hook prepends the rendered common context to `ctx.systemPrompt`. Since `ctx.systemPrompt` is initialized from the agent's config value (empty string `""`), the hook produces: `renderCommonContext(project) + "\n\n" + ""` = clean rendered context with no trailing corruption.

### 2.5 State File (`idh-projects.state.json`)

Owned exclusively by `idh-app`. The plugin reads this file but never writes it — all state mutations go through `idh-app` REST API calls.

Wizard flow state is kept in plugin memory (per-process, per `groupId`) and is not persisted to disk. This is intentional: wizard flows are ephemeral UI state that does not need to survive a plugin restart.

```json
{
  "projects": {
    "-1001234567890": {
      "projectId": "my-project",
      "groupId": "-1001234567890",
      "agentId": "my-project-telegram",
      "workspaceDir": "/workspaces/my-project",
      "repoUrl": "git@github.com:user/my-project.git",
      "modelOverride": {
        "provider": "openai-codex",
        "model": "gpt-5.3-codex"
      },
      "bridge": {
        "pid": 1234,
        "url": "https://claude.ai/code?session=abc",
        "startedAt": "2026-03-20T10:00:00Z",
        "warnedAt": null
      }
    }
  }
}
```

---

## 3. OpenClaw Plugin (TypeScript)

### 3.1 Plugin Structure

```
plugin/idh/
├── package.json
└── src/
    ├── index.ts              # register(api) entry point
    ├── commands/
    │   ├── menu.ts           # /menu — home buttons
    │   ├── add-project.ts    # /add_project — creation wizard
    │   ├── agent.ts          # /agent — model switch wizard
    │   ├── bridge.ts         # /bridge — remote control wizard
    │   ├── monitoring.ts     # /monitoring — full project status
    │   └── info.ts           # /info — detailed project info
    ├── hooks/
    │   ├── model-resolver.ts # before_model_resolve — provider/model override
    │   └── prompt-builder.ts # before_prompt_build — common context injection
    ├── wizard/
    │   └── engine.ts         # multi-step wizard state machine (in-memory, per groupId)
    ├── state/
    │   └── state-reader.ts   # READ-ONLY access to idh-projects.state.json
    └── client/
        ├── sidecar.ts        # HTTP client → idh-app API (all mutations)
        └── webhook.ts        # inbound webhook handler (events from idh-app watchdog)
```

### 3.2 Registered Commands

| Command | Description |
|---|---|
| `/menu` | Home: project status + action buttons |
| `/add_project` | Wizard: clone repo, choose model, bind group |
| `/agent` | Wizard: switch Codex model (session preserved) |
| `/bridge` | Wizard: start/status + inline buttons [Renew] [Stop] |
| `/monitoring` | Full project status: git, agent, bridge, watchdog state, SESSION_MEMORY.md summary |
| `/info` | Detailed project info |

### 3.3 Hooks

**`before_model_resolve`** — overrides provider/model per group. The session key format is `agent:<agentId>:telegram:group:<groupId>`. The hook extracts the bare `groupId` from the session key before looking up project state:

```typescript
api.registerHook('before_model_resolve', async (ctx) => {
  const groupId = extractGroupId(ctx.sessionKey)
  // extractGroupId: parses "agent:...:group:-1001234567890" → "-1001234567890"
  const project = state.getByGroupId(groupId)
  if (project?.modelOverride) {
    ctx.provider = project.modelOverride.provider
    ctx.model    = project.modelOverride.model
  }
})
```

**`before_prompt_build`** — injects rendered common context. Uses the same `extractGroupId` helper:

```typescript
api.registerHook('before_prompt_build', async (ctx) => {
  const groupId = extractGroupId(ctx.sessionKey)
  const project = state.getByGroupId(groupId)
  if (project) {
    // ctx.systemPrompt is initialized from openclaw.json (empty string "")
    // Result: rendered context + "\n\n" + "" = clean context injection
    ctx.systemPrompt = renderCommonContext(project) + '\n\n' + (ctx.systemPrompt ?? '')
  }
})
```

### 3.4 Inbound Webhook (Events from idh-app)

The plugin registers an HTTP route to receive events from the `idh-app` watchdog:

```typescript
api.registerHttpRoute({
  path: "/api/plugins/idh/events",
  auth: "plugin",
  match: "prefix",
  handler: async (req, res) => {
    // Validate IDH_WEBHOOK_SECRET from Authorization: Bearer <secret>
    // Event types: "bridge_warning" | "bridge_renewed" | "bridge_stopped"
    // On "bridge_warning": send Telegram message to project group with [Renew Now] button
    // On "bridge_renewed": send new URL to group
  }
})
```

### 3.5 Wizard Engine

Multi-step flows stored in plugin memory (Map keyed by `groupId`). Each step sends an inline keyboard message via the OpenClaw message tool. Navigation: every step includes [← Back] and [✗ Cancel] buttons. On confirmation, the plugin calls `idh-app` for all state and config mutations, then sends a success confirmation.

---

## 4. idh-app (FastAPI + React)

### 4.1 API Routes

```
/api/v1/
├── projects/
│   ├── GET    /                    # list all projects
│   ├── POST   /                    # create project (triggers git clone + openclaw.json write)
│   ├── GET    /{id}                # project detail
│   ├── DELETE /{id}                # remove project + openclaw.json cleanup
│   └── POST   /{id}/git/refresh    # git fetch + status
│
├── settings/
│   ├── GET/PUT /global/coding-rules      # CODING_RULES.md
│   ├── GET/PUT /global/common-context    # COMMON_CONTEXT.md template
│   ├── GET/PUT /{id}/claude-md           # project CLAUDE.md (coding agent rules)
│   ├── GET/PUT /{id}/telegram-prompt     # Telegram agent system prompt override
│   └── GET/PUT /{id}/model               # provider + model selection
│
├── bridge/
│   ├── GET    /{id}/status         # PID, uptime, URL, countdown to expiry
│   ├── POST   /{id}/start          # spawn claude remote-control
│   ├── POST   /{id}/stop           # kill process
│   ├── POST   /{id}/renew          # auto-summary + kill + respawn
│   └── WS     /{id}/logs           # live stdout stream
│
├── agents/
│   ├── GET    /                    # list agents from openclaw.json
│   └── POST   /reload              # openclaw config reload (called after any config write)
│
└── memory/
    ├── GET/PUT /{id}/session-memory  # SESSION_MEMORY.md read/edit
    └── GET     /{id}/transcript      # last session JSONL content (read-only)
```

Any route that writes to `openclaw.json` calls `POST /agents/reload` after the write, before returning the response to the caller. File-level locking (Python `fcntl` or `filelock`) is applied to all `openclaw.json` reads and writes.

### 4.2 Bridge Manager

`idh-app` manages `claude remote-control` as an `asyncio.subprocess`. On start:
1. Spawn process in project workspace directory
2. Read stdout line-by-line. The `claude remote-control` command prints the session URL on a line matching the pattern: `Session URL: https://claude.ai/code?session=<token>` (or similar; implementation should match on the presence of `claude.ai` and a URL, not on the exact prefix label, to be resilient to minor CLI output changes)
3. Store PID + URL + `startedAt` timestamp in `state.json`
4. Launch watchdog asyncio background task

### 4.3 Watchdog

Asyncio background task per active bridge. All time references are relative to `startedAt`:

- **T + (TTL - 1h)**: Send `bridge_warning` event to plugin webhook → Telegram notification with [Renew Now] inline button
- **Every 10 minutes after first warning**: Repeat notification if no renewal has occurred
- **T + TTL** (hard cutoff): Trigger auto-renewal unconditionally, regardless of user response. There is no opt-out of auto-renewal at the hard cutoff — this ensures the bridge is never left in an expired state.

**User-initiated renewal** (clicking [Renew Now] or calling `POST /bridge/{id}/renew` from the dashboard) triggers the same renewal flow immediately and cancels the pending watchdog timer.

TTL is read from `BRIDGE_TTL_HOURS` env variable (default: `8`). This must be set in `~/iah/.env` and documented in `setup.sh` output.

**Grace period on in-flight tasks:** Before killing the process at auto-renewal time, `idh-app` sends `SIGTERM` and waits up to 30 seconds for a clean exit. If the process does not exit within 30 seconds, `SIGKILL` is sent. This gives any active Claude Code tool calls a window to complete.

### 4.4 React Dashboard

```
frontend/src/
├── theme.ts                       # design tokens: colors, spacing, typography
├── pages/
│   ├── Dashboard/
│   │   ├── Dashboard.tsx          # project grid
│   │   └── ProjectCard.tsx        # quick status + action buttons
│   ├── Project/
│   │   ├── ProjectPage.tsx        # tabbed layout
│   │   └── tabs/
│   │       ├── OverviewTab.tsx    # git status, branch, commit, agents
│   │       ├── BridgeTab.tsx      # URL, countdown, live logs, actions
│   │       ├── MemoryTab.tsx      # SESSION_MEMORY.md editor + transcript viewer
│   │       └── SettingsTab.tsx    # model selector, Telegram prompt, CLAUDE.md editor
│   ├── GlobalSettings/
│   │   ├── SettingsPage.tsx
│   │   ├── CodingRulesEditor.tsx  # CODING_RULES.md (markdown editor)
│   │   └── CommonContextEditor.tsx # COMMON_CONTEXT.md template editor
│   └── NewProject/
│       └── steps/
│           ├── RepoStep.tsx
│           ├── ModelStep.tsx
│           └── ConfirmStep.tsx
└── components/
    ├── MarkdownEditor.tsx          # shared editor (CodeMirror or Monaco)
    ├── ModelSelector.tsx           # provider + model dropdown
    ├── StatusBadge.tsx             # online / offline / warning
    └── CountdownTimer.tsx          # bridge time remaining
```

**Tab responsibilities (no overlap):**
- `MemoryTab`: `SESSION_MEMORY.md` editor + transcript viewer. Single location for memory management.
- `SettingsTab`: model selector, Telegram agent prompt, `CLAUDE.md` content. No memory editing here.

**Dual control parity:**

| Action | Telegram | Dashboard |
|---|---|---|
| Create project | `/add_project` | NewProject page |
| Switch model | `/agent` | SettingsTab → ModelSelector |
| Bridge status + URL | `/bridge` | BridgeTab |
| Renew bridge | [Renew Now] button in warning message | BridgeTab Renew button |
| Edit coding rules | ❌ | GlobalSettings |
| Edit prompts | ❌ | SettingsTab |
| View session memory summary | `/monitoring` (includes memory summary section) | MemoryTab (full editor + transcript) |

---

## 5. Detailed Flows

### 5.1 /add_project End-to-End

1. User types `/add_project` in a Telegram group
2. Plugin stores wizard state in memory for `groupId`, sends Step 1: "Repo URL?"
3. User replies with SSH URL → Step 2: model selection (inline buttons)
4. User selects model → Step 3: confirmation summary with [Confirm] [✗ Cancel]
5. User clicks [Confirm]:
   - Plugin calls `POST /api/v1/projects/` on `idh-app` with `{ groupId, repoUrl, model, provider }`
   - `idh-app`: git clone → generate `CLAUDE.md` (common context template rendered + coding rules) → create empty `SESSION_MEMORY.md` → write `.claude/settings.json` (Stop hook)
   - `idh-app`: write group binding + agent entry to `openclaw.json` → `POST /agents/reload`
   - `idh-app`: write project entry to `state.json`
   - `idh-app` returns project summary → Plugin sends success confirmation to Telegram
   - Plugin clears wizard state from memory

### 5.2 Bridge Lifecycle

**Start:** User calls `/bridge` → clicks [Start Bridge] → plugin calls `POST /bridge/{id}/start` → `idh-app` spawns `claude remote-control --name "<project>"` in workspace → parses URL from stdout → starts watchdog → plugin receives URL → sends to Telegram group → dashboard BridgeTab updated.

**Watchdog timeline** (zero point = bridge `startedAt`):

```
T+0       Bridge active ✓
T+(TTL-1h) Telegram warning: "⚠️ Bridge expires in 1h" + [Renew Now] button
T+(TTL-1h)+10min  Repeat if no renewal
...       Every 10 min
T+TTL     Auto-renewal triggered (hard cutoff, no opt-out)
```

**User-initiated renewal** via [Renew Now] button or dashboard: triggers immediate renewal, cancels watchdog countdown.

**Renewal flow:**
1. `SIGTERM` to process → wait 30s → `SIGKILL` if needed
2. Discover session transcript JSONL in `~/.claude/projects/` (scan for newest JSONL by modification time, validated against session start time stored in `state.json`)
3. Codex API call: generate SESSION_MEMORY.md from transcript
4. `git add SESSION_MEMORY.md && git commit -m "auto: bridge renewal summary"`
5. Spawn new `claude remote-control --name "<project>"`
6. Capture new URL from stdout
7. Update `state.json` (new PID, URL, startedAt)
8. Send `bridge_renewed` event to plugin webhook → plugin sends new URL to Telegram

New session reads `SESSION_MEMORY.md` automatically via `CLAUDE.md` instruction. No user action required.

### 5.3 Model Switch (Session Preserved)

1. User types `/agent` in project group
2. Plugin reads current model from `state.json` (read-only), shows inline buttons
3. User selects → Plugin calls `PUT /api/v1/settings/{groupId}/model` on `idh-app`
4. `idh-app` updates `modelOverride` in `state.json`
5. Plugin sends confirmation to Telegram
6. Next message: `before_model_resolve` hook reads new model from `state.json` → OpenClaw uses new provider/model
7. Session key unchanged (`agentId` unchanged) → full history + memory preserved

### 5.4 Continuous Memory (During Work)

```
CLAUDE.md instructs Claude Code:
  "After each completed task, update SESSION_MEMORY.md with:
   - Current State (what is working, what is in progress)
   - Recent Decisions (architectural choices, tradeoffs made)
   - Next Steps (what to do next session)
   - Modified Files (list of files changed this session)"

Stop hook (fires after every Claude turn):
  git diff --quiet SESSION_MEMORY.md || \
    (git add SESSION_MEMORY.md && git commit -m "auto: session state")
  # Parentheses required for correct bash operator precedence.
  # No-op if SESSION_MEMORY.md has not changed — no commit attempted.

On each new bridge session:
  CLAUDE.md instructs: "At the start of every session, read SESSION_MEMORY.md.
  It contains your working memory from previous sessions."
  → Context restored automatically, no user action
```

---

## 6. Environment Variables

All variables live in `~/iah/.env`. The `setup.sh` script prompts for required values and writes defaults for optional ones.

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Bot token from BotFather |
| `TELEGRAM_USER_ID` | ✅ | — | Your numeric Telegram user ID (allowlist) |
| `BRIDGE_TTL_HOURS` | ❌ | `8` | Bridge session lifetime before auto-renewal |
| `IDH_WEBHOOK_SECRET` | ✅ | auto-generated by `setup.sh` | Shared secret for sidecar→plugin webhook |
| `OPENCLAW_GATEWAY_PORT` | ❌ | `18789` | OpenClaw gateway port |
| `OPENCLAW_DASHBOARD_PORT` | ❌ | `18790` | OpenClaw dashboard port |
| `IDH_APP_PORT` | ❌ | `8000` | idh-app FastAPI + dashboard port |
| `CODE_SERVER_PORT` | ❌ | `8443` | VS Code Server port |

---

## 7. Constraints and Decisions

| Decision | Value |
|---|---|
| Bridge TTL | 8h default (warning at TTL-1h, configurable via `BRIDGE_TTL_HOURS`) |
| Session memory file | `SESSION_MEMORY.md` (in project workspace root) |
| CLAUDE_HANDOFF.md | Removed — replaced by automated SESSION_MEMORY.md mechanism |
| Claude in OpenClaw | Not allowed (Anthropic ToS — blocked since Jan 2026) |
| Claude in project | Exclusively via Remote Control bridge |
| Codex in OpenClaw | Via OAuth (`~/.codex` mount) — no API key |
| Workspace storage | Bind-mount to `~/iah/workspaces/` on Proxmox VM host |
| SSH for GitHub | `~/.ssh` mounted in `idh-app`, permissions fixed at entrypoint |
| App-level auth | None — handled by Zoraxy reverse proxy |
| OpenClaw session switch | `before_model_resolve` hook — `agentId` never changes |
| Plugin language | TypeScript (required by OpenClaw jiti loader) |
| Sidecar language | Python + FastAPI (user's standard stack) |
| Telegram mode | Polling (no public webhook required) |
| openclaw.json owner | `idh-app` exclusively — plugin never writes config directly |
| state.json owner | `idh-app` exclusively — plugin reads only |
| Wizard flow state | Plugin in-memory only (not persisted) |
| sidecar→plugin events | HTTP webhook with `IDH_WEBHOOK_SECRET` Bearer token |
| sessionKey→groupId | Plugin parses `agent:...:group:<groupId>` to extract bare groupId |
| Bridge auto-renewal | Hard cutoff at TTL — no opt-out, 30s SIGTERM grace period |
