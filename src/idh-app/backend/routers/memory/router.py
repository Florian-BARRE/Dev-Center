# ====== Code Summary ======
# Route definitions for the /memory endpoints.

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, HTTPException

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import (
    MemoryResponse,
    MemoryWriteRequest,
    MemoryWriteResponse,
    SessionMemoryResponse,
    TranscriptResponse,
)

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


@router.get("/memory/{project_id}/session-memory", response_model=SessionMemoryResponse)
@auto_handle_errors
async def get_session_memory(project_id: str) -> SessionMemoryResponse:
    """
    Read SESSION_MEMORY.md for a project.

    Args:
        project_id (str): Project identifier.

    Returns:
        SessionMemoryResponse: Project ID and file content.

    Raises:
        HTTPException: 404 if file not found.
    """
    # 1. Read content via memory manager
    try:
        content = CONTEXT.memory_manager.read_session_memory(project_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"SESSION_MEMORY.md not found for '{project_id}'")
    return SessionMemoryResponse(project_id=project_id, content=content)


@router.put("/memory/{project_id}/session-memory", response_model=MemoryWriteResponse)
@auto_handle_errors
async def put_session_memory(project_id: str, body: MemoryWriteRequest) -> MemoryWriteResponse:
    """
    Write SESSION_MEMORY.md for a project.

    Args:
        project_id (str): Project identifier.
        body (MemoryWriteRequest): New content.

    Returns:
        MemoryWriteResponse: Success status.
    """
    # 1. Write content via memory manager
    CONTEXT.memory_manager.write_session_memory(project_id, body.content)
    return MemoryWriteResponse(status="ok")


@router.get("/memory/{project_id}/transcript", response_model=TranscriptResponse)
@auto_handle_errors
async def get_transcript(project_id: str) -> TranscriptResponse:
    """
    Read the newest JSONL transcript file for a project.

    Scans the project workspace for *.jsonl files and returns the most recently
    modified one. Returns 404 if no transcript file exists.

    Args:
        project_id (str): Project identifier.

    Returns:
        TranscriptResponse: Project ID and raw JSONL content.

    Raises:
        HTTPException: 404 if no transcript file exists.
    """
    # 1. Get latest transcript via memory manager
    try:
        content = CONTEXT.memory_manager.get_latest_transcript(project_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"No transcript found for '{project_id}'")
    return TranscriptResponse(project_id=project_id, content=content)
