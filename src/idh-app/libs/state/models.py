# ====== Code Summary ======
# Pydantic models for the idh-app state file.
# _CamelModel provides camelCase JSON serialisation with Python-attribute construction.

# ====== Standard Library Imports ======
from __future__ import annotations

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    """
    Base model that serialises to camelCase JSON.

    Aliases are generated automatically via `to_camel`.
    `populate_by_name=True` allows construction with Python attribute names.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class BridgeState(_CamelModel):
    """
    Persistent state for an active Claude bridge process.

    Attributes:
        pid (int): OS process ID of the bridge subprocess.
        workspace (str): Absolute path to the workspace directory.
        expires_at (str): ISO-8601 UTC timestamp when the bridge expires.
        auto_renew (bool): Whether the bridge should be automatically renewed on expiry.
    """

    pid: int
    workspace: str
    expires_at: str
    auto_renew: bool = False


class ModelOverride(_CamelModel):
    """
    Provider + model selection override for a project's coding agent.

    Attributes:
        provider (str): AI provider slug (e.g. "anthropic").
        model (str): Model identifier (e.g. "claude-opus-4-6").
    """

    provider: str
    model: str


class ScheduleConfig(_CamelModel):
    """
    Session scheduling configuration for one project (or global defaults).

    The schedule defines specific HH:MM times at which the bridge is automatically
    renewed or started. Warnings are sent ``warn_lead_minutes`` before each renewal.

    Attributes:
        enabled (bool): Whether scheduling is active.
        renewal_times (list[str]): HH:MM 24h times to auto-renew the bridge,
            e.g. ["08:00", "16:00"].
        days (list[str]): Days when the schedule is active — subset of
            ["mon","tue","wed","thu","fri","sat","sun"]. Empty list means all days.
        warn_lead_minutes (int): Send warning N minutes before each renewal time.
        warn_interval_minutes (int): Resend warning every N minutes.
        alert_template (str): Telegram message template; use {remaining} placeholder.
    """

    enabled: bool = False
    renewal_times: list[str] = []
    days: list[str] = []
    warn_lead_minutes: int = 30
    warn_interval_minutes: int = 10
    alert_template: str = (
        "⏰ Session renewing in {remaining}. Ready? "
        "[✅ Now] [⏳ +30 min] [🔄 Later]"
    )


class Project(_CamelModel):
    """
    Persistent state for a registered IDH project.

    Attributes:
        group_id (str): Telegram group ID that owns this project.
        project_id (str): Unique project slug / identifier.
        repo_url (str): Git repository URL.
        bridge (BridgeState | None): Active bridge state, or None if idle.
        model_override (ModelOverride | None): Optional provider/model override for the coding agent.
        schedule (ScheduleConfig | None): Optional per-project session scheduling config.
    """

    group_id: str
    project_id: str
    repo_url: str
    bridge: BridgeState | None = None
    model_override: ModelOverride | None = None
    schedule: ScheduleConfig | None = None


class StateFile(_CamelModel):
    """
    Root structure of ``idh-projects.state.json``.

    Attributes:
        projects (dict[str, Project]): Map of group_id → Project.
    """

    projects: dict[str, Project] = {}


class GlobalDefaults(_CamelModel):
    """
    Default values applied to every new project at creation time.

    Attributes:
        default_provider (str): AI provider slug.
        default_model (str): Model identifier.
        default_bridge_ttl_hours (int): Default bridge TTL.
        default_telegram_prompt (str): Default Telegram system prompt.
    """

    default_provider: str = "anthropic"
    default_model: str = "claude-sonnet-4-6"
    default_bridge_ttl_hours: int = 8
    default_telegram_prompt: str = ""


class GlobalConfig(_CamelModel):
    """
    Root structure of idh-global-config.json.

    Attributes:
        defaults (GlobalDefaults): Per-project creation defaults.
        schedule (ScheduleConfig): Global scheduling config used by projects on inherit mode.
    """

    defaults: GlobalDefaults = GlobalDefaults()
    schedule: ScheduleConfig = ScheduleConfig()


class ActivityEntry(_CamelModel):
    """
    Single activity log entry — in-memory only, never persisted.

    Attributes:
        timestamp (str): ISO-8601 UTC timestamp.
        group_id (str): Telegram group ID.
        project_id (str): Project slug.
        event (str): Human-readable description.
        level (str): Severity — "info" | "warning" | "error".
    """

    timestamp: str
    group_id: str
    project_id: str
    event: str
    level: str = "info"


__all__ = [
    "BridgeState",
    "ModelOverride",
    "ScheduleConfig",
    "Project",
    "StateFile",
    "GlobalDefaults",
    "GlobalConfig",
    "ActivityEntry",
]
