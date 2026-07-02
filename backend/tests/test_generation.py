from services.artifact_display import (
    build_agent_stage_display,
    extract_markdown_title,
    sanitize_embedded_artifacts,
    upstream_title_reference,
)
from services.generation import _build_agent_message_content


def test_extract_markdown_title():
    assert extract_markdown_title("# 需求 Intake 分析\n\nbody") == "需求 Intake 分析"
    assert extract_markdown_title("no heading", "默认") == "默认"


def test_upstream_title_reference():
    assert upstream_title_reference("# 项目计划\n\n...") == "📎 **项目计划**"


def test_sanitize_embedded_artifacts_replaces_upstream_bodies():
    upstream_plan = "# 项目计划\n\n" + ("计划内容 " * 20)
    requirements = f"# 需求分析\n\n### 上游\n{upstream_plan}\n\n## 本阶段\n独有内容"
    result = sanitize_embedded_artifacts(requirements, {"plan": upstream_plan})
    assert upstream_plan not in result
    assert "📎 **项目计划**" in result
    assert "独有内容" in result


def test_build_agent_stage_display_shows_own_steps_and_stubs_upstream():
    intake = "# 需求 Intake 分析\n\nintake 独有正文"
    plan = "# 项目计划\n\n" + intake + "\n\n## 里程碑\n里程碑内容"
    task = "# 任务拆解\n\n" + intake + "\n\n任务细节"
    artifacts = {
        "intake": intake,
        "task_decomposition": task,
        "plan": plan,
    }

    content = build_agent_stage_display("mike", artifacts)

    assert "## 需求 intake 分析" in content
    assert "intake 独有正文" in content
    assert "## 任务拆解与分配" in content
    assert "任务细节" in content
    assert "📎 **需求 Intake 分析**" in content
    assert "里程碑内容" in content
    plan_section = content[content.index("## 项目计划") :]
    assert intake not in plan_section


def test_build_agent_stage_display_stubs_cross_agent_plan_for_emma():
    plan = "# 项目计划\n\n" + ("Mike 计划 " * 30)
    stakeholders = "# 利益相关者\n\n" + plan + "\n\n干系人表格"
    requirements = "# 需求分析\n\n" + plan + "\n\n" + stakeholders + "\n\nFR-01"
    artifacts = {
        "plan": plan,
        "stakeholders": stakeholders,
        "requirements": requirements,
        "user_journey": "# 用户旅程\n\n旅程内容",
        "feature_priority": "# 功能优先级\n\nMoSCoW",
        "prd": "# 产品需求文档\n\n" + plan + "\n\nPRD 定稿段落",
    }

    content = build_agent_stage_display("emma", artifacts)

    assert plan not in content
    assert "📎 **项目计划**" in content
    assert "FR-01" in content
    assert "PRD 定稿段落" in content
    assert "## 利益相关者分析" in content
    assert "## PRD 编写" in content


def test_build_agent_message_content_delegates_to_stage_display():
    intake = "# 需求 Intake 分析\n\n正文"
    content = _build_agent_message_content("mike", {"intake": intake}, "Mike")
    assert content == f"## 需求 intake 分析\n\n{intake}"
