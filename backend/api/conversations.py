import json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.jwt import require_user
from db.models import Conversation, ConversationMessage, Project, User
from db.session import get_db
from services.chat import (
    build_prompt_from_conversation,
    generate_agent_chat_response,
    parse_mention,
    suggest_conversation_title,
)
from services.generation import create_agent_run_data, run_project_generation

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

THEME_SUFFIX = {
    "modern": "\n\n视觉风格：现代渐变、圆角卡片。",
    "minimal": "\n\n视觉风格：极简留白、细线边框。",
    "dark": "\n\n视觉风格：深色背景、高对比文字。",
    "playful": "\n\n视觉风格：明亮色彩、趣味动效。",
}


class CreateConversationBody(BaseModel):
    title: str | None = None
    theme: str | None = "modern"


class MessageBody(BaseModel):
    message: str
    agentId: str | None = None


class BuildBody(BaseModel):
    theme: str | None = None


def _serialize_dt(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _normalize_react_steps(raw) -> list | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return []
    return raw if isinstance(raw, list) else []


def _serialize_message(m: ConversationMessage) -> dict:
    return {
        "id": m.id,
        "conversationId": m.conversationId,
        "role": m.role,
        "content": m.content,
        "agentId": m.agentId,
        "agentName": m.agentName,
        "reactSteps": _normalize_react_steps(m.reactSteps),
        "messageType": m.messageType,
        "metadata": m.metadata_,
        "status": m.status,
        "stepCount": m.stepCount,
        "createdAt": _serialize_dt(m.createdAt),
    }


def _conv_to_dict(conv: Conversation, include_messages: bool = False) -> dict:
    data = {
        "id": conv.id,
        "userId": conv.userId,
        "title": conv.title,
        "theme": conv.theme,
        "projectId": conv.projectId,
        "createdAt": _serialize_dt(conv.createdAt),
        "updatedAt": _serialize_dt(conv.updatedAt),
    }
    if include_messages:
        data["messages"] = [_serialize_message(m) for m in conv.messages]
    if conv.project:
        data["project"] = {
            "id": conv.project.id,
            "name": conv.project.name,
            "status": conv.project.status,
        }
    return data


@router.get("")
async def list_conversations(
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.userId == user.id)
        .options(
            selectinload(Conversation.messages),
            selectinload(Conversation.project),
        )
        .order_by(Conversation.updatedAt.desc())
    )
    conversations = result.scalars().unique().all()
    out = []
    for c in conversations:
        d = _conv_to_dict(c)
        d["messages"] = (
            [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "createdAt": _serialize_dt(m.createdAt),
                }
                for m in sorted(c.messages, key=lambda x: x.createdAt, reverse=True)[:1]
            ]
            if c.messages
            else []
        )
        d["_count"] = {"messages": len(c.messages)}
        out.append(d)
    return {"conversations": out}


@router.post("")
async def create_conversation(
    body: CreateConversationBody,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    conv = Conversation(
        userId=user.id,
        title=body.title.strip() if body.title else None,
        theme=body.theme or "modern",
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return {"conversation": _conv_to_dict(conv)}


@router.get("/{conv_id}")
async def get_conversation(
    conv_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv_id, Conversation.userId == user.id)
        .options(
            selectinload(Conversation.messages),
            selectinload(Conversation.project),
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "对话不存在")
    return {"conversation": _conv_to_dict(conv, include_messages=True)}


@router.patch("/{conv_id}")
async def update_conversation(
    conv_id: str,
    body: dict,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.userId == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "对话不存在")
    if "title" in body:
        conv.title = body["title"].strip() if body.get("title") else None
    if "theme" in body:
        conv.theme = body["theme"]
    conv.updatedAt = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conv)
    return {"conversation": _conv_to_dict(conv)}


@router.delete("/{conv_id}")
async def delete_conversation(
    conv_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv_id, Conversation.userId == user.id)
        .options(selectinload(Conversation.messages), selectinload(Conversation.project))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "对话不存在")

    project_id = conv.projectId
    message_count = len(conv.messages)

    if project_id:
        proj_result = await db.execute(
            select(Project.id).where(Project.id == project_id, Project.userId == user.id)
        )
        if proj_result.scalar_one_or_none():
            await db.execute(delete(Project).where(Project.id == project_id))

    # Bulk delete — rely on DB ON DELETE CASCADE for ConversationMessage;
    # ORM delete() would nullify conversationId and violate NOT NULL.
    await db.execute(
        delete(Conversation).where(Conversation.id == conv_id, Conversation.userId == user.id)
    )

    await db.commit()
    return {"ok": True, "deletedProjectId": project_id, "messageCount": message_count}


@router.post("/{conv_id}/messages")
async def send_message(
    conv_id: str,
    body: MessageBody,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.message.strip():
        raise HTTPException(400, "消息不能为空")

    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv_id, Conversation.userId == user.id)
        .options(selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "对话不存在")

    mention_id, clean = parse_mention(body.message.strip())
    target = body.agentId or mention_id
    content = clean or body.message.strip()

    user_msg = ConversationMessage(
        conversationId=conv_id,
        role="user",
        content=body.message.strip(),
    )
    db.add(user_msg)
    await db.flush()

    history = [
        {"role": m.role, "content": m.content, "agentId": m.agentId, "agentName": m.agentName}
        for m in conv.messages
    ]
    response = await generate_agent_chat_response(history, content, target)

    assistant_msg = ConversationMessage(
        conversationId=conv_id,
        role="assistant",
        content=response["content"],
        agentId=response["agentId"],
        agentName=response["agentName"],
    )
    db.add(assistant_msg)

    if not conv.title:
        conv.title = suggest_conversation_title(body.message.strip())
    conv.updatedAt = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return {
        "userMessage": {
            "id": user_msg.id,
            "role": user_msg.role,
            "content": user_msg.content,
            "createdAt": _serialize_dt(user_msg.createdAt),
        },
        "assistantMessage": {
            "id": assistant_msg.id,
            "role": assistant_msg.role,
            "content": assistant_msg.content,
            "agentId": assistant_msg.agentId,
            "agentName": assistant_msg.agentName,
            "createdAt": _serialize_dt(assistant_msg.createdAt),
        },
        "mode": response["mode"],
    }


@router.post("/{conv_id}/build")
async def build_project(
    conv_id: str,
    body: BuildBody,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv_id, Conversation.userId == user.id)
        .options(selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "对话不存在")

    if conv.projectId:
        return {"projectId": conv.projectId, "conversationId": conv.id}

    history = [{"role": m.role, "content": m.content} for m in conv.messages]
    theme_id = body.theme or conv.theme or "modern"
    prompt = build_prompt_from_conversation(history)
    prompt += THEME_SUFFIX.get(theme_id, "")

    project_name = (conv.title or "").strip() or prompt[:50] or "新项目"

    project = Project(
        userId=user.id,
        name=project_name,
        prompt=prompt,
        status="generating",
        theme=theme_id,
    )
    db.add(project)
    await db.flush()

    from db.models import Message as ProjectMessage

    db.add(ProjectMessage(projectId=project.id, role="user", content=prompt))
    for run_data in create_agent_run_data(prompt):
        from db.models import AgentRun

        db.add(AgentRun(projectId=project.id, **run_data))

    conv.projectId = project.id
    conv.theme = theme_id
    await db.commit()

    background_tasks.add_task(run_project_generation, project.id, prompt, theme_id)
    return {"projectId": project.id, "conversationId": conv.id}
