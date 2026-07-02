"""MCP-compatible artifact tools — integration point for future MCP server."""

from dataclasses import dataclass


@dataclass
class MCPToolSpec:
    name: str
    description: str
    parameters: dict


MCP_ARTIFACT_TOOLS: list[MCPToolSpec] = [
    MCPToolSpec(
        name="save_artifact",
        description="Persist pipeline artifact to PostgreSQL",
        parameters={
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "artifact_type": {"type": "string"},
                "content": {"type": "string"},
                "agent_id": {"type": "string"},
            },
            "required": ["project_id", "artifact_type", "content"],
        },
    ),
    MCPToolSpec(
        name="read_artifact",
        description="Read artifact by type from project",
        parameters={
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "artifact_type": {"type": "string"},
            },
            "required": ["project_id", "artifact_type"],
        },
    ),
    MCPToolSpec(
        name="export_to_github",
        description="Export generated app to GitHub repository",
        parameters={
            "type": "object",
            "properties": {
                "project_id": {"type": "string"},
                "repo_name": {"type": "string"},
                "is_private": {"type": "boolean"},
            },
            "required": ["project_id", "repo_name"],
        },
    ),
]


def list_mcp_tools() -> list[dict]:
    """Return tool specs for MCP server registration."""
    return [
        {"name": t.name, "description": t.description, "inputSchema": t.parameters}
        for t in MCP_ARTIFACT_TOOLS
    ]
