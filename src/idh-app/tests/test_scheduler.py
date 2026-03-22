import asyncio
import datetime
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from libs.scheduler.scheduler import SchedulerService
from libs.state.models import (
    Project, BridgeState, ScheduleConfig, ScheduleWindow, GlobalConfig
)

def make_project(bridge=None, schedule=None):
    return Project(
        group_id="-123",
        project_id="foo",
        repo_url="https://github.com/x/y",
        bridge=bridge,
        schedule=schedule,
    )

def make_window(start="08:00", end="16:00", days=None):
    if days is None:
        days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    return ScheduleWindow(start_time=start, end_time=end, days=days)

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
    svc = SchedulerService(
        state_manager=sm,
        bridge_manager=bm,
        global_config_manager=gcm,
        activity_log=al,
        telegram_notifier=tn,
        workspaces_dir=pathlib.Path("/workspaces"),
    )
    return svc

@pytest.mark.asyncio
async def test_start_returns_task(services):
    svc = make_scheduler(services)
    sm = services[0]
    sm.load.return_value = MagicMock(projects={})
    task = await svc.start()
    assert isinstance(task, asyncio.Task)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

@pytest.mark.asyncio
async def test_tick_starts_bridge_if_in_window(services):
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)

    schedule = ScheduleConfig(
        enabled=True,
        windows=[make_window()],  # all days, 08:00–16:00
    )
    project = make_project(bridge=None, schedule=schedule)
    sm.load.return_value = MagicMock(projects={"-123": project})
    sm.get_project.return_value = project

    # Patch _is_in_window to return True
    with patch.object(svc, "_is_in_window", return_value=True):
        await svc._tick()

    bm.start_bridge.assert_called_once()

@pytest.mark.asyncio
async def test_tick_stops_bridge_if_outside_window(services):
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)

    bridge = BridgeState(
        pid=999, workspace="/ws/foo",
        expires_at="2099-01-01T00:00:00+00:00",
        auto_renew=False,
    )
    schedule = ScheduleConfig(enabled=True, windows=[make_window()])
    project = make_project(bridge=bridge, schedule=schedule)
    sm.load.return_value = MagicMock(projects={"-123": project})
    sm.get_project.return_value = project

    with patch.object(svc, "_is_in_window", return_value=False):
        await svc._tick()

    bm.stop_bridge.assert_called_once_with("-123")

@pytest.mark.asyncio
async def test_tick_auto_renews_expiring_bridge(services):
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)

    # Bridge expires in 3 minutes
    expires = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=3)).isoformat()
    bridge = BridgeState(pid=999, workspace="/ws/foo", expires_at=expires, auto_renew=True)
    project = make_project(bridge=bridge)
    sm.load.return_value = MagicMock(projects={"-123": project})

    with patch.object(svc, "_is_in_window", return_value=True):
        await svc._tick()

    bm.renew_bridge.assert_called_once_with("-123")

@pytest.mark.asyncio
async def test_tick_sends_warning_when_in_lead_window(services):
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)

    # Window ends in 30 min, lead is 60 min → should warn
    expires = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=30)).isoformat()
    bridge = BridgeState(pid=999, workspace="/ws/foo", expires_at=expires, auto_renew=False)
    schedule = ScheduleConfig(enabled=True, windows=[make_window()], warn_lead_minutes=60)
    project = make_project(bridge=bridge, schedule=schedule)
    sm.load.return_value = MagicMock(projects={"-123": project})

    with patch.object(svc, "_is_in_window", return_value=True):
        await svc._tick()

    tn.send_alert.assert_called_once()
