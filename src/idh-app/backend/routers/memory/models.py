# ====== Code Summary ======
# Pydantic models for the /memory router.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, Field


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
