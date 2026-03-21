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
    """

    pid: int
    workspace: str
    expires_at: str


class ModelOverride(_CamelModel):
    """
    Provider + model selection override for a project's coding agent.

    Attributes:
        provider (str): AI provider slug (e.g. "anthropic").
        model (str): Model identifier (e.g. "claude-opus-4-6").
    """

    provider: str
    model: str


class Project(_CamelModel):
    """
    Persistent state for a registered IDH project.

    Attributes:
        group_id (str): Telegram group ID that owns this project.
        project_id (str): Unique project slug / identifier.
        repo_url (str): Git repository URL.
        bridge (BridgeState | None): Active bridge state, or None if idle.
        model_override (ModelOverride | None): Optional provider/model override for the coding agent.
    """

    group_id: str
    project_id: str
    repo_url: str
    bridge: BridgeState | None = None
    model_override: ModelOverride | None = None


class StateFile(_CamelModel):
    """
    Root structure of ``idh-projects.state.json``.

    Attributes:
        projects (dict[str, Project]): Map of group_id → Project.
    """

    projects: dict[str, Project] = {}
