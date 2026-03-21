# ====== Code Summary ======
# Tests for the /settings/global endpoints (coding-rules and common-context).

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient


def test_get_coding_rules_returns_content(client: TestClient, tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /settings/global/coding-rules returns file content."""
    from backend.context import CONTEXT
    # Write a temp rules file
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    rules_file = rules_dir / "CODING_RULES.md"
    rules_file.write_text("# My Rules")
    monkeypatch.setattr(CONTEXT.RUNTIME_CONFIG, "PATH_RULES_DIR", rules_dir)

    resp = client.get("/api/v1/settings/global/coding-rules")
    assert resp.status_code == 200
    assert resp.json()["content"] == "# My Rules"


def test_put_coding_rules_writes_content(client: TestClient, tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """PUT /settings/global/coding-rules writes to file."""
    from backend.context import CONTEXT
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    rules_file = rules_dir / "CODING_RULES.md"
    rules_file.write_text("")
    monkeypatch.setattr(CONTEXT.RUNTIME_CONFIG, "PATH_RULES_DIR", rules_dir)

    resp = client.put(
        "/api/v1/settings/global/coding-rules",
        json={"content": "# Updated Rules"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert rules_file.read_text() == "# Updated Rules"


def test_get_common_context_returns_content(client: TestClient, tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /settings/global/common-context returns file content."""
    from backend.context import CONTEXT
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    ctx_file = rules_dir / "COMMON_CONTEXT.md"
    ctx_file.write_text("# Context")
    monkeypatch.setattr(CONTEXT.RUNTIME_CONFIG, "PATH_RULES_DIR", rules_dir)

    resp = client.get("/api/v1/settings/global/common-context")
    assert resp.status_code == 200
    assert resp.json()["content"] == "# Context"


def test_put_common_context_writes_content(client: TestClient, tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """PUT /settings/global/common-context writes to file."""
    from backend.context import CONTEXT
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    ctx_file = rules_dir / "COMMON_CONTEXT.md"
    ctx_file.write_text("")
    monkeypatch.setattr(CONTEXT.RUNTIME_CONFIG, "PATH_RULES_DIR", rules_dir)

    resp = client.put(
        "/api/v1/settings/global/common-context",
        json={"content": "# Updated Context"}
    )
    assert resp.status_code == 200
    assert ctx_file.read_text() == "# Updated Context"
