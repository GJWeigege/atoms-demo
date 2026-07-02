"""Build chat-facing stage summaries from pipeline artifacts."""

from __future__ import annotations

import re

from agents.definitions import get_agent_definition

SCALAR_CONTEXT_KEYS = frozenset(
    {
        "prompt",
        "appType",
        "title",
        "themeLabel",
        "themeVars",
        "themeDescription",
    }
)

ALEX_COMPLETION_MESSAGE = (
    "应用构建完成！主要功能：\n"
    "• 任务增删改查\n"
    "• 分类筛选\n"
    "• 本地存储\n\n"
    "可在应用查看器中查看结果。"
)

AGENT_FALLBACK_MESSAGES: dict[str, str] = {
    "mike": (
        "待办清单 Web 应用需求已整理完毕。\n\n"
        "1. 任务管理（增删改查）\n"
        "2. 分类与优先级\n"
        "3. 本地持久化\n\n"
        "计划已确认，直接推进。@Alex"
    ),
    "emma": "产品需求文档（PRD）已编写完成，包含用户旅程、功能优先级与 MVP 范围。",
    "designer": "线框、视觉系统与设计规范已完成，已交付开发团队。",
    "bob": "系统架构、数据模型与技术选型审阅已完成。",
}


def extract_markdown_title(content: str, fallback: str = "上游产物") -> str:
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        match = re.match(r"^#{1,6}\s+(.+)$", stripped)
        if match:
            return match.group(1).strip()
    return fallback


def upstream_title_reference(content: str) -> str:
    title = extract_markdown_title(content)
    return f"📎 **{title}**"


def sanitize_embedded_artifacts(content: str, upstream_artifacts: dict[str, str]) -> str:
    result = content
    bodies = sorted(
        ((key, body) for key, body in upstream_artifacts.items() if body and body.strip()),
        key=lambda item: len(item[1]),
        reverse=True,
    )
    for _key, body in bodies:
        if body in result:
            result = result.replace(body, upstream_title_reference(body))
    return result


def _upstream_for_step(step, step_index: int, agent, artifacts: dict[str, str]) -> dict[str, str]:
    upstream: dict[str, str] = {}

    for input_key in agent.inputs:
        body = artifacts.get(input_key)
        if body and input_key != step.output_type:
            upstream[input_key] = body

    for prior_step in agent.workflow[:step_index]:
        prior_key = prior_step.output_type
        body = artifacts.get(prior_key)
        if body and prior_key != step.output_type:
            upstream[prior_key] = body

    for input_key in step.input_keys:
        if input_key in SCALAR_CONTEXT_KEYS:
            continue
        body = artifacts.get(input_key)
        if body and input_key != step.output_type:
            upstream[input_key] = body

    return upstream


def build_agent_stage_display(agent_id: str, artifacts: dict[str, str], summary: str = "") -> str:
    if agent_id == "alex":
        return ALEX_COMPLETION_MESSAGE

    agent = get_agent_definition(agent_id)
    if not agent or not agent.workflow:
        return summary or f"{agent_id} 已完成本阶段工作。"

    sections: list[str] = []
    for index, step in enumerate(agent.workflow):
        content = artifacts.get(step.output_type, "")
        if not content or not content.strip():
            continue

        upstream = _upstream_for_step(step, index, agent, artifacts)
        display_content = sanitize_embedded_artifacts(content, upstream)
        sections.append(f"## {step.name_zh}\n\n{display_content}")

    if sections:
        return "\n\n---\n\n".join(sections)

    return AGENT_FALLBACK_MESSAGES.get(agent_id, summary or f"{agent_id} 已完成本阶段工作。")
