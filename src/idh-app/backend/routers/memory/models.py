# ====== Code Summary ======
# Pydantic models for the /memory router.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, Field

# ====== Internal Project Imports ======
from libs.state.models import _CamelModel


class MemoryResponse(BaseModel):
    """
    Response model for reading project memory.

    Attributes:
        project_id (str): Project identifier.
        content (str): Content of the CLAUDE.md file.
    """

    project_id: str
    content: str


class MemoryWriteRequest(BaseModel):
    """
    Request body for writing project memory.

    Attributes:
        content (str): New content to write to CLAUDE.md.
    """

    content: str = Field(..., description="Content to write to CLAUDE.md.")


class MemoryWriteResponse(BaseModel):
    """
    Response model for memory write operations.

    Attributes:
        status (str): Operation status string.
    """

    status: str


class SessionMemoryResponse(_CamelModel):
    """
    Response model for SESSION_MEMORY.md content.

    Attributes:
        project_id (str): Project identifier. Serialised as ``projectId`` in JSON.
        content (str): Content of SESSION_MEMORY.md.
    """

    project_id: str
    content: str


class TranscriptResponse(_CamelModel):
    """
    Response model for the last session transcript.

    Attributes:
        project_id (str): Project identifier. Serialised as ``projectId`` in JSON.
        content (str): Raw JSONL content of the transcript file.
    """

    project_id: str
    content: str
