# tests/test_auth_checker.py
import json
import pathlib
import pytest
from libs.auth_checker.auth_checker import AuthChecker


@pytest.fixture
def claude_dir(tmp_path):
    d = tmp_path / ".claude"
    d.mkdir()
    return d


def test_not_authenticated_when_dir_empty(claude_dir):
    checker = AuthChecker(claude_dir=claude_dir)
    assert checker.is_authenticated() is False
    assert checker.get_email() is None


def test_authenticated_when_credentials_present(claude_dir):
    creds = {
        "claudeAiOauth": {
            "accessToken": "tok_123",
            "expiresAt": 9999999999000,   # far future ms timestamp
            "emailAddress": "dev@example.com",
        }
    }
    (claude_dir / ".credentials.json").write_text(json.dumps(creds))
    checker = AuthChecker(claude_dir=claude_dir)
    assert checker.is_authenticated() is True
    assert checker.get_email() == "dev@example.com"


def test_not_authenticated_when_token_expired(claude_dir):
    creds = {
        "claudeAiOauth": {
            "accessToken": "tok_old",
            "expiresAt": 1000,  # already expired
            "emailAddress": "dev@example.com",
        }
    }
    (claude_dir / ".credentials.json").write_text(json.dumps(creds))
    checker = AuthChecker(claude_dir=claude_dir)
    assert checker.is_authenticated() is False


def test_authenticated_when_credentials_file_missing_but_claude_json_exists(tmp_path):
    claude_dir = tmp_path / ".claude"
    claude_dir.mkdir()
    # Some setups use ~/.claude.json instead
    (tmp_path / ".claude.json").write_text(json.dumps({"oauthToken": "tok_abc"}))
    checker = AuthChecker(claude_dir=claude_dir, claude_json_path=tmp_path / ".claude.json")
    assert checker.is_authenticated() is True
