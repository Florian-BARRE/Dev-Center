# ====== Code Summary ======
# Pydantic models for the /session routes.

from libs.state.models import _CamelModel, SessionState


class SessionResponse(_CamelModel):
    """Response model for session start and renew operations."""
    project_id: str
    session: SessionState
