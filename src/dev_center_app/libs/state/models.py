# ====== Code Summary ======
# Pydantic models for dev-center-app state.

from __future__ import annotations
import re
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
GLOBAL_RULES_START = "<!-- dev-center: global-rules-start -->"
GLOBAL_RULES_END = "<!-- dev-center: global-rules-end -->"


__all__ = [
    "_CamelModel",
    "SessionState", "TimeRange", "ScheduleConfig", "Project",
    "StateFile", "GlobalDefaults", "GlobalConfig", "derive_project_id",
    "GLOBAL_RULES_START", "GLOBAL_RULES_END",
]
