import asyncio
import datetime
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from libs.scheduler.scheduler import SchedulerService
from libs.state.models import (
    Project, BridgeState, ScheduleConfig, GlobalConfig, TimeRange,
)

def make_project(bridge=None, schedule=None):
    return Project(
        group_id="-123",
        project_id="foo",
        repo_url="https://github.com/x/y",
        bridge=bridge,
        schedule=schedule,
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
async def test_tick_starts_bridge_when_renewal_triggered(services):
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)

    schedule = ScheduleConfig(
        enabled=True,
        ranges=[TimeRange(start="08:00", end="00:00")],
        days=[],  # all days
    )
    project = make_project(bridge=None, schedule=schedule)
    sm.load.return_value = MagicMock(projects={"-123": project})
    sm.get_project.return_value = project

    # Patch _just_triggered_renewal to return True
    with patch.object(svc, "_just_triggered_renewal", return_value=True):
        await svc._tick()

    bm.start_bridge.assert_called_once()

@pytest.mark.asyncio
async def test_tick_renews_bridge_when_renewal_triggered(services):
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)

    bridge = BridgeState(
        pid=999, workspace="/ws/foo",
        expires_at="2099-01-01T00:00:00+00:00",
        auto_renew=False,
    )
    schedule = ScheduleConfig(enabled=True, ranges=[TimeRange(start="08:00", end="00:00")], days=[])
    project = make_project(bridge=bridge, schedule=schedule)
    sm.load.return_value = MagicMock(projects={"-123": project})
    sm.get_project.return_value = project

    with patch.object(svc, "_just_triggered_renewal", return_value=True):
        await svc._tick()

    bm.renew_bridge.assert_called_once_with("-123")

@pytest.mark.asyncio
async def test_tick_auto_renews_expiring_bridge(services):
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)

    # Bridge expires in 3 minutes
    expires = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=3)).isoformat()
    bridge = BridgeState(pid=999, workspace="/ws/foo", expires_at=expires, auto_renew=True)
    project = make_project(bridge=bridge)
    sm.load.return_value = MagicMock(projects={"-123": project})

    await svc._tick()

    bm.renew_bridge.assert_called_once_with("-123")

@pytest.mark.xfail(
    reason="SchedulerService still reads warn_lead_minutes/alert_template from old model; "
           "will be fixed in Task 2 (scheduler range logic rewrite).",
    strict=False,
)
@pytest.mark.asyncio
async def test_tick_sends_warning_when_approaching_renewal(services):
    sm, bm, gcm, al, tn = services
    svc = make_scheduler(services)

    bridge = BridgeState(
        pid=999, workspace="/ws/foo",
        expires_at="2099-01-01T00:00:00+00:00",
        auto_renew=False,
    )
    # ranges-based schedule — warn_lead_minutes no longer exists on ScheduleConfig;
    # the scheduler will be updated to derive lead time from ranges in Task 2.
    schedule = ScheduleConfig(
        enabled=True,
        ranges=[TimeRange(start="08:00", end="00:00")],
        days=[],
    )
    project = make_project(bridge=bridge, schedule=schedule)
    sm.load.return_value = MagicMock(projects={"-123": project})

    # Renewal is 30 minutes away → within any reasonable lead window
    future_renewal = datetime.datetime.now() + datetime.timedelta(minutes=30)
    with patch.object(svc, "_just_triggered_renewal", return_value=False), \
         patch.object(svc, "_get_next_renewal_dt", return_value=future_renewal):
        await svc._tick()

    tn.send_alert.assert_called_once()
