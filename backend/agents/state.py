from typing import TypedDict


class PipelineState(TypedDict, total=False):
    project_id: str
    prompt: str
    theme: str
    artifacts: dict[str, str]
    artifact_ids: dict[str, str]
    current_step: str
    messages: list[str]
    mode: str
    error: str | None
