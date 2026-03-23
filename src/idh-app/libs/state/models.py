# ====== Code Summary ======
# Pydantic models for the idh-app state file.
# _CamelModel provides camelCase JSON serialisation with Python-attribute construction.

# ====== Standard Library Imports ======
from __future__ import annotations

from typing import Any

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, ConfigDict, model_validator
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
        scheduled_session (bool): True when this session was started by the scheduler,
            so the scheduler knows which sessions it owns and can stop them on range exit.
    """

    pid: int
    workspace: str
    expires_at: str
    auto_renew: bool = False
    scheduled_session: bool = False


class ModelOverride(_CamelModel):
    """
    Provider + model selection override for a project's coding agent.

    Attributes:
        provider (str): AI provider slug (e.g. "anthropic").
        model (str): Model identifier (e.g. "claude-opus-4-6").
    """

    provider: str
    model: str


class TimeRange(_CamelModel):
    """
    A single active time range for session scheduling.

    Attributes:
        start (str): Range start time in HH:MM 24h format.
        end (str): Range end time in HH:MM 24h format. "00:00" means midnight (end of day).
    """

    start: str
    end: str


class ScheduleConfig(_CamelModel):
    """
    Session scheduling configuration for one project (or global defaults).

    Defines time ranges during which the session code should be active.
    The backend starts the session on range entry and stops it on range exit.

    Attributes:
        enabled (bool): Whether scheduling is active.
        ranges (list[TimeRange]): Time windows during which the session is active.
        days (list[str]): Active days — subset of ["mon","tue","wed","thu","fri","sat","sun"].
            Empty list means all days.
    """

    enabled: bool = False
    ranges: list[TimeRange] = []
    days: list[str] = []

    @model_validator(mode="before")
    @classmethod
    def _migrate_old_format(cls, data: Any) -> Any:
        """
        Transparently migrate persisted state from the old renewal_times format.

        Old keys detected: renewalTimes (camelCase) or renewal_times (snake_case).
        Migration: each renewal time becomes a range with start=time, end="00:00".
        Old-only keys (warnLeadMinutes, warnIntervalMinutes, alertTemplate) are discarded.

        Args:
            data (Any): Raw input data before model construction.

        Returns:
            Any: Migrated data dict if old format was detected, otherwise data unchanged.
        """
        if not isinstance(data, dict):
            return data
        # Detect old format by presence of renewal_times or renewalTimes
        old_times = data.get("renewalTimes") or data.get("renewal_times")
        if old_times is not None:
            migrated_ranges = [{"start": t, "end": "00:00"} for t in old_times]
            return {
                "enabled": data.get("enabled", False),
                "ranges": migrated_ranges,
                "days": data.get("days", []),
            }
        return data


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
    "TimeRange",
    "ScheduleConfig",
    "Project",
    "StateFile",
    "GlobalDefaults",
    "GlobalConfig",
    "ActivityEntry",
]
