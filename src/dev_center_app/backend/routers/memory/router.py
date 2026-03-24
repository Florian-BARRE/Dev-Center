# ====== Code Summary ======
# /memory router — reads Claude auto-memory files for a project.

# ====== Standard Library Imports ======
import datetime
import pathlib

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, HTTPException

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors

# ====== Local Project Imports ======
from .models import MemoryFile, MemoryResponse

router = APIRouter()

DISCOVERY_WINDOW_SECONDS = 10


def _discover_hash(claude_dir: pathlib.Path) -> str | None:
    """
    Scan ~/.claude/projects/ for recently-modified dirs containing memory/.

    Only considers directories modified within the last 10 seconds
    (DISCOVERY_WINDOW_SECONDS). Returns the most recently modified candidate.

    Args:
        claude_dir: Path to the ~/.claude directory.

    Returns:
        str | None: Directory name (hash) or None if not found.
    """
    projects_dir = claude_dir / "projects"
    if not projects_dir.exists():
        return None
    now = datetime.datetime.now().timestamp()
    candidates = []
    for d in projects_dir.iterdir():
        if not d.is_dir():
            continue
        memory_dir = d / "memory"
        if not memory_dir.exists():
            continue
        mtime = d.stat().st_mtime
        age = now - mtime
        # Only consider dirs modified within the last DISCOVERY_WINDOW_SECONDS seconds
        if age <= DISCOVERY_WINDOW_SECONDS:
            candidates.append((age, d.name))
    if not candidates:
        return None
    # Return the most recently modified candidate within the window
    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]


def _read_memory_files(claude_dir: pathlib.Path, hash_value: str) -> list[MemoryFile]:
    """
    Read all .md files from the memory directory for a given project hash.

    Args:
        claude_dir: Path to the ~/.claude directory.
        hash_value: The Claude project hash directory name.

    Returns:
        list[MemoryFile]: Sorted list of memory files with content and timestamps.
    """
    memory_dir = claude_dir / "projects" / hash_value / "memory"
    if not memory_dir.exists():
        return []
    files = []
    for f in sorted(memory_dir.glob("*.md")):
        mtime = datetime.datetime.fromtimestamp(f.stat().st_mtime, tz=datetime.timezone.utc)
        files.append(MemoryFile(
            name=f.name,
            content=f.read_text(encoding="utf-8", errors="replace"),
            updated_at=mtime.isoformat(),
        ))
    return files


@router.get("/projects/{project_id}/memory", response_model=MemoryResponse)
@auto_handle_errors
async def get_memory(project_id: str) -> MemoryResponse:
    """
    Return all Claude auto-memory files for a project.

    Retries hash discovery on each call if hash not yet found.
    Once a hash is found, it is persisted to session state.

    Args:
        project_id: ID of the project to fetch memory for.

    Raises:
        HTTPException: 404 if the project does not exist.

    Returns:
        MemoryResponse: Memory files and hash discovery status for the project.
    """
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    claude_dir = CONTEXT.RUNTIME_CONFIG.CLAUDE_DIR
    hash_value = p.session.claude_project_hash if p.session else ""

    # 1. Retry discovery if hash not yet known
    if not hash_value:
        discovered = _discover_hash(claude_dir)
        if discovered:
            hash_value = discovered
            CONTEXT.session_manager.update_hash(project_id, hash_value)

    if not hash_value:
        return MemoryResponse(files=[], hash_discovered=False)

    # 2. Read memory files
    files = _read_memory_files(claude_dir, hash_value)
    return MemoryResponse(files=files, hash_discovered=True)
