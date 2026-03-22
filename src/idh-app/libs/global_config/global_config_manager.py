# ====== Code Summary ======
# Reads and writes idh-global-config.json — stores global defaults and schedule config.

# ====== Standard Library Imports ======
import json
import pathlib

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass

# ====== Local Project Imports ======
from libs.state.models import GlobalConfig, GlobalDefaults, ScheduleConfig


class GlobalConfigManager(LoggerClass):
    """
    Reads and writes the global configuration file (idh-global-config.json).

    The file stores GlobalDefaults (applied to new projects) and a global
    ScheduleConfig (used by projects in inherit mode).

    Attributes:
        _config_path (pathlib.Path): Path to idh-global-config.json.
    """

    def __init__(self, config_path: pathlib.Path) -> None:
        """
        Initialise the GlobalConfigManager.

        Args:
            config_path (pathlib.Path): Path to the global config JSON file.
        """
        LoggerClass.__init__(self)
        self._config_path = config_path
        self.logger.info(f"GlobalConfigManager initialised at '{config_path}'")

    # ──────────────────────────── Private helpers ────────────────────────────

    def _load(self) -> GlobalConfig:
        """
        Load and parse the config file, returning defaults if missing or malformed.

        Returns:
            GlobalConfig: Loaded or default config.
        """
        # 1. Return defaults if file does not exist
        if not self._config_path.exists():
            return GlobalConfig()

        # 2. Parse JSON, falling back to defaults on error
        try:
            raw = json.loads(self._config_path.read_text(encoding="utf-8"))
            return GlobalConfig.model_validate(raw)
        except (json.JSONDecodeError, ValueError, OSError) as exc:
            self.logger.warning(f"Could not parse global config: {exc} — returning defaults")
            return GlobalConfig()

    def _save(self, config: GlobalConfig) -> None:
        """
        Write the config to disk.

        Args:
            config (GlobalConfig): Config to persist.
        """
        # 1. Ensure parent directory exists
        self._config_path.parent.mkdir(parents=True, exist_ok=True)

        # 2. Write JSON
        self._config_path.write_text(
            config.model_dump_json(by_alias=True, indent=2),
            encoding="utf-8",
        )
        self.logger.debug(f"Saved global config to '{self._config_path}'")

    # ──────────────────────────── Public API ────────────────────────────────

    def get_config(self) -> GlobalConfig:
        """
        Return the full global config.

        Returns:
            GlobalConfig: The loaded (or default) config.
        """
        return self._load()

    def save_config(self, config: GlobalConfig) -> None:
        """
        Persist the full global config.

        Args:
            config (GlobalConfig): Config to save.
        """
        self._save(config)

    def get_defaults(self) -> GlobalDefaults:
        """
        Return the global project defaults section.

        Returns:
            GlobalDefaults: The defaults sub-object.
        """
        return self._load().defaults

    def save_defaults(self, defaults: GlobalDefaults) -> None:
        """
        Save the defaults section, preserving the schedule section.

        Args:
            defaults (GlobalDefaults): New defaults to persist.
        """
        # 1. Load existing config to preserve schedule
        config = self._load()
        config.defaults = defaults
        self._save(config)

    def get_schedule(self) -> ScheduleConfig:
        """
        Return the global schedule config section.

        Returns:
            ScheduleConfig: The schedule sub-object.
        """
        return self._load().schedule

    def save_schedule(self, schedule: ScheduleConfig) -> None:
        """
        Save the schedule section, preserving the defaults section.

        Args:
            schedule (ScheduleConfig): New schedule config to persist.
        """
        # 1. Load existing config to preserve defaults
        config = self._load()
        config.schedule = schedule
        self._save(config)
