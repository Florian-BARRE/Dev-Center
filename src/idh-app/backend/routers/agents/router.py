# ====== Code Summary ======
# Route definitions for the /agents endpoints.

# ====== Third-Party Library Imports ======
from fastapi import APIRouter

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import AgentListResponse

router = APIRouter(tags=["agents"])


@router.get("/agents", response_model=AgentListResponse)
@auto_handle_errors
async def list_agents() -> AgentListResponse:
    """
    List all agents registered in openclaw.json.

    Returns:
        AgentListResponse: Dict of all agent configurations.
    """
    # 1. Read the openclaw config and extract the agents section
    config = CONTEXT.openclaw_writer.read_config()
    return AgentListResponse(agents=config.get("agents", {}))
