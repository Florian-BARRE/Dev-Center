# ====== Code Summary ======
# Shared application context — typed service locator.
# Type annotations only. All values assigned at startup in entrypoint.py.

# ====== Standard Library Imports ======
from typing import Type

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerPlusPlus

# ====== Internal Project Imports ======
from config import RUNTIME_CONFIG
from libs.activity.activity_log import ActivityLog
from libs.bridge.bridge_manager import BridgeManager
from libs.git_ops.git_manager import GitManager
from libs.global_config.global_config_manager import GlobalConfigManager
from libs.memory.codex_summarizer import CodexSummarizer
from libs.memory.memory_manager import MemoryManager
from libs.openclaw_config.config_writer import OpenClawConfigWriter
from libs.scheduler.scheduler import SchedulerService
from libs.state.state_manager import StateManager
from libs.webhook.webhook_client import WebhookClient


class CONTEXT:
    """
    Shared application context — typed service locator.

    All attributes assigned in entrypoint.py before create_app() is called.
    Never instantiate this class — access attributes at class level.
    """

    def __new__(cls) -> None:
        raise TypeError("CONTEXT is a static-only class and cannot be instantiated.")

    logger: LoggerPlusPlus
    RUNTIME_CONFIG: Type[RUNTIME_CONFIG]

    # ── Services ──
    state_manager: StateManager
    openclaw_writer: OpenClawConfigWriter
    git_manager: GitManager
    webhook_client: WebhookClient
    bridge_manager: BridgeManager
    memory_manager: MemoryManager
    codex_summarizer: CodexSummarizer
    activity_log: ActivityLog
    global_config_manager: GlobalConfigManager
    scheduler: SchedulerService
