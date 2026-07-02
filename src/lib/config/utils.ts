import type { AgentConfig, AgentDefinition, AppConfigDerived } from "./types";

export function buildConfigDerived(agents: AgentConfig[]): AppConfigDerived {
  const pipelineAgents: AgentDefinition[] = agents
    .filter((a) => a.inPipeline)
    .sort((a, b) => (a.pipelineOrder ?? 0) - (b.pipelineOrder ?? 0))
    .map((a) => ({
      role: a.role,
      name: a.name,
      title: a.roleZh,
      description: a.descriptionZh,
      order: a.pipelineOrder ?? 0,
    }));

  const agentRoleMeta = Object.fromEntries(
    agents.map((agent) => [
      agent.role,
      { title: agent.roleZh, emoji: agent.emoji },
    ]),
  );

  const stepArtifactTypes = Object.fromEntries(
    agents.flatMap((agent) =>
      (agent.workflow ?? []).map((step) => [step.id, step.outputType]),
    ),
  );

  const stepMeta = Object.fromEntries(
    agents.flatMap((agent) =>
      (agent.workflow ?? []).map((step) => [
        step.id,
        {
          nameZh: step.nameZh,
          description: step.description,
          agentId: agent.id,
        },
      ]),
    ),
  );

  return { pipelineAgents, agentRoleMeta, stepArtifactTypes, stepMeta };
}

export function getAgentById(
  agents: AgentConfig[],
  agentId: string,
): AgentConfig | undefined {
  return agents.find((a) => a.id === agentId);
}

export function getAgentByRole(
  agents: AgentConfig[],
  role: string,
): AgentConfig | undefined {
  return agents.find((a) => a.role === role);
}
