export type WorkflowStepConfig = {
  id: string;
  name: string;
  nameZh: string;
  description?: string;
  dependsOn?: string[];
  template: string;
  inputKeys: string[];
  outputType: string;
};

export type AgentConfig = {
  id: string;
  name: string;
  nameZh: string;
  role: string;
  roleZh: string;
  color: string;
  bgColor: string;
  emoji: string;
  description: string;
  descriptionZh: string;
  inPipeline?: boolean;
  pipelineOrder?: number;
  inputs?: string[];
  outputs?: string[];
  workflow?: WorkflowStepConfig[];
};

export type AgentDefinition = {
  role: string;
  name: string;
  title: string;
  description: string;
  order: number;
};

export type TemplateCategoryId = string;

export type TemplateCategory = {
  id: TemplateCategoryId;
  label: string;
  labelEn: string;
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  category: TemplateCategoryId;
  appType: string;
  prompt: string;
  icon: string;
  gradient: string;
};

export type DiscoverProject = {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  emoji: string;
  gradient: string;
  remixPrompt: string;
};

export type AppConfig = {
  agents: AgentConfig[];
  templates: ProjectTemplate[];
  categories: TemplateCategory[];
  discoverProjects: DiscoverProject[];
};

export type AppConfigDerived = {
  pipelineAgents: AgentDefinition[];
  agentRoleMeta: Record<string, { title: string; emoji: string }>;
  stepArtifactTypes: Record<string, string>;
  stepMeta: Record<string, { nameZh: string; description?: string; agentId: string }>;
};
