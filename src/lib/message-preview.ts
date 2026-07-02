export function getMarkdownTitle(content: string, fallback = "产出物"): string {
  const match = content.match(/^#{1,6}\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

export function getAgentOutputPreview(content: string): string {
  const title = getMarkdownTitle(content);
  if (title !== "产出物") return title;
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 48) return trimmed;
  return `${trimmed.slice(0, 48)}…`;
}
