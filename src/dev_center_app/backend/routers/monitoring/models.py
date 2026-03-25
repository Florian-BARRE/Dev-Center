# ====== Code Summary ======
# Pydantic models for the /monitoring router.

# ====== Standard Library Imports ======
from typing import Literal

# ====== Internal Project Imports ======
from libs.state.models import _CamelModel, SessionState


class ProjectMonitorRow(_CamelModel):
    """Single-row project status for the monitoring table."""

    project_id: str
    status: Literal["active", "idle"]
    session: SessionState | None
    workspace_path: str


class MonitoringResponse(_CamelModel):
    """Response model for GET /monitoring."""

    projects: list[ProjectMonitorRow]
