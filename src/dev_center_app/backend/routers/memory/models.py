# ====== Code Summary ======
# Pydantic models for the /memory router.

# ====== Internal Project Imports ======
from libs.state.models import _CamelModel


class MemoryFile(_CamelModel):
    """A single Claude auto-memory markdown file."""

    name: str
    content: str
    updated_at: str  # ISO-8601


class MemoryResponse(_CamelModel):
    """Response containing all memory files for a project."""

    files: list[MemoryFile]
    hash_discovered: bool
