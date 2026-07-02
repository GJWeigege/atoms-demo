"""Tests for pipeline config derived from agents.json."""

from agents.graph import load_pipeline_config
from agents.pipeline_config import build_core_stages_from_agents


def test_core_stages_include_pipeline_agents_in_order():
    stages = build_core_stages_from_agents()
    agent_ids = [stage["agentId"] for stage in stages]
    assert agent_ids == ["mike", "emma", "designer", "bob", "alex"]


def test_each_stage_steps_match_agent_workflow():
    stages = build_core_stages_from_agents()
    config = load_pipeline_config()
    assert config["stages"] == stages
    for stage in stages:
        assert stage["steps"], f"agent {stage['agentId']} must expose workflow steps"


def test_optional_stages_preserved():
    config = load_pipeline_config()
    assert "iris" in config["optionalStages"]
    assert "sarah" in config["optionalStages"]
    assert "adrian" in config["optionalStages"]
