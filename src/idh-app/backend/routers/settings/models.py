# ====== Code Summary ======
# Pydantic models for the /settings router.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, Field

# ====== Internal Project Imports ======
from libs.state.models import _CamelModel, ScheduleConfig


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


class ModelUpdateRequest(_CamelModel):
    """
    Request body for updating a project's model override.

    Attributes:
        provider (str): AI provider slug (e.g. "anthropic").
        model (str): Model identifier (e.g. "claude-sonnet-4-6").
    """

    provider: str = Field(..., description="AI provider slug.")
    model: str = Field(..., description="Model identifier.")


class SettingsResponse(BaseModel):
    """
    Generic success response for settings operations.

    Attributes:
        status (str): Operation status string.
    """

    status: str


class FileContentResponse(_CamelModel):
    """
    Response model for file content read operations.

    Attributes:
        content (str): File content as a string.
    """

    content: str


class FileWriteRequest(_CamelModel):
    """
    Request body for file write operations.

    Attributes:
        content (str): New file content.
    """

    content: str = Field(..., description="New file content.")


class TelegramPromptResponse(_CamelModel):
    """
    Response model for reading a Telegram agent prompt.

    Attributes:
        agent_id (str): OpenClaw agent identifier.
        system_prompt (str): Current system prompt for the agent.
    """

    agent_id: str
    system_prompt: str


class ModelResponse(_CamelModel):
    """
    Response model for reading a project's model override.

    Attributes:
        provider (str): AI provider slug.
        model (str): Model identifier.
    """

    provider: str
    model: str


class ContextSizeResponse(BaseModel):
    """
    Token count estimates for a project's context files.

    Attributes:
        total (int): Sum of all component counts.
        claude_md (int): Estimated tokens in CLAUDE.md.
        system_prompt (int): Estimated tokens in the Telegram system prompt.
        session_memory (int): Estimated tokens in SESSION_MEMORY.md.
        estimated_max (int): Conservative context window size.
    """

    total: int
    claude_md: int
    system_prompt: int
    session_memory: int
    estimated_max: int = 200_000


class ScheduleRequest(BaseModel):
    """Request body for PUT /settings/{group_id}/schedule. None resets to inherit."""

    schedule: ScheduleConfig | None = None
