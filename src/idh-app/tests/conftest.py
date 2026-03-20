# ====== Code Summary ======
# Pytest fixtures for idh-app test suite.
# NOTE: env vars are pre-set via pyproject.toml [tool.pytest.ini_options] env section.
# Do NOT set os.environ here — use pyproject.toml to guarantee pre-import ordering.

# ====== Standard Library Imports ======
import json
import pathlib

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session", autouse=True)
def create_test_dirs() -> None:
    """
    Create all tmp dirs required by tests and seed openclaw.json + rule templates.

    autouse=True: runs before any test without explicit fixture declaration.
    scope="session": runs once for the entire test session.
    """
    # 1. Create all required directories
    dirs = [
        pathlib.Path("/tmp/idh-test-data"),
        pathlib.Path("/tmp/idh-test-workspaces"),
        pathlib.Path("/tmp/idh-test-rules"),
        pathlib.Path("/tmp/idh-test-openclaw"),
        pathlib.Path("/tmp/idh-test-codex"),
        pathlib.Path("/tmp/idh-test-claude"),
        pathlib.Path("/tmp/idh-test-claude/projects"),
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)

    # 2. Seed openclaw.json with empty-but-valid structure
    openclaw_path = pathlib.Path("/tmp/idh-test-openclaw/openclaw.json")
    if not openclaw_path.exists():
        openclaw_path.write_text(
            json.dumps(
                {"agents": {}, "channels": {"telegram": {"groups": {}}}},
                indent=2,
            )
        )

    # 3. Seed rule templates
    rules_dir = pathlib.Path("/tmp/idh-test-rules")
    coding_rules = rules_dir / "CODING_RULES.md"
    common_context = rules_dir / "COMMON_CONTEXT.md"
    if not coding_rules.exists():
        coding_rules.write_text("# Coding Rules\n\nTest rules.\n")
    if not common_context.exists():
        common_context.write_text(
            "# Common Context\n\nProject: {project_id}\nRepo: {repo_url}\n"
        )


@pytest.fixture(scope="session")
def client() -> TestClient:
    """
    Return a TestClient for the idh-app FastAPI application.

    Env vars are already set by pytest-env before this import occurs.

    Returns:
        TestClient: Synchronous test client.
    """
    from entrypoint import app
    return TestClient(app)
