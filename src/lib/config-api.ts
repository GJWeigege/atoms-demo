import type {
  AgentConfig,
  AppConfig,
  DiscoverProject,
  ProjectTemplate,
  TemplateCategory,
} from "@/lib/config/types";
import { clientApiUrl } from "@/lib/client-api";
import { getBackendUrl } from "@/lib/backend-url";

const FETCH_TIMEOUT_MS = 10_000;

export class AppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppConfigError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new AppConfigError(`Invalid app config: '${field}' must be a string`);
  }
  return value;
}

function parseAgent(value: unknown): AgentConfig {
  if (!isRecord(value)) {
    throw new AppConfigError("Invalid app config: agent entry must be an object");
  }
  return {
    id: requireString(value.id, "agent.id"),
    name: requireString(value.name, "agent.name"),
    nameZh: requireString(value.nameZh, "agent.nameZh"),
    role: requireString(value.role, "agent.role"),
    roleZh: requireString(value.roleZh, "agent.roleZh"),
    color: requireString(value.color, "agent.color"),
    bgColor: requireString(value.bgColor, "agent.bgColor"),
    emoji: requireString(value.emoji, "agent.emoji"),
    description: requireString(value.description, "agent.description"),
    descriptionZh: requireString(value.descriptionZh, "agent.descriptionZh"),
    inPipeline: typeof value.inPipeline === "boolean" ? value.inPipeline : undefined,
    pipelineOrder:
      typeof value.pipelineOrder === "number" ? value.pipelineOrder : undefined,
    inputs: Array.isArray(value.inputs)
      ? value.inputs.filter((item): item is string => typeof item === "string")
      : undefined,
    outputs: Array.isArray(value.outputs)
      ? value.outputs.filter((item): item is string => typeof item === "string")
      : undefined,
    workflow: Array.isArray(value.workflow) ? (value.workflow as AgentConfig["workflow"]) : undefined,
  };
}

function parseTemplate(value: unknown): ProjectTemplate {
  if (!isRecord(value)) {
    throw new AppConfigError("Invalid app config: template entry must be an object");
  }
  return {
    id: requireString(value.id, "template.id"),
    name: requireString(value.name, "template.name"),
    description: requireString(value.description, "template.description"),
    category: requireString(value.category, "template.category"),
    appType: requireString(value.appType, "template.appType"),
    prompt: requireString(value.prompt, "template.prompt"),
    icon: requireString(value.icon, "template.icon"),
    gradient: requireString(value.gradient, "template.gradient"),
  };
}

function parseCategory(value: unknown): TemplateCategory {
  if (!isRecord(value)) {
    throw new AppConfigError("Invalid app config: category entry must be an object");
  }
  return {
    id: requireString(value.id, "category.id"),
    label: requireString(value.label, "category.label"),
    labelEn: requireString(value.labelEn, "category.labelEn"),
  };
}

function parseDiscoverProject(value: unknown): DiscoverProject {
  if (!isRecord(value)) {
    throw new AppConfigError("Invalid app config: discover project entry must be an object");
  }
  return {
    id: requireString(value.id, "discoverProject.id"),
    name: requireString(value.name, "discoverProject.name"),
    description: requireString(value.description, "discoverProject.description"),
    author: requireString(value.author, "discoverProject.author"),
    category: requireString(value.category, "discoverProject.category"),
    emoji: requireString(value.emoji, "discoverProject.emoji"),
    gradient: requireString(value.gradient, "discoverProject.gradient"),
    remixPrompt: requireString(value.remixPrompt, "discoverProject.remixPrompt"),
  };
}

export function parseAppConfig(data: unknown): AppConfig {
  if (!isRecord(data)) {
    throw new AppConfigError("Invalid app config: response must be an object");
  }
  if (!Array.isArray(data.agents) || data.agents.length === 0) {
    throw new AppConfigError("Invalid app config: 'agents' must be a non-empty array");
  }
  if (!Array.isArray(data.templates)) {
    throw new AppConfigError("Invalid app config: 'templates' must be an array");
  }
  if (!Array.isArray(data.categories)) {
    throw new AppConfigError("Invalid app config: 'categories' must be an array");
  }
  if (!Array.isArray(data.discoverProjects)) {
    throw new AppConfigError("Invalid app config: 'discoverProjects' must be an array");
  }

  return {
    agents: data.agents.map(parseAgent),
    templates: data.templates.map(parseTemplate),
    categories: data.categories.map(parseCategory),
    discoverProjects: data.discoverProjects.map(parseDiscoverProject),
  };
}

async function fetchConfigFromUrl(url: string, init?: RequestInit): Promise<AppConfig> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    ...init,
  });
  if (!res.ok) {
    throw new AppConfigError(`Failed to load app config (${res.status})`);
  }
  const data: unknown = await res.json();
  return parseAppConfig(data);
}

export async function fetchAppConfig(init?: RequestInit): Promise<AppConfig> {
  return fetchConfigFromUrl(`${getBackendUrl()}/api/config`, init);
}

/** Client-side fetch directly to the Python backend. */
export async function fetchAppConfigClient(): Promise<AppConfig> {
  return fetchConfigFromUrl(clientApiUrl("/api/config"), { credentials: "include" });
}

export async function tryFetchAppConfig(
  init?: RequestInit,
): Promise<{ config: AppConfig | null; error: string | null }> {
  try {
    const config = await fetchAppConfig(init);
    return { config, error: null };
  } catch (err) {
    const message =
      err instanceof AppConfigError
        ? err.message
        : err instanceof Error
          ? err.message
          : "配置服务暂时不可用";
    return { config: null, error: message };
  }
}

export async function tryFetchAppConfigClient(): Promise<{
  config: AppConfig | null;
  error: string | null;
}> {
  try {
    const config = await fetchAppConfigClient();
    return { config, error: null };
  } catch (err) {
    const message =
      err instanceof AppConfigError
        ? err.message
        : err instanceof Error
          ? err.message
          : "配置服务暂时不可用";
    return { config: null, error: message };
  }
}
