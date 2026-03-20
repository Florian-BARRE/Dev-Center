# ====== Code Summary ======
# Tests for the /memory router endpoints.

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient


def test_get_memory_not_found(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /memory/{project_id} returns 404 when no CLAUDE.md exists."""
    from backend.context import CONTEXT

    class FakeMemoryManager:
        def read_memory(self, project_id: str) -> None:
            return None

    monkeypatch.setattr(CONTEXT, "memory_manager", FakeMemoryManager())

    response = client.get("/api/v1/memory/proj-1")
    assert response.status_code == 404


def test_get_memory_returns_content(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /memory/{project_id} returns the CLAUDE.md content when it exists."""
    from backend.context import CONTEXT

    class FakeMemoryManager:
        def read_memory(self, project_id: str) -> str:
            return "# Memory content"

    monkeypatch.setattr(CONTEXT, "memory_manager", FakeMemoryManager())

    response = client.get("/api/v1/memory/proj-1")
    assert response.status_code == 200
    assert response.json()["content"] == "# Memory content"


def test_put_memory_writes_content(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """PUT /memory/{project_id} writes the provided content to CLAUDE.md."""
    from backend.context import CONTEXT

    written = []

    class FakeMemoryManager:
        def write_memory(self, project_id: str, content: str) -> None:
            written.append((project_id, content))

    monkeypatch.setattr(CONTEXT, "memory_manager", FakeMemoryManager())

    response = client.put("/api/v1/memory/proj-1", json={"content": "# New memory"})
    assert response.status_code == 200
    assert ("proj-1", "# New memory") in written
