# tests/conftest.py
# Shared pytest fixtures — services wired with temp directories.
# Note: conftest imports from libs/backend are deferred to avoid import errors
# before those modules are implemented in later tasks.

import pathlib
import pytest
from loggerplusplus import loggerplusplus
from libs.state.state_manager import StateManager


@pytest.fixture
def tmp_data(tmp_path: pathlib.Path) -> pathlib.Path:
    """Temporary /data directory for state files."""
    d = tmp_path / "data"
    d.mkdir()
    return d


@pytest.fixture
def state_manager(tmp_data: pathlib.Path) -> StateManager:
    """StateManager wired to a temp directory."""
    return StateManager(data_dir=tmp_data)
