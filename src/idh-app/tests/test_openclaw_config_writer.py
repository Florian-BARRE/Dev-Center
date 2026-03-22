# ====== Code Summary ======
# Tests for OpenClawConfigWriter — openclaw.json mutation and gateway registration.

# ====== Standard Library Imports ======
import json
import pathlib

# ====== Third-Party Library Imports ======
import pytest
import respx
import httpx

# ====== Internal Project Imports ======
from libs.openclaw_config.config_writer import OpenClawConfigWriter


@pytest.fixture
def openclaw_path(tmp_path: pathlib.Path) -> pathlib.Path:
    """Return a seeded openclaw.json in a temp directory."""
    path = tmp_path / "openclaw.json"
    path.write_text(
        json.dumps({"agents": {}, "channels": {"telegram": {"groups": {}}}}, indent=2)
    )
    return path


@pytest.fixture
def writer(openclaw_path: pathlib.Path) -> OpenClawConfigWriter:
    """Return an OpenClawConfigWriter wired to the temp openclaw.json."""
    return OpenClawConfigWriter(config_path=openclaw_path, gateway_port=18789)


def test_update_agent_system_prompt_persists(
    writer: OpenClawConfigWriter, openclaw_path: pathlib.Path
) -> None:
    """update_agent_system_prompt writes the system_prompt into openclaw.json."""
    writer.update_agent_system_prompt("agent-1", "You are a helpful assistant.")

    raw = json.loads(openclaw_path.read_text())
    assert raw["agents"]["agent-1"]["system_prompt"] == "You are a helpful assistant."


def test_update_agent_system_prompt_preserves_existing_agents(
    writer: OpenClawConfigWriter, openclaw_path: pathlib.Path
) -> None:
    """update_agent_system_prompt does not overwrite other agents."""
    writer.update_agent_system_prompt("agent-1", "Prompt 1")
    writer.update_agent_system_prompt("agent-2", "Prompt 2")

    raw = json.loads(openclaw_path.read_text())
    assert raw["agents"]["agent-1"]["system_prompt"] == "Prompt 1"
    assert raw["agents"]["agent-2"]["system_prompt"] == "Prompt 2"


def test_register_group_posts_to_gateway(
    writer: OpenClawConfigWriter,
) -> None:
    """register_group POSTs the group to the gateway and returns the response."""
    with respx.mock(base_url="http://localhost:18789") as mock:
        mock.post("/api/channels/telegram/groups").mock(
            return_value=httpx.Response(200, json={"status": "ok"})
        )
        response = writer.register_group(
            group_id="g1", project_id="p1", agent_id="a1"
        )
    assert response.status_code == 200


def test_register_group_sends_correct_payload(
    writer: OpenClawConfigWriter,
) -> None:
    """register_group sends group_id, project_id, agent_id in the POST body."""
    with respx.mock(base_url="http://localhost:18789") as mock:
        route = mock.post("/api/channels/telegram/groups").mock(
            return_value=httpx.Response(200, json={})
        )
        writer.register_group(group_id="g1", project_id="p1", agent_id="a1")

    sent = json.loads(route.calls[0].request.content)
    assert sent["group_id"] == "g1"
    assert sent["project_id"] == "p1"
    assert sent["agent_id"] == "a1"


def test_delete_group_sends_delete_request(
    writer: OpenClawConfigWriter,
) -> None:
    """delete_group sends a DELETE request to the gateway."""
    with respx.mock(base_url="http://localhost:18789") as mock:
        mock.delete("/api/channels/telegram/groups/g1").mock(
            return_value=httpx.Response(200, json={"status": "deleted"})
        )
        response = writer.delete_group("g1")
    assert response.status_code == 200


def test_update_agent_system_prompt_updates_existing_agent(
    writer: OpenClawConfigWriter, openclaw_path: pathlib.Path
) -> None:
    """update_agent_system_prompt overwrites an existing agent's system_prompt."""
    writer.update_agent_system_prompt("agent-1", "Original prompt")
    writer.update_agent_system_prompt("agent-1", "Updated prompt")

    raw = json.loads(openclaw_path.read_text())
    assert raw["agents"]["agent-1"]["system_prompt"] == "Updated prompt"


def test_update_agent_model_persists(
    writer: OpenClawConfigWriter, openclaw_path: pathlib.Path
) -> None:
    """update_agent_model writes provider and model into openclaw.json."""
    writer.update_agent_model("agent-1", "anthropic", "claude-sonnet-4-6")

    raw = json.loads(openclaw_path.read_text())
    assert raw["agents"]["agent-1"]["model"]["provider"] == "anthropic"
    assert raw["agents"]["agent-1"]["model"]["model"] == "claude-sonnet-4-6"


def test_update_agent_model_preserves_system_prompt(
    writer: OpenClawConfigWriter, openclaw_path: pathlib.Path
) -> None:
    """update_agent_model does not overwrite the agent's system_prompt."""
    writer.update_agent_system_prompt("agent-1", "Be helpful.")
    writer.update_agent_model("agent-1", "anthropic", "claude-opus-4-6")

    raw = json.loads(openclaw_path.read_text())
    assert raw["agents"]["agent-1"]["system_prompt"] == "Be helpful."
    assert raw["agents"]["agent-1"]["model"]["provider"] == "anthropic"


def test_get_agent_model_returns_empty_strings_when_unset(
    writer: OpenClawConfigWriter,
) -> None:
    """get_agent_model returns ('', '') for unknown agent."""
    provider, model = writer.get_agent_model("nonexistent")
    assert provider == ""
    assert model == ""


def test_get_agent_model_returns_set_values(
    writer: OpenClawConfigWriter,
) -> None:
    """get_agent_model returns the values written by update_agent_model."""
    writer.update_agent_model("agent-1", "anthropic", "claude-haiku-4-5")
    provider, model = writer.get_agent_model("agent-1")
    assert provider == "anthropic"
    assert model == "claude-haiku-4-5"


def test_get_agent_model_returns_empty_strings_for_agent_without_model_key(
    writer: OpenClawConfigWriter, openclaw_path: pathlib.Path
) -> None:
    """get_agent_model returns ('', '') for an agent that exists but has no model key."""
    writer.update_agent_system_prompt("agent-1", "Some prompt")  # agent exists, no model key
    provider, model = writer.get_agent_model("agent-1")
    assert provider == ""
    assert model == ""
