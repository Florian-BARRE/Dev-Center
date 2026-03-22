import pytest
from libs.activity.activity_log import ActivityLog

@pytest.fixture
def log():
    return ActivityLog(max_entries=10)

def test_log_adds_entry(log):
    log.log("-123", "foo", "Bridge started (PID 999)")
    entries = log.recent(10)
    assert len(entries) == 1
    assert entries[0].event == "Bridge started (PID 999)"
    assert entries[0].group_id == "-123"
    assert entries[0].project_id == "foo"
    assert entries[0].level == "info"

def test_log_sets_timestamp(log):
    log.log("-123", "foo", "test")
    e = log.recent(1)[0]
    assert "T" in e.timestamp  # ISO-8601 format

def test_recent_returns_most_recent(log):
    for i in range(5):
        log.log("-123", "foo", f"event {i}")
    entries = log.recent(3)
    assert len(entries) == 3
    assert entries[-1].event == "event 4"

def test_ring_buffer_wraps_at_max(log):
    for i in range(15):  # max is 10
        log.log("-123", "foo", f"event {i}")
    entries = log.recent(100)
    assert len(entries) == 10
    assert entries[0].event == "event 5"  # oldest kept

def test_log_warning_level(log):
    log.log("-123", "foo", "Something odd", level="warning")
    assert log.recent(1)[0].level == "warning"

def test_recent_default_limit(log):
    for i in range(5):
        log.log("-123", "foo", f"event {i}")
    entries = log.recent()
    assert len(entries) == 5
