# tests/test_scheduler.py
import pytest
from libs.state.models import ScheduleConfig, TimeRange
from libs.scheduler.scheduler import SchedulerService


def make_schedule(start: str, end: str, days: list[str] = None, enabled: bool = True) -> ScheduleConfig:
    return ScheduleConfig(
        enabled=enabled,
        ranges=[TimeRange(start=start, end=end)],
        days=days or [],
    )


def test_in_range_simple():
    sched = make_schedule("08:00", "18:00")
    assert SchedulerService.is_in_schedule(sched, "mon", "10:00") is True
    assert SchedulerService.is_in_schedule(sched, "mon", "08:00") is True
    assert SchedulerService.is_in_schedule(sched, "mon", "07:59") is False
    assert SchedulerService.is_in_schedule(sched, "mon", "18:01") is False


def test_day_filter():
    sched = make_schedule("08:00", "18:00", days=["mon", "tue", "wed"])
    assert SchedulerService.is_in_schedule(sched, "mon", "10:00") is True
    assert SchedulerService.is_in_schedule(sched, "sat", "10:00") is False


def test_disabled_schedule():
    sched = make_schedule("08:00", "18:00", enabled=False)
    assert SchedulerService.is_in_schedule(sched, "mon", "10:00") is False


def test_midnight_end():
    # end=00:00 means midnight (end of day — 23:59 is still in range)
    sched = make_schedule("20:00", "00:00")
    assert SchedulerService.is_in_schedule(sched, "mon", "23:59") is True
    assert SchedulerService.is_in_schedule(sched, "mon", "21:00") is True
    assert SchedulerService.is_in_schedule(sched, "mon", "19:59") is False


def test_multiple_ranges():
    sched = ScheduleConfig(
        enabled=True,
        ranges=[
            TimeRange(start="08:00", end="12:00"),
            TimeRange(start="14:00", end="18:00"),
        ],
    )
    assert SchedulerService.is_in_schedule(sched, "mon", "09:00") is True
    assert SchedulerService.is_in_schedule(sched, "mon", "13:00") is False
    assert SchedulerService.is_in_schedule(sched, "mon", "15:00") is True


def test_empty_days_means_all_days():
    sched = make_schedule("08:00", "18:00", days=[])
    for day in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]:
        assert SchedulerService.is_in_schedule(sched, day, "10:00") is True
