import { describe, expect, it } from "vitest";
import { computeDefaultFoldedAgentMessages } from "./message-fold";
import type { ConversationMessage } from "./conversation-types";

function agentMessage(id: string, agentId: string, createdAt: string): ConversationMessage {
  return {
    id,
    role: "assistant",
    agentId,
    agentName: agentId,
    content: `# ${agentId} 产出\n\n正文`,
    createdAt,
  };
}

describe("computeDefaultFoldedAgentMessages", () => {
  it("folds all but the latest deliverable", () => {
    const messages = [
      agentMessage("m1", "mike", "2026-01-01T10:00:00.000Z"),
      agentMessage("m2", "emma", "2026-01-01T11:00:00.000Z"),
      agentMessage("m3", "designer", "2026-01-01T12:00:00.000Z"),
    ];

    expect(computeDefaultFoldedAgentMessages(messages)).toEqual({
      m1: true,
      m2: true,
    });
  });

  it("returns empty map when there is only one deliverable", () => {
    const messages = [agentMessage("m1", "mike", "2026-01-01T10:00:00.000Z")];
    expect(computeDefaultFoldedAgentMessages(messages)).toEqual({});
  });

  it("ignores user messages and empty agent messages", () => {
    const messages: ConversationMessage[] = [
      { id: "u1", role: "user", content: "hello", createdAt: "2026-01-01T09:00:00.000Z" },
      { id: "m1", role: "assistant", agentId: "mike", content: "", createdAt: "2026-01-01T10:00:00.000Z" },
      agentMessage("m2", "emma", "2026-01-01T11:00:00.000Z"),
    ];

    expect(computeDefaultFoldedAgentMessages(messages)).toEqual({});
  });
});
