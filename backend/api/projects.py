from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.jwt import require_user
from config import get_settings
from db.models import Artifact, Conversation, GeneratedApp, Message, Project, User
from db.session import get_db
from agents.template_renderer import build_preview_document
from services.chat import refine_app_with_chat
from services.generation import (
    create_agent_run_data,
    generate_mock_app,
    run_project_generation,
    seed_template_project,
)
from services.github import export_project_to_github, resolve_github_token, validate_github_token
from services.templates_data import get_template_app_type, get_template_by_id

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectBody(BaseModel):
    prompt: str | None = None
    name: str | None = None
    templateId: str | None = None


class CloneTemplateBody(BaseModel):
    templateId: str
    name: str | None = None
    fullPipeline: bool | None = False


class ChatBody(BaseModel):
    message: str


class GitHubExportBody(BaseModel):
    repoName: str
    isPrivate: bool | None = False
    existingRepo: bool | None = False
    githubToken: str | None = None


def _dt(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _project_dict(project: Project, full: bool = False, conversation_id: str | None = None) -> dict:
    data = {
        "id": project.id,
        "userId": project.userId,
        "name": project.name,
        "description": project.description,
        "prompt": project.prompt,
        "status": project.status,
        "templateId": project.templateId,
        "theme": project.theme,
        "conversationId": conversation_id,
        "createdAt": _dt(project.createdAt),
        "updatedAt": _dt(project.updatedAt),
    }
    if full:
        data["agentRuns"] = [
            {
                "id": r.id,
                "agentId": r.agentId,
                "agentRole": r.agentRole,
                "agentName": r.agentName,
                "stepId": r.stepId,
                "stepNameZh": r.stepNameZh,
                "status": r.status,
                "output": r.output,
                "order": r.order,
                "startedAt": _dt(r.startedAt),
                "completedAt": _dt(r.completedAt),
            }
            for r in sorted(project.agentRuns, key=lambda x: x.order)
        ]
        data["messages"] = [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "createdAt": _dt(m.createdAt),
            }
            for m in project.messages
        ]
        if project.generatedApp:
            data["generatedApp"] = {
                "id": project.generatedApp.id,
                "html": project.generatedApp.html,
                "css": project.generatedApp.css,
                "js": project.generatedApp.js,
                "version": project.generatedApp.version,
            }
    return data


@router.get("")
async def list_projects(user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project)
        .where(Project.userId == user.id)
        .options(selectinload(Project.generatedApp))
        .order_by(Project.updatedAt.desc())
    )
    projects = result.scalars().all()

    message_counts: dict[str, int] = {}
    if projects:
        counts_result = await db.execute(
            select(Message.projectId, func.count())
            .where(Message.projectId.in_([p.id for p in projects]))
            .group_by(Message.projectId)
        )
        message_counts = {pid: cnt for pid, cnt in counts_result.all()}

    return {
        "projects": [
            {
                **_project_dict(p),
                "generatedApp": (
                    {"id": p.generatedApp.id, "version": p.generatedApp.version}
                    if p.generatedApp
                    else None
                ),
                "_count": {"messages": message_counts.get(p.id, 0)},
            }
            for p in projects
        ]
    }


@router.post("")
async def create_project(
    body: CreateProjectBody,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    final_prompt = body.prompt.strip() if body.prompt else None
    project_name = body.name.strip() if body.name else None
    template = get_template_by_id(body.templateId) if body.templateId else None

    if template:
        final_prompt = template["prompt"]
        project_name = project_name or template["name"]

    if not final_prompt:
        raise HTTPException(400, "请描述你的应用需求")

    project_name = project_name or final_prompt[:50]

    project = Project(
        userId=user.id,
        name=project_name,
        prompt=final_prompt,
        templateId=template["id"] if template else None,
        status="generating",
    )
    db.add(project)
    await db.flush()

    db.add(Message(projectId=project.id, role="user", content=final_prompt))
    from db.models import AgentRun

    for run_data in create_agent_run_data(final_prompt):
        db.add(AgentRun(projectId=project.id, **run_data))

    await db.commit()

    result = await db.execute(
        select(Project)
        .where(Project.id == project.id)
        .options(
            selectinload(Project.agentRuns),
            selectinload(Project.messages),
            selectinload(Project.generatedApp),
        )
    )
    project = result.scalar_one()

    background_tasks.add_task(run_project_generation, project.id, final_prompt, "modern")
    return {"project": _project_dict(project, full=True)}


@router.post("/clone-template")
async def clone_template(
    body: CloneTemplateBody,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    template = get_template_by_id(body.templateId)
    if not template:
        raise HTTPException(404, "模板不存在")

    app_type = get_template_app_type(template["id"])
    starter_app = generate_mock_app(template["prompt"], app_type)

    project = Project(
        userId=user.id,
        name=(body.name or "").strip() or template["name"],
        prompt=template["prompt"],
        templateId=template["id"],
        status="generating" if body.fullPipeline else "ready",
    )
    db.add(project)
    await db.flush()

    db.add(
        Message(
            projectId=project.id,
            role="user",
            content=f"从模板「{template['name']}」克隆：\n{template['prompt']}",
        )
    )
    await db.commit()

    if body.fullPipeline:
        from db.models import AgentRun

        for run_data in create_agent_run_data(template["prompt"]):
            db.add(AgentRun(projectId=project.id, **run_data))
        await db.commit()
        background_tasks.add_task(run_project_generation, project.id, template["prompt"], "modern")
    else:
        await seed_template_project(project.id, template["prompt"], starter_app)

    return {"projectId": project.id}


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.userId == user.id)
        .options(
            selectinload(Project.agentRuns),
            selectinload(Project.messages),
            selectinload(Project.generatedApp),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    conv_result = await db.execute(
        select(Conversation.id).where(Conversation.projectId == project_id)
    )
    conversation_id = conv_result.scalar_one_or_none()

    return {"project": _project_dict(project, full=True, conversation_id=conversation_id)}


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project.id).where(Project.id == project_id, Project.userId == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Project not found")
    await db.execute(delete(Project).where(Project.id == project_id))
    await db.commit()
    return {"ok": True}


@router.get("/{project_id}/artifacts")
async def list_artifacts(
    project_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await db.execute(
        select(Project).where(Project.id == project_id, Project.userId == user.id)
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(404, "项目不存在")

    result = await db.execute(
        select(Artifact).where(Artifact.projectId == project_id).order_by(Artifact.createdAt)
    )
    artifacts = result.scalars().all()
    return {
        "artifacts": [
            {
                "id": a.id,
                "agentId": a.agentId,
                "type": a.type,
                "createdAt": _dt(a.createdAt),
                "preview": (
                    "HTML/CSS/JS 代码包"
                    if a.type == "code"
                    else a.content[:120] + ("…" if len(a.content) > 120 else "")
                ),
            }
            for a in artifacts
        ]
    }


@router.get("/{project_id}/artifacts/{artifact_type}")
async def get_artifact(
    project_id: str,
    artifact_type: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await db.execute(
        select(Project).where(Project.id == project_id, Project.userId == user.id)
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(404, "项目不存在")

    result = await db.execute(
        select(Artifact)
        .where(Artifact.projectId == project_id, Artifact.type == artifact_type)
        .order_by(Artifact.createdAt.desc())
    )
    artifact = result.scalars().first()
    if not artifact:
        raise HTTPException(404, "产物不存在")
    return {
        "artifact": {
            "id": artifact.id,
            "type": artifact.type,
            "content": artifact.content,
            "agentId": artifact.agentId,
            "createdAt": _dt(artifact.createdAt),
        }
    }


@router.get("/{project_id}/preview")
async def preview_get(
    project_id: str,
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
        return Response(content="App not found", status_code=404)

    html = build_preview_document(
        {
            "html": project.generatedApp.html,
            "css": project.generatedApp.css,
            "js": project.generatedApp.js,
        }
    )
    return Response(content=html, media_type="text/html; charset=utf-8")


@router.post("/{project_id}/preview")
async def preview_post(
    project_id: str,
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
        raise HTTPException(404, "App not found")

    app = project.generatedApp
    html = build_preview_document({"html": app.html, "css": app.css, "js": app.js})
    return {
        "html": html,
        "css": app.css,
        "js": app.js,
        "version": app.version,
    }


@router.post("/{project_id}/chat")
async def project_chat(
    project_id: str,
    body: ChatBody,
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
    if not project.generatedApp:
        raise HTTPException(400, "App not yet generated")

    db.add(Message(projectId=project_id, role="user", content=body.message.strip()))

    current = {
        "html": project.generatedApp.html,
        "css": project.generatedApp.css,
        "js": project.generatedApp.js,
    }
    refined = await refine_app_with_chat(current, body.message.strip())

    project.generatedApp.html = refined["app"]["html"]
    project.generatedApp.css = refined["app"]["css"]
    project.generatedApp.js = refined["app"]["js"]
    project.generatedApp.version += 1

    db.add(
        Artifact(
            projectId=project_id,
            agentId="alex",
            type="code",
            content=str(refined["app"]),
        )
    )

    assistant = Message(
        projectId=project_id,
        role="assistant",
        content=f"{refined['response']} ({'AI refinement' if refined['mode'] == 'ai' else 'Mock refinement'})",
    )
    db.add(assistant)
    project.updatedAt = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(assistant)

    return {
        "message": {
            "id": assistant.id,
            "role": assistant.role,
            "content": assistant.content,
            "createdAt": _dt(assistant.createdAt),
        },
        "app": refined["app"],
    }


@router.post("/{project_id}/export/github")
async def export_github(
    project_id: str,
    body: GitHubExportBody,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.repoName.strip():
        raise HTTPException(400, "请输入仓库名称")

    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.userId == user.id)
        .options(selectinload(Project.generatedApp))
    )
    project = result.scalar_one_or_none()
    if not project or not project.generatedApp:
        raise HTTPException(400, "应用尚未生成")

    user_result = await db.execute(select(User).where(User.id == user.id))
    db_user = user_result.scalar_one()

    token = resolve_github_token(body.githubToken or db_user.githubToken)
    if not token:
        raise HTTPException(
            400,
            "未配置 GitHub Token。请在设置中输入 Personal Access Token，或在 .env 中设置 GITHUB_TOKEN",
        )

    if body.githubToken and body.githubToken.strip() != (db_user.githubToken or ""):
        db_user.githubToken = body.githubToken.strip()
        await db.flush()

    try:
        export_result = await export_project_to_github(
            token,
            body.repoName.strip(),
            {
                "html": project.generatedApp.html,
                "css": project.generatedApp.css,
                "js": project.generatedApp.js,
            },
            description=(project.description or project.prompt[:200]),
            is_private=bool(body.isPrivate),
            existing_repo=bool(body.existingRepo),
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    await db.commit()
    return export_result
