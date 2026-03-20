# ====== Code Summary ======
# Pydantic models for the /agents router.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel


class AgentListResponse(BaseModel):
    """
    Response model for listing all OpenClaw agents.

    Attributes:
        agents (dict): Map of agent_id → agent config dict from openclaw.json.
    """

    agents: dict
