"""ReAct-style step runner — emits thought / action / observation phases."""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

from agents.definitions import AgentDefinition, WorkflowStep

EmitFn = Callable[[str, dict[str, Any]], Awaitable[None]]

# Visible pacing between ReAct phases in the UI (seconds)
REACT_PHASE_DELAY = 0.45


def _mock_thought(agent: AgentDefinition, step: WorkflowStep, artifacts: dict[str, str]) -> str:
    upstream = ", ".join(list(artifacts.keys())[-3:]) or "用户需求"
    return f"分析上游产物（{upstream}），准备执行「{step.name_zh}」。"


def _mock_action(agent: AgentDefinition, step: WorkflowStep) -> str:
    return f"执行 {step.name_zh}（{agent.name} · {step.id}）"


def _mock_observation(content: str, summary: str) -> str:
    preview = (content or summary)[:200]
    if len(content or summary) > 200:
        preview += "…"
    return preview or "步骤已完成。"


async def run_step_with_react(
    *,
    agent: AgentDefinition,
    step: WorkflowStep,
    context: dict[str, Any],
    provider,
    emit: EmitFn | None,
    agent_id: str,
) -> str:
    """Run one workflow step with optional ReAct SSE phases."""

    async def _emit(phase: str, content: str, extra: dict[str, Any] | None = None) -> None:
        if not emit:
            return
        payload: dict[str, Any] = {
            "agentId": agent_id,
            "stepId": step.id,
            "content": content,
        }
        if extra:
            payload.update(extra)
        await emit(phase, payload)

    artifacts = context.get("artifacts", {})
    await _emit("thought", _mock_thought(agent, step, artifacts))
    await asyncio.sleep(REACT_PHASE_DELAY)
    await _emit("action", _mock_action(agent, step))
    await asyncio.sleep(REACT_PHASE_DELAY)

    content = await provider.generate(step, context)

    await _emit("observation", _mock_observation(content, ""))
    await asyncio.sleep(REACT_PHASE_DELAY)
    return content
