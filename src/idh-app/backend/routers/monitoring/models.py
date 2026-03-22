# ====== Code Summary ======
# Pydantic response models for the /monitoring endpoints.

# ====== Standard Library Imports ======
from __future__ import annotations

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# ====== Local Project Imports ======
from libs.state.models import ActivityEntry


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TimelineWindow(_CamelModel):
    """
    A scheduled or active window on the timeline, expanded to absolute timestamps.

    Attributes:
        start (str): ISO-8601 UTC window start.
        end (str): ISO-8601 UTC window end.
        status (str): "active" | "scheduled" | "past".
    """

    start: str
    end: str
    status: str


class TimelineProject(_CamelModel):
    """
    Timeline data for a single project.

    Attributes:
        group_id (str): Telegram group ID.
        project_id (str): Project slug.
        windows (list[TimelineWindow]): Expanded schedule windows ±24h.
    """

    group_id: str
    project_id: str
    windows: list[TimelineWindow]


class TimelineResponse(_CamelModel):
    """Response for GET /monitoring/timeline."""

    projects: list[TimelineProject]


class ActivityLogResponse(_CamelModel):
    """Response for GET /monitoring/activity."""

    entries: list[ActivityEntry]
