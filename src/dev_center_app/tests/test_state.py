# tests/test_state.py
import pytest
import pathlib
from libs.state.models import (
    Project, SessionState, ScheduleConfig, TimeRange,
    GlobalConfig, GlobalDefaults, StateFile,
)
from libs.state.state_manager import StateManager


def make_project(id="my-proj") -> Project:
    return Project(
        id=id,
        name=id,
        repo_url="https://github.com/user/my-proj",
        workspace_path=f"/workspaces/{id}",
    )


def test_state_manager_starts_empty(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    state = sm.load_projects()
    assert state.projects == {}


def test_upsert_and_get_project(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    p = make_project()
    sm.upsert_project(p)
    loaded = sm.get_project("my-proj")
    assert loaded is not None
    assert loaded.repo_url == "https://github.com/user/my-proj"


def test_delete_project(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    sm.upsert_project(make_project())
    sm.delete_project("my-proj")
    assert sm.get_project("my-proj") is None


def test_global_config_defaults(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    cfg = sm.load_global_config()
    assert cfg.defaults.default_model == "claude-sonnet-4-6"
    assert cfg.defaults.default_ttl_hours == 8


def test_save_load_global_config(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    cfg = sm.load_global_config()
    cfg.defaults.default_ttl_hours = 12
    sm.save_global_config(cfg)
    reloaded = sm.load_global_config()
    assert reloaded.defaults.default_ttl_hours == 12


def test_global_rules_roundtrip(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    sm.save_global_rules("# My rules\n- Use type hints\n")
    assert sm.load_global_rules() == "# My rules\n- Use type hints\n"


def test_project_id_derivation():
    from libs.state.models import derive_project_id
    assert derive_project_id("https://github.com/user/My_Project.git") == "my-project"
    assert derive_project_id("https://github.com/user/Patrimonium") == "patrimonium"
    assert derive_project_id("https://github.com/user/my--repo.git") == "my-repo"


def test_project_id_collision_handling(tmp_path):
    sm = StateManager(data_dir=tmp_path)
    sm.upsert_project(make_project("patrimonium"))
    unique = sm.unique_project_id("patrimonium")
    assert unique == "patrimonium-2"
    sm.upsert_project(make_project("patrimonium-2"))
    assert sm.unique_project_id("patrimonium") == "patrimonium-3"
