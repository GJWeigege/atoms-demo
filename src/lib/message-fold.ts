import type { ConversationMessage } from "@/lib/conversation-types";

export function isAgentDeliverableMessage(message: ConversationMessage): boolean {
  return (
    message.role === "assistant" &&
    Boolean(message.agentId || message.agentName) &&
    message.content.trim().length > 0
  );
}

/** Fold every agent deliverable except the most recent one (by createdAt). */
export function computeDefaultFoldedAgentMessages(
  messages: ConversationMessage[],
): Record<string, boolean> {
  const deliverables = messages
    .filter(isAgentDeliverableMessage)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (deliverables.length <= 1) return {};

  const latestId = deliverables[deliverables.length - 1].id;
  const folded: Record<string, boolean> = {};
  for (const message of deliverables) {
    if (message.id !== latestId) {
      folded[message.id] = true;
    }
  }
  return folded;
}
