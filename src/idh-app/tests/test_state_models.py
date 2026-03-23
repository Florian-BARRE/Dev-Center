import pytest
from libs.state.models import (
    BridgeState, Project, ScheduleConfig,
    GlobalDefaults, GlobalConfig, ActivityEntry,
    TimeRange,
)

def test_bridge_state_auto_renew_default():
    b = BridgeState(pid=123, workspace="/ws/foo", expires_at="2026-03-22T10:00:00+00:00")
    assert b.auto_renew is False

def test_bridge_state_auto_renew_set():
    b = BridgeState(pid=123, workspace="/ws/foo", expires_at="2026-03-22T10:00:00+00:00", auto_renew=True)
    assert b.auto_renew is True

def test_schedule_config_defaults():
    c = ScheduleConfig()
    assert c.enabled is False
    assert c.ranges == []
    assert c.days == []

def test_schedule_config_ranges_camel():
    c = ScheduleConfig(
        enabled=True,
        ranges=[TimeRange(start="08:00", end="00:00"), TimeRange(start="16:00", end="00:00")],
        days=["mon", "fri"],
    )
    data = c.model_dump(by_alias=True)
    assert len(data["ranges"]) == 2
    assert data["ranges"][0]["start"] == "08:00"
    assert data["days"] == ["mon", "fri"]

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


def test_new_schedule_config_accepts_ranges():
    cfg = ScheduleConfig(
        enabled=True,
        ranges=[{"start": "08:00", "end": "00:00"}],
        days=["mon", "fri"],
    )
    assert len(cfg.ranges) == 1
    assert cfg.ranges[0].start == "08:00"
    assert cfg.ranges[0].end == "00:00"


def test_schedule_config_migrates_old_renewal_times():
    """Old persisted format with renewalTimes is migrated transparently."""
    old_data = {
        "enabled": True,
        "renewalTimes": ["08:00", "18:00"],
        "days": [],
        "warnLeadMinutes": 30,
        "warnIntervalMinutes": 10,
        "alertTemplate": "Bridge renewing in {remaining}",
    }
    cfg = ScheduleConfig.model_validate(old_data)
    assert len(cfg.ranges) == 2
    assert cfg.ranges[0].start == "08:00"
    assert cfg.ranges[0].end == "00:00"
    assert cfg.ranges[1].start == "18:00"


def test_bridge_state_has_scheduled_session_flag():
    bs = BridgeState(pid=1, workspace="/ws", expires_at="2099-01-01T00:00:00+00:00")
    assert bs.scheduled_session is False

    bs2 = BridgeState(pid=1, workspace="/ws", expires_at="2099-01-01T00:00:00+00:00", scheduled_session=True)
    assert bs2.scheduled_session is True
