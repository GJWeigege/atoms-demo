import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from sqlalchemy import select

from agents.definitions import get_agent_definition
from agents.graph import (
    build_agent_stages,
    compile_pipeline_graph,
    extend_pipeline_config,
    is_gate_node,
    load_pipeline_config,
    parse_step_node_name,
    resolve_pipeline_steps,
)
from agents.template_renderer import (
    build_template_context,
    detect_optional_agent_ids,
    get_app_type_template,
    escape_html,
)
from config import get_settings
from db.models import AgentRun, Artifact, Conversation, ConversationMessage, GeneratedApp, Message, Project, new_id
from db.session import async_session
from services.artifact_display import build_agent_stage_display
from services.event_bus import ProjectEventBus
from services.gate_controller import GateController
from services.project_files import sync_project_files

EmitFn = Callable[[str, dict[str, Any]], Awaitable[None]]

AGENT_MESSAGE_TYPES: dict[str, str] = {
    "mike": "plan",
    "emma": "plan",
    "designer": "plan",
    "bob": "plan",
    "alex": "completion",
}


def _build_agent_message_content(agent_id: str, artifacts: dict[str, str], summary: str) -> str:
    return build_agent_stage_display(agent_id, artifacts, summary)


def _handoff_message(from_agent: str, to_agent: str) -> str:
    names = {"mike": "Mike", "emma": "Emma", "designer": "Luna", "bob": "Bob", "alex": "Alex"}
    to_name = names.get(to_agent, to_agent)
    if from_agent == "mike":
        return f"计划已确认，直接推进。@{to_name}"
    return f"移交 @{to_name}"


def make_stage_message_id(agent_id: str) -> str:
    return f"stage-{agent_id}-{new_id()}"


def make_gate_event_id(kind: str, agent_id: str) -> str:
    return f"{kind}-{agent_id}-{new_id()}"


async def upsert_stage_message(
    db,
    conv: Conversation | None,
    agent_id: str,
    stage_msg_id: str,
    content: str,
    react_steps: list[dict[str, Any]],
) -> None:
    if not conv:
        return
    agent = get_agent_definition(agent_id)
    if not agent:
        return
    msg_type = AGENT_MESSAGE_TYPES.get(agent_id, "plan")
    existing = await db.get(ConversationMessage, stage_msg_id)
    if existing:
        existing.content = content
        existing.reactSteps = react_steps
        existing.stepCount = len(react_steps)
        existing.status = "streaming"
        existing.agentId = agent_id
        existing.agentName = agent.name
        existing.messageType = msg_type
    else:
        db.add(
            ConversationMessage(
                id=stage_msg_id,
                conversationId=conv.id,
                role="assistant",
                content=content,
                agentId=agent_id,
                agentName=agent.name,
                reactSteps=react_steps,
                messageType=msg_type,
                status="streaming",
                stepCount=len(react_steps),
            )
        )
    conv.updatedAt = datetime.now(timezone.utc)
    await db.flush()


async def persist_handoff_event(
    db,
    conv: Conversation | None,
    handoff_id: str,
    from_agent: str,
    to_agent: str,
    message: str,
    insert_after: str,
    created_at: datetime,
) -> None:
    if not conv:
        return
    db.add(
        ConversationMessage(
            id=handoff_id,
            conversationId=conv.id,
            role="system",
            content=message,
            messageType="handoff",
            status="complete",
            metadata_={
                "eventKind": "handoff",
                "from": from_agent,
                "to": to_agent,
                "insertAfterMessageId": insert_after,
            },
            createdAt=created_at,
        )
    )
    conv.updatedAt = created_at
    await db.flush()


async def persist_rollback_event(
    db,
    conv: Conversation | None,
    rollback_id: str,
    agent_id: str,
    agent_name: str,
    role_zh: str,
    message: str,
    insert_after: str,
    created_at: datetime,
) -> None:
    if not conv:
        return
    db.add(
        ConversationMessage(
            id=rollback_id,
            conversationId=conv.id,
            role="system",
            content=message,
            agentId=agent_id,
            agentName=agent_name,
            messageType="system",
            status="complete",
            metadata_={
                "eventKind": "rollback",
                "agentId": agent_id,
                "agentName": agent_name,
                "roleZh": role_zh,
                "insertAfterMessageId": insert_after,
            },
            createdAt=created_at,
        )
    )
    conv.updatedAt = created_at
    await db.flush()


def create_agent_run_data(prompt: str | None = None) -> list[dict]:
    config = load_pipeline_config()
    if prompt:
        config = extend_pipeline_config(config, prompt)
    steps = resolve_pipeline_steps(config)
    return [
        {
            "agentId": s["agent_id"],
            "agentRole": s["agent"].role,
            "agentName": s["agent"].name,
            "stepId": s["step_id"],
            "stepNameZh": s["step"].name_zh,
            "status": "pending",
            "order": s["order"],
        }
        for s in steps
    ]


def _get_input_keys(agent_id: str, step_id: str, artifacts: dict[str, str]) -> list[str]:
    config = load_pipeline_config()
    steps = resolve_pipeline_steps(config)
    for s in steps:
        if s["agent_id"] == agent_id and s["step_id"] == step_id:
            return [k for k in s["step"].input_keys if k in artifacts]
    return []


async def run_project_generation(
    project_id: str, prompt: str, theme: str = "modern", emit: EmitFn | None = None
) -> None:
    current_agent_id: str | None = None
    agent_react_steps: list[dict[str, Any]] = []
    conv: Conversation | None = None
    emit_ctx: dict[str, str | None] = {"agent_id": None}

    async def _emit(event_type: str, data: dict[str, Any]) -> None:
        if emit:
            await emit(event_type, data)
        ProjectEventBus.emit(project_id, event_type, data)

    async def _finalize_agent(
        db,
        agent_id: str,
        react_steps: list[dict[str, Any]],
        artifacts: dict[str, str],
        summary: str,
        message_id: str | None = None,
    ) -> str | None:
        agent = get_agent_definition(agent_id)
        if not agent:
            return None
        content = _build_agent_message_content(agent_id, artifacts, summary)
        msg_id: str | None = None
        msg_data: dict[str, Any] = {
            "agentId": agent_id,
            "agentName": agent.name,
            "roleZh": agent.role_zh,
            "stepCount": len(react_steps),
            "reactSteps": react_steps,
            "fullContent": content,
            "messageType": AGENT_MESSAGE_TYPES.get(agent_id, "plan"),
            "status": "complete",
        }
        if conv:
            msg_type = AGENT_MESSAGE_TYPES.get(agent_id, "plan")
            if message_id:
                existing = await db.get(ConversationMessage, message_id)
                if existing:
                    existing.content = content
                    existing.reactSteps = react_steps
                    existing.stepCount = len(react_steps)
                    existing.status = "complete"
                    existing.messageType = msg_type
                    existing.agentId = agent_id
                    existing.agentName = agent.name
                    await db.flush()
                    msg_id = existing.id
                    msg_data["id"] = msg_id
                    msg_data["createdAt"] = (
                        existing.createdAt.isoformat() if existing.createdAt else None
                    )
                else:
                    msg = ConversationMessage(
                        id=message_id,
                        conversationId=conv.id,
                        role="assistant",
                        content=content,
                        agentId=agent_id,
                        agentName=agent.name,
                        reactSteps=react_steps,
                        messageType=msg_type,
                        status="complete",
                        stepCount=len(react_steps),
                    )
                    db.add(msg)
                    await db.flush()
                    msg_id = msg.id
                    msg_data["id"] = msg_id
                    msg_data["createdAt"] = msg.createdAt.isoformat() if msg.createdAt else None
            else:
                msg = ConversationMessage(
                    conversationId=conv.id,
                    role="assistant",
                    content=content,
                    agentId=agent_id,
                    agentName=agent.name,
                    reactSteps=react_steps,
                    messageType=msg_type,
                    status="complete",
                    stepCount=len(react_steps),
                )
                db.add(msg)
                await db.flush()
                msg_id = msg.id
                msg_data["id"] = msg_id
                msg_data["createdAt"] = msg.createdAt.isoformat() if msg.createdAt else None
            conv.updatedAt = datetime.now(timezone.utc)
        else:
            msg_id = message_id or f"stream-{agent_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
            msg_data["id"] = msg_id
        await _emit("agent_complete", msg_data)
        return msg_id

    try:
        async with async_session() as db:
            conv_result = await db.execute(
                select(Conversation).where(Conversation.projectId == project_id)
            )
            conv = conv_result.scalar_one_or_none()

            result = await db.execute(
                select(AgentRun)
                .where(AgentRun.projectId == project_id)
                .order_by(AgentRun.order)
            )
            runs = result.scalars().all()
            run_lookup = {(run.agentId, run.stepId): run for run in runs if run.stepId}

            artifact_context: dict[str, str] = {}
            artifact_ids: dict[str, str] = {}
            settings = get_settings()

            pipeline_config = load_pipeline_config()
            pipeline_config = extend_pipeline_config(pipeline_config, prompt)
            steps = resolve_pipeline_steps(pipeline_config)
            graph = compile_pipeline_graph(steps)

            state: dict[str, Any] = {
                "project_id": project_id,
                "prompt": prompt,
                "theme": theme,
                "artifacts": artifact_context,
                "messages": [],
            }

            async def _emit_collect(event_type: str, data: dict[str, Any]) -> None:
                if (
                    event_type in ("thought", "action", "observation")
                    and data.get("agentId") == emit_ctx["agent_id"]
                ):
                    agent_react_steps.append(
                        {
                            "phase": event_type,
                            "content": data.get("content", ""),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                await _emit(event_type, data)

            def _agent_output_types(target_agent_id: str) -> set[str]:
                return {
                    s["step"].output_type
                    for s in steps
                    if s["agent_id"] == target_agent_id
                }

            async def _clear_agent_artifacts(target_agent_id: str) -> None:
                nonlocal artifact_context, artifact_ids

                for output_type in _agent_output_types(target_agent_id):
                    artifact_context.pop(output_type, None)
                    artifact_ids.pop(output_type, None)
                state["artifacts"] = artifact_context

                result = await db.execute(
                    select(Artifact).where(
                        Artifact.projectId == project_id,
                        Artifact.agentId == target_agent_id,
                    )
                )
                for artifact in result.scalars().all():
                    await db.delete(artifact)
                await db.flush()

            async def _reset_agent_runs(target_agent_id: str) -> None:
                for run in runs:
                    if run.agentId != target_agent_id:
                        continue
                    run.status = "pending"
                    run.startedAt = None
                    run.completedAt = None
                    run.output = None
                    run.outputArtifactId = None
                    run.inputArtifactIds = []
                    await _emit(
                        "run_status",
                        {
                            "runId": run.id,
                            "agentId": run.agentId,
                            "stepId": run.stepId,
                            "status": "pending",
                        },
                    )
                await db.flush()

            async def _on_gate(agent_id: str, _state: dict[str, Any]) -> str:
                nonlocal current_agent_id, agent_react_steps

                agent_stages = build_agent_stages(steps)
                idx = next(i for i, stage in enumerate(agent_stages) if stage["agent_id"] == agent_id)
                prev_agent = agent_stages[idx - 1]["agent_id"] if idx > 0 else None
                next_agent = (
                    agent_stages[idx + 1]["agent_id"] if idx < len(agent_stages) - 1 else None
                )

                agent = get_agent_definition(agent_id)
                prev_def = get_agent_definition(prev_agent) if prev_agent else None
                next_def = get_agent_definition(next_agent) if next_agent else None

                preview_content = _build_agent_message_content(
                    agent_id,
                    artifact_context,
                    agent.name if agent else agent_id,
                )
                stage_msg_id = make_stage_message_id(agent_id)
                await upsert_stage_message(
                    db,
                    conv,
                    agent_id,
                    stage_msg_id,
                    preview_content,
                    list(agent_react_steps),
                )
                if conv:
                    await db.commit()

                await _emit(
                    "stage_output",
                    {
                        "agentId": agent_id,
                        "agentName": agent.name if agent else agent_id,
                        "roleZh": agent.role_zh if agent else "",
                        "fullContent": preview_content,
                        "reactSteps": list(agent_react_steps),
                        "stepCount": len(agent_react_steps),
                        "messageType": AGENT_MESSAGE_TYPES.get(agent_id, "plan"),
                        "messageId": stage_msg_id,
                    },
                )

                await _emit(
                    "gate_prompt",
                    {
                        "agentId": agent_id,
                        "agentName": agent.name if agent else agent_id,
                        "roleZh": agent.role_zh if agent else "",
                        "previousAgentId": prev_agent,
                        "previousAgentName": prev_def.name if prev_def else None,
                        "nextAgentId": next_agent,
                        "nextAgentName": next_def.name if next_def else None,
                        "canRollback": True,
                        "isFinal": next_agent is None,
                    },
                )

                decision = await GateController.wait_decision(project_id)
                now = datetime.now(timezone.utc)
                now_iso = now.isoformat()
                agent_name = agent.name if agent else agent_id
                role = agent.role_zh if agent else ""
                role_suffix = f"（{role}）" if role else ""

                if decision == "rollback":
                    await _reset_agent_runs(agent_id)
                    await _clear_agent_artifacts(agent_id)
                    rollback_message = (
                        f"回退：重新执行 {agent_name}{role_suffix} 阶段"
                    )
                    rollback_id = make_gate_event_id("rollback", agent_id)
                    if conv:
                        stage_msg = await db.get(ConversationMessage, stage_msg_id)
                        if stage_msg:
                            stage_msg.status = "complete"
                        await persist_rollback_event(
                            db,
                            conv,
                            rollback_id,
                            agent_id,
                            agent_name,
                            role,
                            rollback_message,
                            stage_msg_id,
                            now,
                        )
                        await db.commit()
                    await _emit(
                        "agent_complete",
                        {
                            "id": stage_msg_id,
                            "agentId": agent_id,
                            "agentName": agent_name,
                            "roleZh": role,
                            "stepCount": len(agent_react_steps),
                            "reactSteps": list(agent_react_steps),
                            "fullContent": preview_content,
                            "messageType": AGENT_MESSAGE_TYPES.get(agent_id, "plan"),
                            "status": "complete",
                            "createdAt": now_iso,
                        },
                    )
                    await _emit(
                        "gate_rollback",
                        {
                            "id": rollback_id,
                            "agentId": agent_id,
                            "agentName": agent_name,
                            "roleZh": role,
                            "message": rollback_message,
                            "createdAt": now_iso,
                            "insertAfterMessageId": stage_msg_id,
                        },
                    )
                    current_agent_id = None
                    agent_react_steps = []
                    emit_ctx["agent_id"] = None
                else:
                    summary = agent_name
                    await _finalize_agent(
                        db,
                        agent_id,
                        agent_react_steps,
                        artifact_context,
                        summary,
                        message_id=stage_msg_id,
                    )
                    if next_agent:
                        handoff_message = _handoff_message(agent_id, next_agent)
                        handoff_id = make_gate_event_id("handoff", agent_id)
                        if conv:
                            await persist_handoff_event(
                                db,
                                conv,
                                handoff_id,
                                agent_id,
                                next_agent,
                                handoff_message,
                                stage_msg_id,
                                now,
                            )
                            await db.commit()
                        await _emit(
                            "handoff",
                            {
                                "id": handoff_id,
                                "from": agent_id,
                                "to": next_agent,
                                "message": handoff_message,
                                "createdAt": now_iso,
                                "insertAfterMessageId": stage_msg_id,
                            },
                        )

                return decision

            async def _on_step_start(agent_id: str, step_id: str, _state: dict[str, Any]) -> None:
                nonlocal current_agent_id, agent_react_steps

                if agent_id != current_agent_id:
                    agent_react_steps = []
                    current_agent_id = agent_id
                    emit_ctx["agent_id"] = agent_id
                    agent = get_agent_definition(agent_id)
                    if agent:
                        await _emit(
                            "agent_start",
                            {
                                "agentId": agent_id,
                                "agentName": agent.name,
                                "roleZh": agent.role_zh,
                            },
                        )

                run = run_lookup.get((agent_id, step_id))
                if not run:
                    return
                run.status = "running"
                run.startedAt = datetime.now(timezone.utc)
                await db.flush()
                await _emit(
                    "run_status",
                    {
                        "runId": run.id,
                        "agentId": run.agentId,
                        "stepId": run.stepId,
                        "status": "running",
                    },
                )

            graph_config = {
                "configurable": {
                    "emit": _emit_collect,
                    "on_step_start": _on_step_start,
                    "on_gate": _on_gate,
                }
            }

            async for update in graph.astream(
                state, stream_mode="updates", config=graph_config
            ):
                for node_name, node_output in update.items():
                    if is_gate_node(node_name):
                        continue

                    agent_id, step_id = parse_step_node_name(node_name)
                    run = run_lookup.get((agent_id, step_id))

                    if node_output.get("error"):
                        if run:
                            run.status = "failed"
                            run.completedAt = datetime.now(timezone.utc)
                            run.output = node_output["error"]
                            await db.flush()
                            await _emit(
                                "run_status",
                                {
                                    "runId": run.id,
                                    "agentId": run.agentId,
                                    "stepId": run.stepId,
                                    "status": "failed",
                                },
                            )
                        continue

                    if "artifacts" in node_output:
                        artifact_context.update(node_output["artifacts"])
                        state["artifacts"] = artifact_context

                    step_result = node_output.get("_step_result", {})
                    if not run:
                        continue

                    artifact_type = step_result.get("output_type", "unknown")
                    content = step_result.get("content", "")

                    artifact = Artifact(
                        projectId=project_id,
                        agentId=run.agentId or run.agentRole,
                        type=artifact_type,
                        content=content,
                    )
                    db.add(artifact)
                    await db.flush()

                    artifact_context[artifact_type] = content
                    artifact_ids[artifact_type] = artifact.id
                    state["artifacts"] = artifact_context

                    input_keys = _get_input_keys(agent_id, step_id, artifact_context)
                    input_ids = [artifact_ids[k] for k in input_keys if k in artifact_ids]

                    code = step_result.get("code")
                    if artifact_type == "code" and code:
                        existing = await db.execute(
                            select(GeneratedApp).where(GeneratedApp.projectId == project_id)
                        )
                        gen_app = existing.scalar_one_or_none()
                        if gen_app:
                            gen_app.html = code["html"]
                            gen_app.css = code["css"]
                            gen_app.js = code["js"]
                            gen_app.version += 1
                        else:
                            gen_app = GeneratedApp(
                                projectId=project_id,
                                html=code["html"],
                                css=code["css"],
                                js=code["js"],
                            )
                            db.add(gen_app)
                        await db.flush()
                        await sync_project_files(db, project_id, gen_app)

                    run.status = "completed"
                    run.output = step_result.get("summary", "")
                    run.inputArtifactIds = input_ids
                    run.outputArtifactId = artifact.id
                    run.completedAt = datetime.now(timezone.utc)
                    await db.flush()

                    await _emit(
                        "step_complete",
                        {
                            "stepId": run.stepId,
                            "agentId": run.agentId,
                            "artifactType": artifact_type,
                            "runId": run.id,
                        },
                    )
                    await _emit(
                        "run_status",
                        {
                            "runId": run.id,
                            "agentId": run.agentId,
                            "stepId": run.stepId,
                            "status": "completed",
                        },
                    )
                    await asyncio.sleep(0.35)

            mode = "ai" if settings.openai_api_key else "template"
            summary_content = (
                "多智能体流水线已完成。Mike 需求分析 → Emma PRD → Luna 设计 → "
                "Bob 架构 → Alex 开发组装。\n\n"
                f"({'OpenAI 驱动' if mode == 'ai' else '结构化模板生成 — 配置 OPENAI_API_KEY 启用 AI'})"
            )
            db.add(
                Message(
                    projectId=project_id,
                    role="assistant",
                    content=summary_content,
                )
            )

            if conv:
                conv.updatedAt = datetime.now(timezone.utc)

            proj = await db.get(Project, project_id)
            if proj:
                proj.status = "ready"
            await db.commit()
            ProjectEventBus.mark_done(project_id)

    except Exception as exc:
        GateController.cancel(project_id)
        ProjectEventBus.emit(project_id, "error", {"message": str(exc)})
        ProjectEventBus.mark_done(project_id)
        print(f"Project generation failed: {exc}")
        async with async_session() as err_db:
            result = await err_db.execute(
                select(AgentRun).where(
                    AgentRun.projectId == project_id,
                    AgentRun.status.in_(["pending", "running"]),
                )
            )
            for run in result.scalars().all():
                run.status = "failed"
                run.completedAt = datetime.now(timezone.utc)
            proj = await err_db.get(Project, project_id)
            if proj:
                proj.status = "failed"
            await err_db.commit()


async def seed_template_project(
    project_id: str, prompt: str, app: dict[str, str], theme: str = "modern"
) -> None:
    async with async_session() as db:
        runs_data = create_agent_run_data()
        for r in runs_data:
            db.add(AgentRun(projectId=project_id, **r))
        await db.flush()

        plan_content = f"# 项目计划\n\n基于模板快速启动：{prompt[:200]}"
        requirements_content = f"# 需求分析\n\n{prompt[:300]}"
        prd_content = f"# 产品需求文档\n\n## 概述\n{prompt}\n\n## MVP\n- 核心交互功能\n- 响应式布局\n- 本地状态持久化"
        wireframe_content = "# 线框设计\n\nHeader + Main + Footer 单列布局"
        design_content = f"# 设计交付包\n\n主题：{theme}"
        arch_content = "# 架构规格\n\n- 前端：HTML/CSS/JS 单页\n- 状态：localStorage\n- 布局：Mobile-first"

        artifacts_data = [
            ("mike", "plan", plan_content),
            ("emma", "requirements", requirements_content),
            ("emma", "prd", prd_content),
            ("designer", "wireframe", wireframe_content),
            ("designer", "design", design_content),
            ("bob", "architecture", arch_content),
            ("alex", "code", json.dumps(app)),
        ]

        created: dict[str, str] = {}
        for agent_id, atype, content in artifacts_data:
            a = Artifact(projectId=project_id, agentId=agent_id, type=atype, content=content)
            db.add(a)
            await db.flush()
            created[atype] = a.id

        step_map = {
            "intake-analysis": "intake",
            "task-decomposition": "task_decomposition",
            "risk-assessment": "risk_assessment",
            "plan": "plan",
            "stakeholder-analysis": "stakeholders",
            "requirements-analysis": "requirements",
            "user-journey": "user_journey",
            "feature-prioritization": "feature_priority",
            "prd-writing": "prd",
            "design-research": "design_research",
            "wireframe": "wireframe",
            "visual-system": "visual_system",
            "design-package": "design",
            "requirements-review": "requirements_review",
            "system-design": "system_design",
            "data-model": "data_model",
            "architecture": "architecture",
            "tech-stack-selection": "tech_stack",
            "frontend": "frontend",
            "backend-schema": "backend",
            "api-implementation": "api",
            "integration": "integration",
            "assemble": "code",
            "research-scope": "research_scope",
            "source-collection": "research_sources",
            "analysis": "research_analysis",
            "research-report": "research",
            "keyword-research": "keyword_research",
            "content-strategy": "content_strategy",
            "seo-audit": "seo_audit",
            "seo-plan": "seo",
            "audience-analysis": "audience_analysis",
            "campaign-strategy": "campaign_strategy",
            "ad-creatives": "ad_creatives",
            "ads-plan": "ads",
        }

        result = await db.execute(
            select(AgentRun).where(AgentRun.projectId == project_id).order_by(AgentRun.order)
        )
        now = datetime.now(timezone.utc)
        for run in result.scalars().all():
            atype = step_map.get(run.stepId or "")
            run.status = "completed"
            run.startedAt = now
            run.completedAt = now
            if atype and atype in created:
                run.outputArtifactId = created[atype]
            run.output = f"{run.agentName} · {run.stepNameZh or run.stepId} 已完成（模板预置）"

        gen_app = GeneratedApp(
            projectId=project_id,
            html=app["html"],
            css=app["css"],
            js=app["js"],
        )
        db.add(gen_app)
        await db.flush()
        await sync_project_files(db, project_id, gen_app)
        proj = await db.get(Project, project_id)
        if proj:
            proj.status = "ready"
            proj.theme = theme
        await db.commit()


def generate_mock_app(prompt: str, app_type: str | None = None) -> dict[str, str]:
    from agents.template_renderer import detect_app_type, load_theme_vars

    atype = app_type or detect_app_type(prompt)
    title = escape_html(prompt[:48] if len(prompt) <= 48 else prompt[:45] + "...")
    return get_app_type_template(atype, title, escape_html(prompt), load_theme_vars("modern"))
