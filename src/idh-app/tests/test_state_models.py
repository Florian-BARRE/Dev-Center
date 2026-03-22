import pytest
from libs.state.models import (
    BridgeState, Project, ScheduleWindow, ScheduleConfig,
    GlobalDefaults, GlobalConfig, ActivityEntry
)

def test_bridge_state_auto_renew_default():
    b = BridgeState(pid=123, workspace="/ws/foo", expires_at="2026-03-22T10:00:00+00:00")
    assert b.auto_renew is False

def test_bridge_state_auto_renew_set():
    b = BridgeState(pid=123, workspace="/ws/foo", expires_at="2026-03-22T10:00:00+00:00", auto_renew=True)
    assert b.auto_renew is True

def test_schedule_window_camel():
    w = ScheduleWindow(start_time="08:00", end_time="16:00", days=["mon", "tue"])
    data = w.model_dump(by_alias=True)
    assert data["startTime"] == "08:00"
    assert data["endTime"] == "16:00"

def test_schedule_config_defaults():
    c = ScheduleConfig()
    assert c.enabled is False
    assert c.windows == []
    assert c.warn_lead_minutes == 60
    assert c.warn_interval_minutes == 10

def test_project_schedule_defaults_none():
    p = Project(group_id="-123", project_id="foo", repo_url="https://github.com/foo/bar")
    assert p.schedule is None

def test_global_config_defaults():
    g = GlobalConfig()
    assert g.defaults.default_provider == "anthropic"
    assert g.defaults.default_bridge_ttl_hours == 8
    assert g.schedule.enabled is False

def test_activity_entry_camel():
    e = ActivityEntry(
        timestamp="2026-03-22T10:00:00+00:00",
        group_id="-123",
        project_id="foo",
        event="Bridge started",
    )
    data = e.model_dump(by_alias=True)
    assert data["groupId"] == "-123"
    assert data["projectId"] == "foo"
    assert data["level"] == "info"
