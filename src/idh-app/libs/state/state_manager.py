# ====== Code Summary ======
# StateManager — thread/process-safe CRUD over idh-projects.state.json using filelock.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
from filelock import FileLock
from loggerplusplus import LoggerClass

# ====== Local Project Imports ======
from .models import Project, StateFile


class StateManager(LoggerClass):
    """
    Thread-safe manager for the idh-app project state file.

    Uses a ``FileLock`` alongside the state file to prevent concurrent writes
    from multiple processes or threads.

    Attributes:
        _path (pathlib.Path): Path to the JSON state file.
        _lock (FileLock): File-based lock for atomic read/write operations.
    """

    def __init__(self, state_path: pathlib.Path) -> None:
        """
        Initialise the StateManager.

        Args:
            state_path (pathlib.Path): Path to the state JSON file.
        """
        LoggerClass.__init__(self)
        self._path = state_path
        self._lock = FileLock(str(state_path) + ".lock")

    # ──────────────────────────── Private helpers ────────────────────────────

    def _read(self) -> StateFile:
        """
        Read the state file from disk and deserialise it.

        Returns:
            StateFile: The current persisted state, or an empty StateFile
                       if the file does not yet exist.
        """
        # 1. Return empty state if the file has never been written
        if not self._path.exists():
            return StateFile()

        # 2. Parse and return the persisted state
        return StateFile.model_validate_json(self._path.read_text())

    def _write(self, state: StateFile) -> None:
        """
        Serialise and persist the state to disk.

        Args:
            state (StateFile): The state object to write.
        """
        # 1. Write camelCase JSON with no null fields
        self._path.write_text(
            state.model_dump_json(by_alias=True, exclude_none=True, indent=2)
        )

    # ──────────────────────────── Public API ────────────────────────────────

    def load(self) -> StateFile:
        """
        Load the full state file under a file lock.

        Returns:
            StateFile: Current project state.
        """
        with self._lock:
            return self._read()

    def save(self, state: StateFile) -> None:
        """
        Persist the full state file under a file lock.

        Args:
            state (StateFile): State to write.
        """
        with self._lock:
            self._write(state)

    def get_project(self, group_id: str) -> Project | None:
        """
        Retrieve a single project by Telegram group ID.

        Args:
            group_id (str): Telegram group ID key.

        Returns:
            Project | None: The project, or None if not found.
        """
        # 1. Load state and return the matching project (or None)
        with self._lock:
            state = self._read()
            return state.projects.get(group_id)

    def upsert_project(self, group_id: str, project: Project) -> None:
        """
        Insert or update a project under a file lock.

        Args:
            group_id (str): Telegram group ID key.
            project (Project): Project data to store.
        """
        # 1. Load current state, update the entry, and persist
        with self._lock:
            state = self._read()
            state.projects[group_id] = project
            self._write(state)
