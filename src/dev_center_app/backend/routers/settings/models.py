# ====== Code Summary ======
# Pydantic models for the /settings router.

# ====== Standard Library Imports ======
# (none)

# ====== Third-Party Library Imports ======
# (none)

# ====== Internal Project Imports ======
from libs.state.models import _CamelModel, GlobalDefaults, ScheduleConfig


class GlobalConfigResponse(_CamelModel):
    """Response model for global configuration."""

    defaults: GlobalDefaults
    schedule: ScheduleConfig


class UpdateGlobalConfigRequest(_CamelModel):
    """Request body for updating global configuration."""

    defaults: GlobalDefaults | None = None
    schedule: ScheduleConfig | None = None


class GlobalRulesResponse(_CamelModel):
    """Response model for global rules."""

    content: str
    out_of_sync_projects: int = 0


class UpdateGlobalRulesRequest(_CamelModel):
    """Request body for updating global rules."""

    content: str
