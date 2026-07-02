"""Tests for LangGraph pipeline compilation."""

from agents.graph import (
    build_agent_stages,
    compile_pipeline_graph,
    extend_pipeline_config,
    gate_node_name,
    load_pipeline_config,
    parse_step_node_name,
    resolve_gate_target,
    resolve_pipeline_steps,
    step_node_name,
)


def _graph_nodes(graph) -> list[str]:
    reserved = {"__start__", "__end__"}
    return [n for n in graph.get_graph().nodes if n not in reserved]


def _step_nodes(graph) -> list[str]:
    return [n for n in _graph_nodes(graph) if not n.startswith("gate__")]


def _gate_nodes(graph) -> list[str]:
    return [n for n in _graph_nodes(graph) if n.startswith("gate__")]


def test_pipeline_has_23_core_steps():
    steps = resolve_pipeline_steps(load_pipeline_config())
    assert len(steps) == 23


def test_step_node_name_roundtrip():
    name = step_node_name("mike", "intake-analysis")
    assert parse_step_node_name(name) == ("mike", "intake-analysis")
    assert ":" not in name


def test_compile_pipeline_graph_node_count():
    steps = resolve_pipeline_steps(load_pipeline_config())
    graph = compile_pipeline_graph(steps)
    assert len(_step_nodes(graph)) == 23
    assert len(_gate_nodes(graph)) == len(build_agent_stages(steps))


def test_gate_nodes_follow_each_agent_stage():
    steps = resolve_pipeline_steps(load_pipeline_config())
    stages = build_agent_stages(steps)
    graph = compile_pipeline_graph(steps)
    for stage in stages:
        assert gate_node_name(stage["agent_id"]) in _gate_nodes(graph)


def test_gate_rollback_routes_to_current_agent_first_step():
    steps = resolve_pipeline_steps(load_pipeline_config())
    stages = build_agent_stages(steps)
    emma_stage = next(s for s in stages if s["agent_id"] == "emma")
    target = resolve_gate_target(stages, "emma", "rollback")
    assert target == step_node_name("emma", emma_stage["first_step_id"])


def test_gate_proceed_routes_to_next_agent():
    steps = resolve_pipeline_steps(load_pipeline_config())
    stages = build_agent_stages(steps)
    target = resolve_gate_target(stages, "emma", "proceed")
    assert target == step_node_name("designer", "design-research")


def test_optional_agents_extend_graph():
    config = extend_pipeline_config(load_pipeline_config(), "请做竞品调研和 SEO 关键词分析")
    steps = resolve_pipeline_steps(config)
    agent_ids = [s["agent_id"] for s in steps]
    assert "iris" in agent_ids
    assert "sarah" in agent_ids
    assert agent_ids.index("iris") > agent_ids.index("emma")
    graph = compile_pipeline_graph(steps)
    assert len(_step_nodes(graph)) == 23 + 8  # iris 4 + sarah 4
    assert len(_gate_nodes(graph)) == len(build_agent_stages(steps))
