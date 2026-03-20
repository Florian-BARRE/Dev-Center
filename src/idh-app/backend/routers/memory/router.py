# ====== Code Summary ======
# Route definitions for the /memory endpoints.

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, HTTPException

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import MemoryResponse, MemoryWriteRequest, MemoryWriteResponse

router = APIRouter(tags=["memory"])


@router.get("/memory/{project_id}", response_model=MemoryResponse)
@auto_handle_errors
async def get_memory(project_id: str) -> MemoryResponse:
    """
    Read the CLAUDE.md memory file for a project.

    Args:
        project_id (str): Project identifier.

    Returns:
        MemoryResponse: Project ID and CLAUDE.md content.

    Raises:
        HTTPException: 404 if no memory file exists for the project.
    """
    # 1. Read the memory file — returns None if missing
    content = CONTEXT.memory_manager.read_memory(project_id)
    if content is None:
        raise HTTPException(status_code=404, detail=f"Memory for project '{project_id}' not found")

    return MemoryResponse(project_id=project_id, content=content)


@router.put("/memory/{project_id}", response_model=MemoryWriteResponse)
@auto_handle_errors
async def put_memory(project_id: str, body: MemoryWriteRequest) -> MemoryWriteResponse:
    """
    Write content to the CLAUDE.md memory file for a project.

    Args:
        project_id (str): Project identifier.
        body (MemoryWriteRequest): Request body containing the content to write.

    Returns:
        MemoryWriteResponse: Success status.
    """
    # 1. Write the memory content
    CONTEXT.memory_manager.write_memory(project_id, body.content)
    return MemoryWriteResponse(status="ok")
