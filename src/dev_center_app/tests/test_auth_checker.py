import json

import pytest

from libs.auth_checker.auth_checker import AuthChecker


@pytest.fixture
def claude_dir(tmp_path):
    directory = tmp_path / '.claude'
    directory.mkdir()
    return directory


def test_not_authenticated_when_dir_empty(claude_dir):
    checker = AuthChecker(claude_dir=claude_dir)
    assert checker.is_authenticated() is False
    assert checker.get_email() is None


def test_authenticated_when_credentials_present(claude_dir):
    credentials = {
        'claudeAiOauth': {
            'accessToken': 'tok_123',
            'expiresAt': 9999999999000,
            'emailAddress': 'dev@example.com',
        }
    }
    (claude_dir / '.credentials.json').write_text(json.dumps(credentials))

    checker = AuthChecker(claude_dir=claude_dir)
    assert checker.is_authenticated() is True
    assert checker.get_email() == 'dev@example.com'


def test_not_authenticated_when_token_expired(claude_dir):
    credentials = {
        'claudeAiOauth': {
            'accessToken': 'tok_old',
            'expiresAt': 1000,
            'emailAddress': 'dev@example.com',
        }
    }
    (claude_dir / '.credentials.json').write_text(json.dumps(credentials))

    checker = AuthChecker(claude_dir=claude_dir)
    assert checker.is_authenticated() is False
