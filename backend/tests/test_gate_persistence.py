"""Tests for gate timeline persistence helpers."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from db.models import ConversationMessage
from services.generation import (
    make_gate_event_id,
    make_stage_message_id,
    persist_handoff_event,
    persist_rollback_event,
    upsert_stage_message,
)


@pytest.fixture
def mock_conv():
    conv = MagicMock()
    conv.id = "conv-1"
    return conv


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_make_stage_message_id_is_unique():
    ids = {make_stage_message_id("emma") for _ in range(20)}
    assert len(ids) == 20
    assert all(item.startswith("stage-emma-") for item in ids)


def test_make_gate_event_id_includes_kind_and_agent():
    event_id = make_gate_event_id("handoff", "mike")
    assert event_id.startswith("handoff-mike-")


@pytest.mark.asyncio
async def test_upsert_stage_message_creates_streaming_row(mock_db, mock_conv):
    await upsert_stage_message(
        mock_db,
        mock_conv,
        "emma",
        "stage-emma-1",
        "preview content",
        [{"phase": "thought", "content": "analyze"}],
    )

    mock_db.add.assert_called_once()
    msg = mock_db.add.call_args[0][0]
    assert isinstance(msg, ConversationMessage)
    assert msg.id == "stage-emma-1"
    assert msg.conversationId == "conv-1"
    assert msg.agentId == "emma"
    assert msg.status == "streaming"
    assert msg.messageType == "plan"


@pytest.mark.asyncio
async def test_persist_handoff_event_stores_anchor_metadata(mock_db, mock_conv):
    created_at = datetime(2026, 6, 30, 3, 1, tzinfo=timezone.utc)
    await persist_handoff_event(
        mock_db,
        mock_conv,
        "ho-mike-emma",
        "mike",
        "emma",
        "计划已确认，直接推进。@Emma",
        "stage-mike-1",
        created_at,
    )

    mock_db.add.assert_called_once()
    msg = mock_db.add.call_args[0][0]
    assert msg.messageType == "handoff"
    assert msg.metadata_["from"] == "mike"
    assert msg.metadata_["to"] == "emma"
    assert msg.metadata_["insertAfterMessageId"] == "stage-mike-1"
    assert msg.metadata_["eventKind"] == "handoff"


@pytest.mark.asyncio
async def test_persist_rollback_event_stores_anchor_metadata(mock_db, mock_conv):
    created_at = datetime(2026, 6, 30, 3, 10, tzinfo=timezone.utc)
    await persist_rollback_event(
        mock_db,
        mock_conv,
        "rb-emma-1",
        "emma",
        "Emma",
        "产品经理",
        "回退：重新执行 Emma（产品经理） 阶段",
        "stage-emma-1",
        created_at,
    )

    mock_db.add.assert_called_once()
    msg = mock_db.add.call_args[0][0]
    assert msg.messageType == "system"
    assert msg.metadata_["eventKind"] == "rollback"
    assert msg.metadata_["agentId"] == "emma"
    assert msg.metadata_["insertAfterMessageId"] == "stage-emma-1"
