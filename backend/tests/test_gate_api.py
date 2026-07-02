"""Tests for stage gate API endpoint."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from auth.jwt import require_user
from db.session import get_db
from main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def authed_client(client):
    mock_user = MagicMock()
    mock_user.id = "user-1"
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MagicMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def override_user():
        return mock_user

    async def override_db():
        yield mock_db

    app.dependency_overrides[require_user] = override_user
    app.dependency_overrides[get_db] = override_db
    yield client
    app.dependency_overrides.clear()


def test_gate_rejects_invalid_decision(authed_client):
    res = authed_client.post(
        "/api/projects/proj-1/generate/gate",
        json={"decision": "invalid"},
    )
    assert res.status_code == 400


def test_gate_rejects_when_not_waiting(authed_client):
    with patch("api.streaming.GateController.is_waiting", return_value=False):
        res = authed_client.post(
            "/api/projects/proj-1/generate/gate",
            json={"decision": "proceed"},
        )
    assert res.status_code == 409


def test_gate_accepts_rollback_when_waiting(authed_client):
    with patch("api.streaming.GateController.is_waiting", return_value=True):
        with patch("api.streaming.GateController.submit_decision", return_value=True):
            res = authed_client.post(
                "/api/projects/proj-1/generate/gate",
                json={"decision": "rollback"},
            )
    assert res.status_code == 200
    assert res.json()["decision"] == "rollback"
