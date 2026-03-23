import json
import pytest
import pathlib
import tempfile
from libs.global_config.global_config_manager import GlobalConfigManager
from libs.state.models import GlobalConfig, GlobalDefaults, ScheduleConfig

@pytest.fixture
def tmp_config(tmp_path):
    return GlobalConfigManager(config_path=tmp_path / "idh-global-config.json")

def test_get_config_returns_defaults_when_missing(tmp_config):
    cfg = tmp_config.get_config()
    assert isinstance(cfg, GlobalConfig)
    assert cfg.defaults.default_provider == "anthropic"
    assert cfg.schedule.enabled is False

def test_save_and_reload_config(tmp_config):
    cfg = tmp_config.get_config()
    cfg.defaults.default_provider = "openai-codex"
    cfg.defaults.default_model = "gpt-5.1-codex"
    tmp_config.save_config(cfg)
    reloaded = tmp_config.get_config()
    assert reloaded.defaults.default_provider == "openai-codex"
    assert reloaded.defaults.default_model == "gpt-5.1-codex"

def test_get_defaults(tmp_config):
    d = tmp_config.get_defaults()
    assert isinstance(d, GlobalDefaults)

def test_save_defaults(tmp_config):
    d = tmp_config.get_defaults()
    d.default_bridge_ttl_hours = 12
    tmp_config.save_defaults(d)
    assert tmp_config.get_defaults().default_bridge_ttl_hours == 12

def test_get_schedule(tmp_config):
    s = tmp_config.get_schedule()
    assert isinstance(s, ScheduleConfig)
    assert s.enabled is False

def test_save_schedule(tmp_config):
    s = tmp_config.get_schedule()
    s.enabled = True
    tmp_config.save_schedule(s)
    reloaded = tmp_config.get_schedule()
    assert reloaded.enabled is True

def test_malformed_json_returns_defaults(tmp_path):
    path = tmp_path / "idh-global-config.json"
    path.write_text("{ not valid json }", encoding="utf-8")
    mgr = GlobalConfigManager(config_path=path)
    cfg = mgr.get_config()
    assert cfg.defaults.default_provider == "anthropic"
