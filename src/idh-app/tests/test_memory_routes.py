# ====== Code Summary ======
# Tests for /memory/{project_id}/session-memory and /memory/{project_id}/transcript routes.

# ====== Standard Library Imports ======
import json

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient

# ====== Local Project Imports ======
from backend.context import CONTEXT


def test_get_session_memory(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /memory/{project_id}/session-memory returns SESSION_MEMORY.md content."""
    monkeypatch.setattr(CONTEXT.memory_manager, "read_session_memory", lambda project_id: "# Session")

    resp = client.get("/api/v1/memory/p1/session-memory")
    assert resp.status_code == 200
    assert resp.json()["content"] == "# Session"
    assert resp.json()["projectId"] == "p1"


def test_put_session_memory(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """PUT /memory/{project_id}/session-memory delegates write to memory manager."""
    written: dict[str, str] = {}

    def mock_write(project_id: str, content: str) -> None:
        written["content"] = content

    monkeypatch.setattr(CONTEXT.memory_manager, "write_session_memory", mock_write)

    resp = client.put("/api/v1/memory/p1/session-memory", json={"content": "# Updated"})
    assert resp.status_code == 200
    assert written["content"] == "# Updated"


def test_get_transcript_returns_jsonl(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /memory/{project_id}/transcript returns newest JSONL file content."""
    jsonl_data = json.dumps({"type": "message", "content": "hello"}) + "\n"
    monkeypatch.setattr(CONTEXT.memory_manager, "get_latest_transcript", lambda project_id: jsonl_data)

    resp = client.get("/api/v1/memory/p1/transcript")
    assert resp.status_code == 200
    assert "hello" in resp.json()["content"]


def test_get_session_memory_404(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /memory/{project_id}/session-memory returns 404 when file is missing."""

    def raise_not_found(project_id: str) -> str:
        raise FileNotFoundError(f"SESSION_MEMORY.md not found for '{project_id}'")

    monkeypatch.setattr(CONTEXT.memory_manager, "read_session_memory", raise_not_found)

    resp = client.get("/api/v1/memory/nonexistent/session-memory")
    assert resp.status_code == 404
