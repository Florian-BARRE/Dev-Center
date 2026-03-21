# ====== Code Summary ======
# Tests for /memory/{project_id}/session-memory and /memory/{project_id}/transcript routes.

# ====== Standard Library Imports ======
import json

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient

# ====== Local Project Imports ======
from backend.context import CONTEXT


def test_get_session_memory(client: TestClient, tmp_path: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /memory/{project_id}/session-memory returns SESSION_MEMORY.md content."""
    ws = tmp_path / "workspaces" / "p1"
    ws.mkdir(parents=True)
    (ws / "SESSION_MEMORY.md").write_text("# Session")
    monkeypatch.setattr(CONTEXT.RUNTIME_CONFIG, "PATH_WORKSPACES", tmp_path / "workspaces")

    resp = client.get("/api/v1/memory/p1/session-memory")
    assert resp.status_code == 200
    assert resp.json()["content"] == "# Session"
    assert resp.json()["projectId"] == "p1"


def test_put_session_memory(client: TestClient, tmp_path: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch) -> None:
    """PUT /memory/{project_id}/session-memory writes SESSION_MEMORY.md."""
    ws = tmp_path / "workspaces" / "p1"
    ws.mkdir(parents=True)
    (ws / "SESSION_MEMORY.md").write_text("")
    monkeypatch.setattr(CONTEXT.RUNTIME_CONFIG, "PATH_WORKSPACES", tmp_path / "workspaces")

    resp = client.put("/api/v1/memory/p1/session-memory", json={"content": "# Updated"})
    assert resp.status_code == 200
    assert (ws / "SESSION_MEMORY.md").read_text() == "# Updated"


def test_get_transcript_returns_jsonl(client: TestClient, tmp_path: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /memory/{project_id}/transcript returns newest JSONL file content."""
    ws = tmp_path / "workspaces" / "p1"
    ws.mkdir(parents=True)
    jsonl_data = json.dumps({"type": "message", "content": "hello"}) + "\n"
    (ws / "transcript.jsonl").write_text(jsonl_data)
    monkeypatch.setattr(CONTEXT.RUNTIME_CONFIG, "PATH_WORKSPACES", tmp_path / "workspaces")

    resp = client.get("/api/v1/memory/p1/transcript")
    assert resp.status_code == 200
    assert "hello" in resp.json()["content"]
