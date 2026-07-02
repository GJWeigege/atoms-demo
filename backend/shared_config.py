"""Load shared JSON config from the repo root `config/` directory."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from config import get_settings

PUBLIC_AGENT_FIELDS = (
    "id",
    "name",
    "nameZh",
    "role",
    "roleZh",
    "color",
    "bgColor",
    "emoji",
    "description",
    "descriptionZh",
    "inPipeline",
    "pipelineOrder",
    "inputs",
    "outputs",
    "workflow",
)


class ConfigLoadError(Exception):
    def __init__(self, filename: str, path: Path, reason: str) -> None:
        self.filename = filename
        self.path = path
        self.reason = reason
        super().__init__(f"Failed to load config '{filename}' from {path}: {reason}")


def _config_root() -> Path:
    return get_settings().config_path


def _load_json(filename: str) -> dict[str, Any]:
    path = _config_root() / filename
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise ConfigLoadError(filename, path, "file not found") from exc
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ConfigLoadError(filename, path, f"invalid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigLoadError(filename, path, "root must be a JSON object")
    return data


def _load_list_key(filename: str, key: str) -> list[dict[str, Any]]:
    data = _load_json(filename)
    items = data.get(key)
    if not isinstance(items, list):
        raise ConfigLoadError(
            filename,
            _config_root() / filename,
            f"missing or invalid '{key}' array",
        )
    return items


def _load_agents_list() -> list[dict[str, Any]]:
    agents = _load_list_key("agents.json", "agents")
    if not agents:
        raise ConfigLoadError(
            "agents.json",
            _config_root() / "agents.json",
            "'agents' array must not be empty",
        )
    return agents


@lru_cache
def _get_agents_raw_cached() -> str:
    return json.dumps(_load_agents_list(), ensure_ascii=False)


@lru_cache
def _get_project_templates_cached() -> str:
    return json.dumps(_load_list_key("project-templates.json", "templates"), ensure_ascii=False)


@lru_cache
def _get_template_categories_cached() -> str:
    return json.dumps(
        _load_list_key("template-categories.json", "categories"),
        ensure_ascii=False,
    )


def get_agents_raw() -> list[dict[str, Any]]:
    if get_settings().is_production:
        return json.loads(_get_agents_raw_cached())
    return _load_agents_list()


def get_project_templates() -> list[dict[str, Any]]:
    if get_settings().is_production:
        return json.loads(_get_project_templates_cached())
    return _load_list_key("project-templates.json", "templates")


def get_template_categories() -> list[dict[str, Any]]:
    if get_settings().is_production:
        return json.loads(_get_template_categories_cached())
    return _load_list_key("template-categories.json", "categories")


def get_agent_by_id(agent_id: str) -> dict[str, Any] | None:
    return next((a for a in get_agents_raw() if a["id"] == agent_id), None)


def get_agent_by_name(name: str) -> dict[str, Any] | None:
    lower = name.lower()
    return next(
        (
            a
            for a in get_agents_raw()
            if a["name"].lower() == lower or a["id"] == lower
        ),
        None,
    )


def get_default_agent() -> dict[str, Any]:
    agents = get_agents_raw()
    if not agents:
        raise ConfigLoadError(
            "agents.json",
            _config_root() / "agents.json",
            "'agents' array must not be empty",
        )
    return agents[0]


def get_chat_agent(agent_id: str | None) -> dict[str, Any]:
    if agent_id:
        agent = get_agent_by_id(agent_id)
        if agent:
            return agent
    return get_default_agent()


def get_template_by_id(template_id: str) -> dict[str, Any] | None:
    return next((t for t in get_project_templates() if t["id"] == template_id), None)


def get_template_app_type(template_id: str) -> str:
    template = get_template_by_id(template_id)
    if template:
        return template.get("appType", "generic")
    return "generic"


def get_public_agents() -> list[dict[str, Any]]:
    """Agent metadata for the frontend — whitelist of safe fields only."""
    return [
        {field: agent[field] for field in PUBLIC_AGENT_FIELDS if field in agent}
        for agent in get_agents_raw()
    ]


@lru_cache
def _get_discover_projects_cached() -> str:
    return json.dumps(
        _load_list_key("discover-projects.json", "projects"),
        ensure_ascii=False,
    )


def get_discover_projects() -> list[dict[str, Any]]:
    if get_settings().is_production:
        return json.loads(_get_discover_projects_cached())
    return _load_list_key("discover-projects.json", "projects")


def get_app_config() -> dict[str, Any]:
    return {
        "agents": get_public_agents(),
        "templates": get_project_templates(),
        "categories": get_template_categories(),
        "discoverProjects": get_discover_projects(),
    }
