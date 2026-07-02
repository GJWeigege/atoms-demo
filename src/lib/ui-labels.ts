const PROJECT_STATUS: Record<string, string> = {
  ready: "已完成",
  generating: "生成中",
  draft: "草稿",
  failed: "失败",
};

const AGENT_STATUS: Record<string, string> = {
  pending: "等待中",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
};

export function projectStatusLabel(status: string): string {
  return PROJECT_STATUS[status] ?? status;
}

export function agentStatusLabel(status: string): string {
  return AGENT_STATUS[status] ?? status;
}
