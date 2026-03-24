# ====== Code Summary ======
# Pydantic models for the /projects router.

from __future__ import annotations
from typing import Any
from libs.state.models import _CamelModel, ScheduleConfig


class ProjectResponse(_CamelModel):
    """
    Single project response including computed status.

    Attributes:
        id (str): Project slug.
        name (str): Human-readable project name.
        repo_url (str): GitHub HTTPS URL.
        workspace_path (str): Local workspace directory.
        provider (str): AI provider (e.g. "anthropic").
        model (str): Model identifier.
        schedule (ScheduleConfig): Session scheduling config.
        session (Any | None): Active SessionState or None.
        status (str): Computed status — "cloning", "ready", or "active".
    """

    id: str
    name: str
    repo_url: str
    workspace_path: str
    provider: str
    model: str
    schedule: ScheduleConfig
    session: Any | None
    status: str


class ProjectListResponse(_CamelModel):
    """
    Response model for the GET /projects endpoint.

    Attributes:
        projects (list[ProjectResponse]): All registered projects.
    """

    projects: list[ProjectResponse]


class CreateProjectRequest(_CamelModel):
    """
    Request body for POST /projects.

    Attributes:
        repo_url (str): GitHub HTTPS URL to clone.
        provider (str): AI provider override (default: "anthropic").
        model (str): Model override (default: "claude-sonnet-4-6").
    """

    repo_url: str
    provider: str = "anthropic"
    model: str = "claude-sonnet-4-6"


class UpdateProjectRequest(_CamelModel):
    """
    Request body for PUT /projects/{project_id}.

    Attributes:
        provider (str | None): Override the AI provider.
        model (str | None): Override the model.
        schedule (ScheduleConfig | None): New scheduling config.
        auto_renew (bool | None): Update session.auto_renew if session is active.
    """

    provider: str | None = None
    model: str | None = None
    schedule: ScheduleConfig | None = None
    auto_renew: bool | None = None
