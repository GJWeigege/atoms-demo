"""Build pipeline stages from agents.json — single source of truth for core stages."""

from __future__ import annotations

from typing import Any

from shared_config import get_agents_raw


def build_core_stages_from_agents() -> list[dict[str, Any]]:
    pipeline_agents = sorted(
        (agent for agent in get_agents_raw() if agent.get("inPipeline")),
        key=lambda agent: agent.get("pipelineOrder", 999),
    )
    stages: list[dict[str, Any]] = []
    for agent in pipeline_agents:
        workflow = agent.get("workflow", [])
        stage: dict[str, Any] = {
            "agentId": agent["id"],
            "steps": [step["id"] for step in workflow if isinstance(step, dict) and step.get("id")],
        }
        inputs = agent.get("inputs")
        if inputs:
            stage["inputs"] = list(inputs)
        stages.append(stage)
    return stages


def validate_optional_stages(config: dict[str, Any]) -> list[str]:
    """Return human-readable errors for optional stage step references."""
    errors: list[str] = []
    agents_by_id = {agent["id"]: agent for agent in get_agents_raw()}
    for agent_id, meta in config.get("optionalStages", {}).items():
        agent = agents_by_id.get(agent_id)
        if not agent:
            errors.append(f"optional stage references unknown agent '{agent_id}'")
            continue
        valid_step_ids = {
            step["id"]
            for step in agent.get("workflow", [])
            if isinstance(step, dict) and step.get("id")
        }
        for step_id in meta.get("steps", []):
            if step_id not in valid_step_ids:
                errors.append(
                    f"optional stage '{agent_id}' references unknown step '{step_id}'"
                )
    return errors
