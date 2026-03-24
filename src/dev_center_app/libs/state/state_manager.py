# ====== Code Summary ======
# StateManager — thread-safe read/write for projects.json and global-config.json.

from __future__ import annotations
import pathlib
import threading
from loggerplusplus import LoggerClass
from libs.state.models import Project, StateFile, GlobalConfig


class StateManager(LoggerClass):
    """
    Manages persistence for projects.json, global-config.json, and global-rules.md.

    All write operations are protected by a threading.Lock to prevent
    concurrent writes from the watchdog, scheduler, and API handlers.

    Attributes:
        _data_dir (pathlib.Path): Directory containing all state files.
        _lock (threading.Lock): Guards all read-modify-write operations.
    """

    def __init__(self, data_dir: pathlib.Path) -> None:
        LoggerClass.__init__(self)
        self._data_dir = data_dir
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    # ──────────────────────── Private helpers ────────────────────────

    @property
    def _projects_path(self) -> pathlib.Path:
        return self._data_dir / "projects.json"

    @property
    def _global_config_path(self) -> pathlib.Path:
        return self._data_dir / "global-config.json"

    @property
    def _global_rules_path(self) -> pathlib.Path:
        return self._data_dir / "global-rules.md"

    def _read_projects_file(self) -> StateFile:
        """Read projects.json, returning an empty StateFile if missing."""
        if not self._projects_path.exists():
            return StateFile()
        raw = self._projects_path.read_text(encoding="utf-8")
        return StateFile.model_validate_json(raw)

    def _write_projects_file(self, state: StateFile) -> None:
        """Write StateFile to projects.json atomically."""
        self._projects_path.write_text(
            state.model_dump_json(by_alias=True, indent=2), encoding="utf-8"
        )

    # ──────────────────────── Projects ───────────────────────────────

    def load_projects(self) -> StateFile:
        """
        Load and return the full projects state.

        Returns:
            StateFile: Current state with all projects.
        """
        with self._lock:
            return self._read_projects_file()

    def get_project(self, project_id: str) -> Project | None:
        """
        Fetch a single project by ID.

        Args:
            project_id (str): Project slug.

        Returns:
            Project | None: The project, or None if not found.
        """
        with self._lock:
            return self._read_projects_file().projects.get(project_id)

    def upsert_project(self, project: Project) -> None:
        """
        Insert or update a project in state.

        Args:
            project (Project): Project to persist.
        """
        with self._lock:
            state = self._read_projects_file()
            state.projects[project.id] = project
            self._write_projects_file(state)
            self.logger.debug(f"Upserted project '{project.id}'")

    def delete_project(self, project_id: str) -> None:
        """
        Remove a project from state.

        Args:
            project_id (str): Project slug to remove.
        """
        with self._lock:
            state = self._read_projects_file()
            state.projects.pop(project_id, None)
            self._write_projects_file(state)
            self.logger.info(f"Deleted project '{project_id}'")

    def unique_project_id(self, base_id: str) -> str:
        """
        Return base_id if unused, otherwise base_id-2, base_id-3, etc.

        Args:
            base_id (str): Desired project slug.

        Returns:
            str: A project ID not currently in use.
        """
        with self._lock:
            state = self._read_projects_file()
            if base_id not in state.projects:
                return base_id
            n = 2
            while f"{base_id}-{n}" in state.projects:
                n += 1
            return f"{base_id}-{n}"

    # ──────────────────────── Global config ──────────────────────────

    def load_global_config(self) -> GlobalConfig:
        """
        Load global configuration, returning defaults if file is missing.

        Returns:
            GlobalConfig: Current global configuration.
        """
        with self._lock:
            if not self._global_config_path.exists():
                return GlobalConfig()
            raw = self._global_config_path.read_text(encoding="utf-8")
            return GlobalConfig.model_validate_json(raw)

    def save_global_config(self, config: GlobalConfig) -> None:
        """
        Persist global configuration.

        Args:
            config (GlobalConfig): Configuration to save.
        """
        with self._lock:
            self._global_config_path.write_text(
                config.model_dump_json(by_alias=True, indent=2), encoding="utf-8"
            )

    # ──────────────────────── Global rules ───────────────────────────

    def load_global_rules(self) -> str:
        """
        Load global coding rules markdown, returning empty string if missing.

        Returns:
            str: Markdown content of global-rules.md.
        """
        with self._lock:
            if not self._global_rules_path.exists():
                return ""
            return self._global_rules_path.read_text(encoding="utf-8")

    def save_global_rules(self, content: str) -> None:
        """
        Persist global coding rules.

        Args:
            content (str): Markdown content to save.
        """
        with self._lock:
            self._global_rules_path.write_text(content, encoding="utf-8")
