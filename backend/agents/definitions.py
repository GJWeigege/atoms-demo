"""Agent definitions and workflow schema for the pipeline."""

from dataclasses import dataclass, field

from shared_config import get_agents_raw


@dataclass
class WorkflowStep:
    id: str
    name: str
    name_zh: str
    template: str
    input_keys: list[str]
    output_type: str
    description: str = ""
    depends_on: list[str] = field(default_factory=list)


@dataclass
class AgentDefinition:
    id: str
    name: str
    name_zh: str
    role: str
    role_zh: str
    inputs: list[str]
    outputs: list[str]
    workflow: list[WorkflowStep] = field(default_factory=list)


def _parse_workflow_step(raw: dict) -> WorkflowStep:
    return WorkflowStep(
        id=raw["id"],
        name=raw["name"],
        name_zh=raw["nameZh"],
        template=raw["template"],
        input_keys=raw["inputKeys"],
        output_type=raw["outputType"],
        description=raw.get("description", ""),
        depends_on=list(raw.get("dependsOn", [])),
    )


def _parse_agent(raw: dict) -> AgentDefinition:
    return AgentDefinition(
        id=raw["id"],
        name=raw["name"],
        name_zh=raw["nameZh"],
        role=raw["role"],
        role_zh=raw["roleZh"],
        inputs=list(raw.get("inputs", [])),
        outputs=list(raw.get("outputs", [])),
        workflow=[_parse_workflow_step(step) for step in raw.get("workflow", [])],
    )


def load_agent_definitions() -> list[AgentDefinition]:
    return [_parse_agent(raw) for raw in get_agents_raw()]


def get_agent_definitions() -> list[AgentDefinition]:
    return load_agent_definitions()


def get_agent_definition(agent_id: str) -> AgentDefinition | None:
    return next((a for a in get_agent_definitions() if a.id == agent_id), None)
