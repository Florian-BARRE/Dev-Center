# ====== Code Summary ======
# Tests for GET/PUT /api/v1/settings/{group_id}/telegram-model.

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient

# ====== Internal Project Imports ======
from libs.state.models import Project


def _make_project(group_id: str = "-9001", project_id: str = "test-tg-model") -> Project:
    """Return a minimal Project fixture."""
    return Project(groupId=group_id, projectId=project_id, repoUrl="https://example.com/repo.git")


def test_get_telegram_model_returns_empty_strings_initially(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """GET telegram-model returns empty provider/model before any update."""
    from backend.context import CONTEXT

    project = _make_project()
    monkeypatch.setattr(
        CONTEXT.state_manager,
        "get_project",
        lambda gid: project if gid == "-9001" else None,
    )
    monkeypatch.setattr(
        CONTEXT.openclaw_writer,
        "get_agent_model",
        lambda aid: ("", ""),
    )

    r = client.get("/api/v1/settings/-9001/telegram-model")
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == ""
    assert data["model"] == ""


def test_put_telegram_model_persists(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PUT telegram-model stores provider and model, GET retrieves them."""
    from backend.context import CONTEXT

    project = _make_project()
    store: dict[str, tuple[str, str]] = {}

    monkeypatch.setattr(
        CONTEXT.state_manager,
        "get_project",
        lambda gid: project if gid == "-9001" else None,
    )
    monkeypatch.setattr(
        CONTEXT.openclaw_writer,
        "update_agent_model",
        lambda aid, prov, mdl: store.update({aid: (prov, mdl)}),
    )
    monkeypatch.setattr(
        CONTEXT.openclaw_writer,
        "get_agent_model",
        lambda aid: store.get(aid, ("", "")),
    )

    r = client.put(
        "/api/v1/settings/-9001/telegram-model",
        json={"provider": "anthropic", "model": "claude-sonnet-4-6"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    r2 = client.get("/api/v1/settings/-9001/telegram-model")
    assert r2.json()["provider"] == "anthropic"
    assert r2.json()["model"] == "claude-sonnet-4-6"


def test_get_telegram_model_404_for_unknown_group(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """GET telegram-model returns 404 for a group_id that has no project."""
    from backend.context import CONTEXT

    monkeypatch.setattr(
        CONTEXT.state_manager,
        "get_project",
        lambda gid: None,
    )

    r = client.get("/api/v1/settings/-0000/telegram-model")
    assert r.status_code == 404


def test_put_telegram_model_404_for_unknown_group(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PUT telegram-model returns 404 for a group_id that has no project."""
    from backend.context import CONTEXT

    monkeypatch.setattr(
        CONTEXT.state_manager,
        "get_project",
        lambda gid: None,
    )

    r = client.put(
        "/api/v1/settings/-0000/telegram-model",
        json={"provider": "anthropic", "model": "claude-sonnet-4-6"},
    )
    assert r.status_code == 404
