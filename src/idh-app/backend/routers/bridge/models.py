# ====== Code Summary ======
# Pydantic models for the /bridge router.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel

# ====== Internal Project Imports ======
from libs.state.models import BridgeState


class BridgeStatusResponse(BaseModel):
    """
    Response model for bridge status endpoints.

    Attributes:
        group_id (str): Telegram group ID.
        bridge (BridgeState | None): Active bridge state, or None if idle.
    """

    group_id: str
    bridge: BridgeState | None = None


class BridgeActionResponse(BaseModel):
    """
    Response model for bridge start/stop actions.

    Attributes:
        status (str): Operation status string.
    """

    status: str


class AutoRenewRequest(BaseModel):
    """
    Request body for toggling auto-renew on an active bridge.

    Attributes:
        auto_renew (bool): New auto-renew state.
    """

    auto_renew: bool
