# ====== Code Summary ======
# Pytest fixtures for idh-app test suite.
# NOTE: env vars are pre-set via pyproject.toml [tool.pytest.ini_options] env section.
# Do NOT set os.environ here — use pyproject.toml to guarantee pre-import ordering.

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient


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
