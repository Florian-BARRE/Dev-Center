import asyncio
import datetime
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from libs.scheduler.scheduler import SchedulerService
from libs.state.models import Project, BridgeState, ScheduleConfig, TimeRange, GlobalConfig


def make_project(bridge=None, schedule=None):
    return Project(
        group_id="-123", project_id="foo",
        repo_url="https://github.com/x/y",
        bridge=bridge, schedule=schedule,
    )


@pytest.fixture
def services():
    state_manager = MagicMock()
    bridge_manager = AsyncMock()
    global_config_manager = MagicMock()
    activity_log = MagicMock()
    notifier = AsyncMock()
    global_config_manager.get_config.return_value = GlobalConfig()
    return state_manager, bridge_manager, global_config_manager, activity_log, notifier


def make_scheduler(services):
    import pathlib
    sm, bm, gcm, al, tn = services
    return SchedulerService(
        state_manager=sm, bridge_manager=bm, global_config_manager=gcm,
        activity_log=al, telegram_notifier=tn, workspaces_dir=pathlib.Path("/workspaces"),
    )


@pytest.mark.asyncio
async def test_tick_starts_session_when_entering_range(services):
    """Session starts when current time falls inside a configured range."""
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)
    schedule = ScheduleConfig(enabled=True, ranges=[TimeRange(start="08:00", end="23:00")], days=[])
    project = make_project(bridge=None, schedule=schedule)
    sm.load.return_value = MagicMock(projects={"-123": project})
    sm.get_project.return_value = project

    with patch.object(svc, "_is_in_active_range", return_value=True):
        await svc._tick()

    bm.start_bridge.assert_called_once()


@pytest.mark.asyncio
async def test_tick_stops_scheduled_session_when_outside_range(services):
    """Scheduler-managed session is stopped when current time exits the range."""
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)
    bridge = BridgeState(
        pid=999, workspace="/ws/foo",
        expires_at="2099-01-01T00:00:00+00:00",
        scheduled_session=True,
    )
    schedule = ScheduleConfig(enabled=True, ranges=[TimeRange(start="08:00", end="17:00")], days=[])
    project = make_project(bridge=bridge, schedule=schedule)
    sm.load.return_value = MagicMock(projects={"-123": project})
    sm.get_project.return_value = project

    with patch.object(svc, "_is_in_active_range", return_value=False):
        await svc._tick()

    bm.stop_bridge.assert_called_once_with("-123")


@pytest.mark.asyncio
async def test_tick_does_not_stop_manual_session_outside_range(services):
    """Manually started sessions (scheduled_session=False) are never stopped by scheduler."""
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)
    bridge = BridgeState(
        pid=999, workspace="/ws/foo",
        expires_at="2099-01-01T00:00:00+00:00",
        scheduled_session=False,
    )
    schedule = ScheduleConfig(enabled=True, ranges=[TimeRange(start="08:00", end="17:00")], days=[])
    project = make_project(bridge=bridge, schedule=schedule)
    sm.load.return_value = MagicMock(projects={"-123": project})

    with patch.object(svc, "_is_in_active_range", return_value=False):
        await svc._tick()

    bm.stop_bridge.assert_not_called()


@pytest.mark.asyncio
async def test_tick_auto_renews_expiring_scheduled_session(services):
    """A scheduled session expiring in < 5 min is renewed if still in range."""
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)
    expires = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=3)).isoformat()
    bridge = BridgeState(pid=999, workspace="/ws/foo", expires_at=expires, scheduled_session=True)
    project = make_project(bridge=bridge)
    sm.load.return_value = MagicMock(projects={"-123": project})

    with patch.object(svc, "_is_in_active_range", return_value=True):
        await svc._tick()

    bm.renew_bridge.assert_called_once_with("-123")


def test_is_in_active_range_returns_true_when_time_within_range():
    """_is_in_active_range returns True when now is within a configured range."""
    import pathlib
    svc = SchedulerService(
        state_manager=MagicMock(), bridge_manager=AsyncMock(),
        global_config_manager=MagicMock(), activity_log=MagicMock(),
        telegram_notifier=AsyncMock(), workspaces_dir=pathlib.Path("/ws"),
    )
    schedule = ScheduleConfig(enabled=True, ranges=[TimeRange(start="08:00", end="20:00")], days=[])
    midday = datetime.datetime(2026, 3, 23, 12, 0)  # Sunday 12:00 — all days
    assert svc._is_in_active_range(midday, schedule) is True


def test_is_in_active_range_returns_false_when_time_outside_all_ranges():
    import pathlib
    svc = SchedulerService(
        state_manager=MagicMock(), bridge_manager=AsyncMock(),
        global_config_manager=MagicMock(), activity_log=MagicMock(),
        telegram_notifier=AsyncMock(), workspaces_dir=pathlib.Path("/ws"),
    )
    schedule = ScheduleConfig(enabled=True, ranges=[TimeRange(start="09:00", end="17:00")], days=[])
    midnight = datetime.datetime(2026, 3, 23, 2, 0)
    assert svc._is_in_active_range(midnight, schedule) is False
