"""SSE streaming endpoints for pipeline and chat."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.jwt import require_user
from db.models import Conversation, ConversationMessage, Message, Project, User
from db.session import get_db
from services.chat import refine_app_with_chat
from services.event_bus import ProjectEventBus
from services.gate_controller import GateController
from services.project_files import sync_project_files, update_file_and_app

router = APIRouter(prefix="/api/projects", tags=["streaming"])


class ChatStreamBody(BaseModel):
    message: str


class DesignStylesBody(BaseModel):
    selector: str
    styles: dict[str, str]


class GateDecisionBody(BaseModel):
    decision: str  # "proceed" | "rollback"


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


PACING_EVENTS = frozenset(
    {
        "thought",
        "action",
        "observation",
        "react_step",
        "run_status",
        "step_complete",
        "agent_start",
        "message_delta",
        "agent_complete",
        "handoff",
        "gate_prompt",
        "gate_rollback",
        "stage_output",
    }
)
REPLAY_PACING_SEC = 0.06

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


async def _stream_from_bus(project_id: str):
    # SSE comment — flush response headers immediately so the client sees an open stream.
    yield ": connected\n\n"
    replay_remaining = ProjectEventBus.buffer_size(project_id)
    first = True
    try:
        async for event_type, data in ProjectEventBus.subscribe(project_id):
            if replay_remaining > 0:
                if not first and event_type in PACING_EVENTS:
                    await asyncio.sleep(REPLAY_PACING_SEC)
                replay_remaining -= 1
            first = False
            yield _sse(event_type, data)
            await asyncio.sleep(0)
    finally:
        if ProjectEventBus.is_done(project_id):
            ProjectEventBus.trim_buffer(project_id)


@router.get("/{project_id}/generate/stream")
async def generate_stream_get(
    project_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Subscribe to pipeline SSE events (replay buffer + live)."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.userId == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "项目不存在")

    return StreamingResponse(
        _stream_from_bus(project_id),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/{project_id}/generate/stream")
async def generate_stream_post(
    project_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Subscribe to pipeline SSE (generation runs via background task on project create)."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.userId == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "项目不存在")

    return StreamingResponse(
        _stream_from_bus(project_id),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/{project_id}/generate/gate")
async def submit_gate_decision(
    project_id: str,
    body: GateDecisionBody,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit proceed/rollback decision at an agent stage gate."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.userId == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "项目不存在")

    decision = body.decision.strip().lower()
    if decision not in ("proceed", "rollback"):
        raise HTTPException(400, "decision 必须为 proceed 或 rollback")

    if not GateController.is_waiting(project_id):
        raise HTTPException(409, "当前没有待决策的阶段节点")

    if not GateController.submit_decision(project_id, decision):  # type: ignore[arg-type]
        raise HTTPException(409, "阶段决策已过期或已提交")

    return {"ok": True, "decision": decision}


@router.post("/{project_id}/chat/stream")
async def chat_stream(
    project_id: str,
    body: ChatStreamBody,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.message.strip():
        raise HTTPException(400, "Message is required")

    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.userId == user.id)
        .options(selectinload(Project.generatedApp))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    user_text = body.message.strip()

    if not project.generatedApp:
        async def empty_gen():
            yield ": connected\n\n"
            yield _sse("observation", {"content": "应用尚未生成，请先完成流水线。"})
            yield _sse(
                "message",
                {"role": "assistant", "agentId": "mike", "content": "请先等待流水线完成后再优化应用。"},
            )
            yield _sse("done", {})

        return StreamingResponse(
            empty_gen(),
            media_type="text/event-stream",
            headers=SSE_HEADERS,
        )

    current = {
        "html": project.generatedApp.html,
        "css": project.generatedApp.css,
        "js": project.generatedApp.js,
    }
    refined = await refine_app_with_chat(current, user_text)
    assistant_text = (
        f"{refined['response']} "
        f"({'AI refinement' if refined['mode'] == 'ai' else 'Mock refinement'})"
    )
    react_steps = [
        {"phase": "thought", "content": "理解用户的修改需求…"},
        {"phase": "action", "content": f"分析并应用：{user_text[:80]}"},
        {"phase": "observation", "content": refined["response"][:200]},
    ]

    db.add(Message(projectId=project_id, role="user", content=user_text))
    project.generatedApp.html = refined["app"]["html"]
    project.generatedApp.css = refined["app"]["css"]
    project.generatedApp.js = refined["app"]["js"]
    project.generatedApp.version += 1
    await sync_project_files(db, project_id, project.generatedApp)
    assistant = Message(
        projectId=project_id,
        role="assistant",
        content=assistant_text,
    )
    db.add(assistant)

    conv_result = await db.execute(
        select(Conversation).where(Conversation.projectId == project_id)
    )
    conv = conv_result.scalar_one_or_none()
    conv_assistant_msg = None
    if conv:
        db.add(
            ConversationMessage(
                conversationId=conv.id,
                role="user",
                content=user_text,
            )
        )
        conv_assistant_msg = ConversationMessage(
            conversationId=conv.id,
            role="assistant",
            content=assistant_text,
            agentId="alex",
            agentName="Alex",
            messageType="chat",
            status="complete",
            reactSteps=react_steps,
            stepCount=len(react_steps),
        )
        db.add(conv_assistant_msg)
        conv.updatedAt = datetime.now(timezone.utc)

    project.updatedAt = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(assistant)
    if conv_assistant_msg is not None:
        await db.refresh(conv_assistant_msg)

    persisted_message_id = (
        conv_assistant_msg.id if conv_assistant_msg is not None else assistant.id
    )

    async def event_generator():
        yield ": connected\n\n"
        yield _sse(
            "agent_start",
            {"agentId": "alex", "agentName": "Alex", "roleZh": "工程师"},
        )
        for step in react_steps:
            yield _sse(
                "react_step",
                {"agentId": "alex", "phase": step["phase"], "content": step["content"]},
            )
            await asyncio.sleep(0.15)

        chunks = [assistant_text[i : i + 12] for i in range(0, len(assistant_text), 12)]
        for chunk in chunks:
            yield _sse(
                "message",
                {"role": "assistant", "agentId": "alex", "content": chunk},
            )
            yield _sse(
                "message_delta",
                {"agentId": "alex", "delta": chunk},
            )
            await asyncio.sleep(0.04)

        yield _sse(
            "agent_complete",
            {
                "agentId": "alex",
                "agentName": "Alex",
                "roleZh": "工程师",
                "stepCount": len(react_steps),
                "fullContent": assistant_text,
                "reactSteps": react_steps,
                "messageType": "chat",
                "status": "complete",
            },
        )
        yield _sse(
            "message_complete",
            {
                "id": persisted_message_id,
                "role": "assistant",
                "content": assistant_text,
                "agentId": "alex",
                "agentName": "Alex",
                "createdAt": assistant.createdAt.isoformat(),
                "reactSteps": react_steps,
                "stepCount": len(react_steps),
            },
        )
        yield _sse("done", {})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.post("/{project_id}/design/styles")
async def apply_design_styles(
    project_id: str,
    body: DesignStylesBody,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.userId == user.id)
        .options(selectinload(Project.generatedApp))
    )
    project = result.scalar_one_or_none()
    if not project or not project.generatedApp:
        raise HTTPException(404, "应用不存在")

    css = project.generatedApp.css
    rule_props = "\n".join(f"  {k}: {v};" for k, v in body.styles.items())
    block = f"\n{body.selector} {{\n{rule_props}\n}}\n"
    project.generatedApp.css = css + block
    project.generatedApp.version += 1
    await update_file_and_app(db, project_id, "styles.css", project.generatedApp.css)
    project.updatedAt = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "version": project.generatedApp.version}
