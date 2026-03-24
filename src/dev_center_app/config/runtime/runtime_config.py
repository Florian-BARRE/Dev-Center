# ====== Code Summary ======
# RUNTIME_CONFIG — environment-based settings and logging setup.
# Must be the first import in every entry point.

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
if os.environ.get("DEV_MODE"):
    loggerplusplus.add(sink=sys.stdout, level="DEBUG", format=lpp_formats.ShortFormat())
    _dev_logger = loggerplusplus.bind(identifier="DEV")
    _dev_logger.warning(f"DEV MODE activated")
    loggerplusplus.remove()


class RUNTIME_CONFIG(EnvConfigLoader):
    # ───── Paths ─────
    PATH_ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent.parent
    PATH_LIBS = PATH_ROOT_DIR / "libs"
    sys.path.append(str(PATH_LIBS))

    # ───── Logging ─────
    LOGGING_CONSOLE_LEVEL = env("LOGGING_CONSOLE_LEVEL", default="INFO")
    LOGGING_FILE_LEVEL = env("LOGGING_FILE_LEVEL", default="INFO")
    LOGGING_ENABLE_CONSOLE = env("LOGGING_ENABLE_CONSOLE", cast=bool, default=True)
    LOGGING_ENABLE_FILE = env("LOGGING_ENABLE_FILE", cast=bool, default=False)
    LOGGING_LPP_FORMAT = env("LOGGING_LPP_FORMAT", default="ShortFormat")

    # ───── FastAPI ─────
    FASTAPI_APP_NAME = env("FASTAPI_APP_NAME", default="dev-center-app")
    FASTAPI_DEBUG_MODE = env("FASTAPI_DEBUG_MODE", cast=bool, default=False)
    CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS", default="*")

    # ───── App paths ─────
    DATA_DIR = env("DATA_DIR", cast=pathlib.Path, default=pathlib.Path("/data"))
    WORKSPACES_DIR = env("WORKSPACES_DIR", cast=pathlib.Path, default=pathlib.Path("/workspaces"))
    CLAUDE_DIR = env("CLAUDE_DIR", cast=pathlib.Path, default=pathlib.Path.home() / ".claude")

    # ───── Session defaults ─────
    DEFAULT_TTL_HOURS = env("DEFAULT_TTL_HOURS", cast=int, default=8)
    RENEW_THRESHOLD_MINUTES = env("RENEW_THRESHOLD_MINUTES", cast=int, default=30)


# ─── Apply logging config after class definition ───
_lpp_format = getattr(lpp_formats, RUNTIME_CONFIG.LOGGING_LPP_FORMAT, lpp_formats.ShortFormat)()

if RUNTIME_CONFIG.LOGGING_ENABLE_CONSOLE:
    loggerplusplus.add(sink=sys.stdout, level=RUNTIME_CONFIG.LOGGING_CONSOLE_LEVEL, format=_lpp_format)

if RUNTIME_CONFIG.LOGGING_ENABLE_FILE:
    loggerplusplus.add(
        pathlib.Path("logs"),
        level=RUNTIME_CONFIG.LOGGING_FILE_LEVEL,
        format=_lpp_format,
        rotation="1 week",
        retention="30 days",
        compression="zip",
        encoding="utf-8",
        enqueue=True,
        backtrace=True,
        diagnose=False,
    )
