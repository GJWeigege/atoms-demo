"""LangGraph pipeline — multi-agent orchestration with stage gate decisions."""

from __future__ import annotations

import json
from typing import Any, TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph

from agents.definitions import AgentDefinition, WorkflowStep, get_agent_definition
from agents.pipeline_config import build_core_stages_from_agents, validate_optional_stages
from agents.providers import get_provider
from agents.react_runner import run_step_with_react
from agents.template_renderer import build_template_context, parse_code_output
from config import get_settings


class PipelineState(TypedDict, total=False):
    project_id: str
    prompt: str
    theme: str
    artifacts: dict[str, str]
    artifact_ids: dict[str, str]
    current_step: str
    current_run_id: str
    agent_id: str
    step_id: str
    messages: list[str]
    mode: str
    error: str | None
    gate_agent_id: str
    user_decision: str
    _step_result: dict[str, Any]


EmitFn = Any  # Callable[[str, dict[str, Any]], Awaitable[None]]
StepStartFn = Any  # Callable[[str, str, PipelineState], Awaitable[None]]
GateFn = Any  # Callable[[str, PipelineState], Awaitable[str]]


def load_pipeline_config(config_id: str = "default-pipeline") -> dict:
    path = get_settings().templates_path / "orchestration" / f"{config_id}.json"
    overlay = json.loads(path.read_text(encoding="utf-8"))
    config = {
        **overlay,
        "stages": build_core_stages_from_agents(),
    }
    errors = validate_optional_stages(config)
    if errors:
        raise ValueError(f"Invalid pipeline config '{config_id}': " + "; ".join(errors))
    return config


def resolve_pipeline_steps(config: dict) -> list[dict]:
    from agents.definitions import get_agent_definitions

    result = []
    order = 0
    for stage in config.get("stages", []):
        agent = next(
            (a for a in get_agent_definitions() if a.id == stage["agentId"]),
            None,
        )
        if not agent:
            continue
        for step_id in stage.get("steps", []):
            step = next((s for s in agent.workflow if s.id == step_id), None)
            if not step:
                continue
            result.append(
                {
                    "agent_id": stage["agentId"],
                    "agent": agent,
                    "step_id": step_id,
                    "step": step,
                    "order": order,
                }
            )
            order += 1
    return result


def build_agent_stages(steps: list[dict]) -> list[dict]:
    """Group resolved steps into ordered agent stages."""
    stages: list[dict] = []
    for step in steps:
        agent_id = step["agent_id"]
        if not stages or stages[-1]["agent_id"] != agent_id:
            stages.append(
                {
                    "agent_id": agent_id,
                    "agent": step["agent"],
                    "steps": [step],
                    "first_step_id": step["step_id"],
                    "last_step_id": step["step_id"],
                }
            )
        else:
            stages[-1]["steps"].append(step)
            stages[-1]["last_step_id"] = step["step_id"]
    return stages


def _prompt_matches_keywords(prompt: str, keywords: list[str]) -> bool:
    lower = prompt.lower()
    return any(k.lower() in lower for k in keywords)


def extend_pipeline_config(config: dict, prompt: str) -> dict:
    from agents.template_renderer import detect_optional_agent_ids

    optional_stages = config.get("optionalStages", {})
    stages = list(config.get("stages", []))
    existing = {s["agentId"] for s in stages}

    triggered: list[tuple[int, dict]] = []
    for agent_id in detect_optional_agent_ids(prompt):
        if agent_id in existing:
            continue
        meta = optional_stages.get(agent_id, {})
        keywords = meta.get("triggerKeywords", [])
        if keywords and not _prompt_matches_keywords(prompt, keywords):
            continue
        insert_after = meta.get("insertAfter", "")
        insert_idx = len(stages)
        if insert_after:
            for i, stage in enumerate(stages):
                if stage.get("agentId") == insert_after:
                    insert_idx = i + 1
                    break
        stage_entry = {
            "agentId": agent_id,
            "steps": meta.get("steps", []),
        }
        if meta.get("inputs"):
            stage_entry["inputs"] = meta["inputs"]
        triggered.append((insert_idx, stage_entry))

    for insert_idx, stage_entry in sorted(triggered, key=lambda x: x[0], reverse=True):
        stages.insert(insert_idx, stage_entry)

    return {**config, "stages": stages}


def step_node_name(agent_id: str, step_id: str) -> str:
    return f"{agent_id}__{step_id}"


def gate_node_name(agent_id: str) -> str:
    return f"gate__{agent_id}"


def is_gate_node(name: str) -> bool:
    return name.startswith("gate__")


def parse_step_node_name(name: str) -> tuple[str, str]:
    agent_id, step_id = name.split("__", 1)
    return agent_id, step_id


def parse_gate_node_name(name: str) -> str:
    return name.removeprefix("gate__")


async def execute_pipeline_step(
    state: PipelineState,
    agent: AgentDefinition,
    step: WorkflowStep,
    config: RunnableConfig,
) -> dict[str, Any]:
    """Run one pipeline step (ReAct SSE + LLM/template provider)."""
    configurable = config.get("configurable") or {}
    emit: EmitFn | None = configurable.get("emit")
    on_step_start: StepStartFn | None = configurable.get("on_step_start")

    agent_id = agent.id
    if on_step_start:
        await on_step_start(agent_id, step.id, state)

    artifacts = dict(state.get("artifacts", {}))
    vars_ = build_template_context(
        state.get("prompt", ""), state.get("theme", "modern"), artifacts
    )
    vars_["agentId"] = agent_id
    context = {
        "prompt": state.get("prompt", ""),
        "theme": state.get("theme", "modern"),
        "artifacts": artifacts,
        "vars": vars_,
    }

    provider = get_provider()
    content = await run_step_with_react(
        agent=agent,
        step=step,
        context=context,
        provider=provider,
        emit=emit,
        agent_id=agent_id,
    )

    settings = get_settings()
    mode = "ai" if settings.openai_api_key else "template"

    final_content = content
    code = None
    if step.output_type == "code":
        code = parse_code_output(content)
        if not code and step.id == "assemble":
            merged = {**vars_, **artifacts}
            code = {
                "html": merged.get("appHtml", merged.get("frontend", "")),
                "css": "\n".join(filter(None, [merged.get("themeVars"), merged.get("appCss")])),
                "js": merged.get("appJs", ""),
            }
            final_content = json.dumps(code)

    artifacts[step.output_type] = final_content if not code else json.dumps(code)
    summary = (
        f"{agent.name} 已完成「{step.name_zh}」"
        f"{'（模板）' if mode == 'template' else ''}"
    )

    messages = list(state.get("messages", []))
    messages.append(summary)

    step_result = {
        "content": final_content if not code else json.dumps(code),
        "output_type": step.output_type,
        "summary": summary,
        "code": code,
    }

    return {
        "artifacts": artifacts,
        "current_step": step.id,
        "agent_id": agent_id,
        "step_id": step.id,
        "mode": mode,
        "messages": messages,
        "_step_result": step_result,
        "error": None,
    }


def _make_step_node(agent_id: str, step_id: str):
    async def node(state: PipelineState, config: RunnableConfig) -> dict[str, Any]:
        agent = get_agent_definition(agent_id)
        if not agent:
            return {"error": f"Unknown agent: {agent_id}"}
        step = next((s for s in agent.workflow if s.id == step_id), None)
        if not step:
            return {"error": f"Unknown step: {step_id}"}
        try:
            return await execute_pipeline_step(state, agent, step, config)
        except Exception as exc:
            return {"error": str(exc)}

    node.__name__ = step_node_name(agent_id, step_id)
    return node


def _make_gate_node(agent_id: str):
    async def gate_node(state: PipelineState, config: RunnableConfig) -> dict[str, Any]:
        configurable = config.get("configurable") or {}
        on_gate: GateFn | None = configurable.get("on_gate")
        decision = "proceed"
        if on_gate:
            decision = await on_gate(agent_id, state)
        return {
            "gate_agent_id": agent_id,
            "user_decision": decision,
        }

    gate_node.__name__ = gate_node_name(agent_id)
    return gate_node


def resolve_gate_target(stages: list[dict], agent_id: str, decision: str) -> str:
    """Resolve the next graph node after a stage gate decision."""
    stage_index = {stage["agent_id"]: idx for idx, stage in enumerate(stages)}
    idx = stage_index[agent_id]
    if decision == "rollback":
        return step_node_name(agent_id, stages[idx]["first_step_id"])
    if idx < len(stages) - 1:
        nxt = stages[idx + 1]
        return step_node_name(nxt["agent_id"], nxt["first_step_id"])
    return END


def _route_after_gate(stages: list[dict], agent_id: str):
    def route(state: PipelineState) -> str:
        decision = state.get("user_decision", "proceed")
        return resolve_gate_target(stages, agent_id, decision)

    return route


def compile_pipeline_graph(steps: list[dict]):
    """Build LangGraph with step nodes, stage gates, and conditional proceed/rollback edges."""
    if not steps:
        raise ValueError("Pipeline must have at least one step")

    stages = build_agent_stages(steps)
    builder = StateGraph(PipelineState)

    for step_info in steps:
        aid = step_info["agent_id"]
        sid = step_info["step_id"]
        builder.add_node(step_node_name(aid, sid), _make_step_node(aid, sid))

    for stage in stages:
        builder.add_node(gate_node_name(stage["agent_id"]), _make_gate_node(stage["agent_id"]))

    for stage in stages:
        step_names = [
            step_node_name(stage["agent_id"], step["step_id"]) for step in stage["steps"]
        ]
        for i in range(len(step_names) - 1):
            builder.add_edge(step_names[i], step_names[i + 1])
        builder.add_edge(step_names[-1], gate_node_name(stage["agent_id"]))

    for stage in stages:
        builder.add_conditional_edges(
            gate_node_name(stage["agent_id"]),
            _route_after_gate(stages, stage["agent_id"]),
        )

    first = stages[0]
    builder.add_edge(START, step_node_name(first["agent_id"], first["first_step_id"]))

    return builder.compile()


async def run_step_node(state: PipelineState) -> PipelineState:
    """Legacy single-step entry — delegates to execute_pipeline_step."""
    agent_id = state.get("agent_id", "")
    step_id = state.get("step_id", "")
    agent = get_agent_definition(agent_id)
    if not agent:
        return {**state, "error": f"Unknown agent: {agent_id}"}
    step = next((s for s in agent.workflow if s.id == step_id), None)
    if not step:
        return {**state, "error": f"Unknown step: {step_id}"}
    result = await execute_pipeline_step(state, agent, step, {})
    return {**state, **result}
