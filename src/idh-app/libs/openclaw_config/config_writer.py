# ====== Code Summary ======
# OpenClawConfigWriter — reads/writes openclaw.json and registers groups via the gateway.

# ====== Standard Library Imports ======
import json
import pathlib

# ====== Third-Party Library Imports ======
import httpx
from filelock import FileLock
from loggerplusplus import LoggerClass


class OpenClawConfigWriter(LoggerClass):
    """
    Manages the openclaw.json configuration file and the OpenClaw gateway API.

    Provides atomic updates to openclaw.json via filelock and synchronises
    group/agent registrations with the OpenClaw gateway via httpx.

    Attributes:
        _config_path (pathlib.Path): Path to the openclaw.json file.
        _lock (FileLock): File-based lock for atomic JSON read/write.
        _gateway_base_url (str): Base URL for the OpenClaw gateway API.
    """

    def __init__(self, config_path: pathlib.Path, gateway_port: int) -> None:
        """
        Initialise the writer.

        Args:
            config_path (pathlib.Path): Path to the openclaw.json config file.
            gateway_port (int): Port number for the local OpenClaw gateway.
        """
        LoggerClass.__init__(self)
        self._config_path = config_path
        self._lock = FileLock(str(config_path) + ".lock")
        self._gateway_base_url = f"http://localhost:{gateway_port}"

    # ──────────────────────────── Private helpers ────────────────────────────

    def _read(self) -> dict:
        """
        Read and parse openclaw.json.

        Returns:
            dict: Parsed JSON content of the config file.
        """
        return json.loads(self._config_path.read_text())

    def _write(self, data: dict) -> None:
        """
        Serialise and write data to openclaw.json.

        Args:
            data (dict): Config data to persist.
        """
        self._config_path.write_text(json.dumps(data, indent=2))

    # ──────────────────────────── Public API ────────────────────────────────

    def update_agent_system_prompt(self, agent_id: str, system_prompt: str) -> None:
        """
        Set or replace the system_prompt for a given agent in openclaw.json.

        Args:
            agent_id (str): The agent identifier key in the ``agents`` dict.
            system_prompt (str): The new system prompt string.
        """
        # 1. Load the current config, update the target agent, and persist
        with self._lock:
            data = self._read()
            if "agents" not in data:
                data["agents"] = {}
            if agent_id not in data["agents"]:
                data["agents"][agent_id] = {}
            data["agents"][agent_id]["system_prompt"] = system_prompt
            self._write(data)
            self.logger.info(f"Updated system_prompt for agent '{agent_id}'")

    def register_group(
        self, group_id: str, project_id: str, agent_id: str
    ) -> httpx.Response:
        """
        Register a Telegram group with the OpenClaw gateway.

        Posts the group, project, and agent identifiers to the gateway so it
        can route incoming Telegram messages to the correct agent.

        Args:
            group_id (str): Telegram group ID.
            project_id (str): IDH project identifier.
            agent_id (str): OpenClaw agent identifier.

        Returns:
            httpx.Response: Raw gateway response.
        """
        # 1. POST group registration payload to the gateway
        self.logger.info(f"Registering group '{group_id}' with gateway")
        return httpx.post(
            f"{self._gateway_base_url}/api/channels/telegram/groups",
            json={"group_id": group_id, "project_id": project_id, "agent_id": agent_id},
        )

    def delete_group(self, group_id: str) -> httpx.Response:
        """
        Remove a Telegram group registration from the OpenClaw gateway.

        Args:
            group_id (str): Telegram group ID to deregister.

        Returns:
            httpx.Response: Raw gateway response.
        """
        # 1. DELETE the group from the gateway
        self.logger.info(f"Deleting group '{group_id}' from gateway")
        return httpx.delete(
            f"{self._gateway_base_url}/api/channels/telegram/groups/{group_id}"
        )
