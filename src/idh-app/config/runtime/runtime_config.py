# ====== Code Summary ======
# Defines RUNTIME_CONFIG (env-based settings) and configures loggerplusplus sinks.
# Must be the first import in any entry point — registers sys.path.

# ====== Standard Library Imports ======
import os
import pathlib
import sys

# ====== Third-Party Library Imports ======
from configplusplus import EnvConfigLoader, env
from loggerplusplus import loggerplusplus
from loggerplusplus import formats as lpp_formats

# ─── Reset logger before anything else ───
loggerplusplus.remove()

# ─── Optional DEV_MODE early logger ───
# Read directly from os.environ (not via env()) because it must activate
# a temporary debug sink BEFORE the RUNTIME_CONFIG class is evaluated.
if os.environ.get("DEV_MODE"):
    loggerplusplus.add(sink=sys.stdout, level="DEBUG", format=lpp_formats.ShortFormat())
    dev_mode_logger = loggerplusplus.bind(identifier="DEV")
    dev_mode_logger.warning(f"DEV MODE is activated !")
    loggerplusplus.remove()


class RUNTIME_CONFIG(EnvConfigLoader):
    """
    Application runtime configuration loaded from environment variables.

    Evaluated at import time — all env() calls execute immediately when this
    module is imported. Must be the first import in every entry point because
    the class body calls sys.path.append() to register the libs/ directory.

    Raises:
        RuntimeError: If a required env var (e.g. IDH_WEBHOOK_SECRET) is absent
            and has no default value.
    """

    # ───── Paths ─────
    PATH_ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent.parent
    PATH_LIBS = PATH_ROOT_DIR / "libs"
    sys.path.append(str(PATH_LIBS))

    # ───── Logging (mandatory in every project) ─────
    LOGGING_CONSOLE_LEVEL = env("LOGGING_CONSOLE_LEVEL")
    LOGGING_FILE_LEVEL = env("LOGGING_FILE_LEVEL")
    LOGGING_ENABLE_CONSOLE = env("LOGGING_ENABLE_CONSOLE", cast=bool)
    LOGGING_ENABLE_FILE = env("LOGGING_ENABLE_FILE", cast=bool)
    LOGGING_LPP_FORMAT = env("LOGGING_LPP_FORMAT")

    # ───── FastAPI ─────
    FASTAPI_APP_NAME = env("FASTAPI_APP_NAME", default="IDH App")
    FASTAPI_DEBUG_MODE = env("FASTAPI_DEBUG_MODE", cast=bool, default=False)
    CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS", default="*")

    # ───── IDH ─────
    IDH_WEBHOOK_SECRET = env("IDH_WEBHOOK_SECRET")
    BRIDGE_TTL_HOURS = env("BRIDGE_TTL_HOURS", cast=int, default=8)
    OPENCLAW_GATEWAY_PORT = env("OPENCLAW_GATEWAY_PORT", cast=int, default=18789)

    # ───── Runtime data paths ─────
    PATH_DATA_DIR = pathlib.Path(env("DATA_DIR", default="/data"))
    PATH_STATE_FILE = PATH_DATA_DIR / "idh-projects.state.json"
    PATH_WORKSPACES = pathlib.Path(env("WORKSPACES_DIR", default="/workspaces"))
    PATH_RULES_DIR = pathlib.Path(env("RULES_DIR", default="/rules"))
    PATH_OPENCLAW_CONFIG = (
        pathlib.Path(env("OPENCLAW_CONFIG_DIR", default="/openclaw-config"))
        / "openclaw.json"
    )
    PATH_CODEX_DIR = pathlib.Path(env("CODEX_DIR", default="/home/app/.codex"))
    PATH_CLAUDE_DIR = pathlib.Path(env("CLAUDE_DIR", default="/home/app/.claude"))
    PATH_ROOT_DIR_FRONTEND = PATH_ROOT_DIR / "frontend" / "dist"


# ─── Apply logging configuration AFTER class definition ───
lpp_format = getattr(
    lpp_formats, RUNTIME_CONFIG.LOGGING_LPP_FORMAT, lpp_formats.DebugFormat
)()

if RUNTIME_CONFIG.LOGGING_ENABLE_CONSOLE:
    loggerplusplus.add(
        sink=sys.stdout,
        level=RUNTIME_CONFIG.LOGGING_CONSOLE_LEVEL,
        format=lpp_format,
    )

if RUNTIME_CONFIG.LOGGING_ENABLE_FILE:
    loggerplusplus.add(
        pathlib.Path("logs"),
        level=RUNTIME_CONFIG.LOGGING_FILE_LEVEL,
        format=lpp_format,
        rotation="1 week",
        retention="30 days",
        compression="zip",
        encoding="utf-8",
        enqueue=True,
        backtrace=True,
        diagnose=False,
    )
