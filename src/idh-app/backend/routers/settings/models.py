# ====== Code Summary ======
# Pydantic models for the /settings router.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, Field


class WebhookPayload(BaseModel):
    """
    Payload received from the IDH GitHub webhook.

    Attributes:
        project_id (str): Unique project identifier.
        group_id (str): Telegram group ID that owns the project.
        repo_url (str): Git repository URL to clone.
        agent_id (str): OpenClaw agent identifier for this project.
    """

    project_id: str = Field(..., description="Unique project identifier.")
    group_id: str = Field(..., description="Telegram group ID.")
    repo_url: str = Field(..., description="Git repository URL.")
    agent_id: str = Field(..., description="OpenClaw agent identifier.")


class TelegramPromptRequest(BaseModel):
    """
    Request body for updating an agent's system prompt.

    Attributes:
        system_prompt (str): The new system prompt for the agent.
    """

    system_prompt: str = Field(..., description="New system prompt for the agent.")


class SettingsResponse(BaseModel):
    """
    Generic success response for settings operations.

    Attributes:
        status (str): Operation status string.
    """

    status: str
