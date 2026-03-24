# ====== Code Summary ======
# Pydantic models for the /rules router.

# ====== Internal Project Imports ======
from libs.state.models import _CamelModel


class RulesResponse(_CamelModel):
    """Response model for rules read/write operations."""
    content: str
    global_rules_out_of_sync: bool = False


class UpdateRulesRequest(_CamelModel):
    """Request body for updating CLAUDE.md content."""
    content: str
