import { describe, expect, it } from "vitest";
import {
  finalizeStreamingAgentMessage,
  mergeConversationMessage,
  mergeProjectChatMessages,
  buildTimeline,
  dedupeTimelineEvents,
  normalizeHandoffEvent,
  partitionTimelineMessages,
  resolveHandoffAgentIds,
  type ConversationMessage,
  type HandoffEvent,
  type RollbackEvent,
} from "./conversation-types";

const baseTime = "2026-06-30T03:00:00.000Z";

function msg(
  partial: Partial<ConversationMessage> & Pick<ConversationMessage, "id" | "role" | "content">,
): ConversationMessage {
  return {
    createdAt: baseTime,
    status: "complete",
    ...partial,
  };
}

describe("mergeConversationMessage", () => {
  it("replaces matching optimistic temp user message", () => {
    const prev = [msg({ id: "temp-1", role: "user", content: "继续" })];
    const next = mergeConversationMessage(
      prev,
      msg({ id: "real-1", role: "user", content: "继续", createdAt: "2026-06-30T03:01:00.000Z" }),
    );
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("real-1");
  });

  it("updates existing message by id", () => {
    const prev = [msg({ id: "a1", role: "assistant", content: "old", agentId: "alex" })];
    const next = mergeConversationMessage(
      prev,
      msg({ id: "a1", role: "assistant", content: "new", agentId: "alex" }),
    );
    expect(next[0].content).toBe("new");
  });

  it("keeps temp user when assistant message arrives", () => {
    const prev = [msg({ id: "temp-1", role: "user", content: "继续" })];
    const next = mergeConversationMessage(
      prev,
      msg({ id: "a1", role: "assistant", content: "done", agentId: "alex" }),
    );
    expect(next).toHaveLength(2);
    expect(next.some((m) => m.id === "temp-1")).toBe(true);
  });
});

describe("mergeProjectChatMessages", () => {
  const convBase = [
    msg({
      id: "conv-1",
      role: "assistant",
      content: "pipeline done",
      agentId: "alex",
      createdAt: "2026-06-30T03:00:00.000Z",
    }),
  ];

  it("returns sorted project messages when base is empty", () => {
    const project = [
      msg({ id: "p2", role: "user", content: "b", createdAt: "2026-06-30T03:02:00.000Z" }),
      msg({ id: "p1", role: "user", content: "a", createdAt: "2026-06-30T03:01:00.000Z" }),
    ];
    const merged = mergeProjectChatMessages([], project);
    expect(merged.map((m) => m.id)).toEqual(["p1", "p2"]);
  });

  it("appends project-only refinements after conversation timeline", () => {
    const project = [
      msg({ id: "p-user", role: "user", content: "继续", createdAt: "2026-06-30T03:03:00.000Z" }),
      msg({
        id: "p-asst",
        role: "assistant",
        content: "applied",
        agentId: "alex",
        createdAt: "2026-06-30T03:03:01.000Z",
      }),
    ];
    const merged = mergeProjectChatMessages(convBase, project);
    expect(merged).toHaveLength(3);
    expect(merged[1].content).toBe("继续");
  });

  it("dedupes dual-write near duplicates but keeps repeated identical text later", () => {
    const synced = [
      ...convBase,
      msg({ id: "conv-u", role: "user", content: "继续", createdAt: "2026-06-30T03:03:00.000Z" }),
      msg({
        id: "conv-a",
        role: "assistant",
        content: "applied",
        agentId: "alex",
        createdAt: "2026-06-30T03:03:00.500Z",
      }),
    ];
    const project = [
      msg({ id: "p-user", role: "user", content: "继续", createdAt: "2026-06-30T03:03:00.100Z" }),
      msg({
        id: "p-asst",
        role: "assistant",
        content: "applied",
        agentId: "alex",
        createdAt: "2026-06-30T03:03:00.200Z",
      }),
      msg({ id: "p-user-2", role: "user", content: "继续", createdAt: "2026-06-30T03:10:00.000Z" }),
    ];
    const merged = mergeProjectChatMessages(synced, project);
    expect(merged.filter((m) => m.role === "user" && m.content === "继续")).toHaveLength(2);
    expect(merged.some((m) => m.id === "p-user")).toBe(false);
    expect(merged.some((m) => m.id === "p-user-2")).toBe(true);
  });
});

describe("finalizeStreamingAgentMessage", () => {
  it("preserves react steps accumulated during streaming", () => {
    const streaming = [
      msg({
        id: "stream-alex",
        role: "assistant",
        agentId: "alex",
        content: "partial",
        status: "streaming",
        reactSteps: [
          { phase: "thought", content: "think" },
          { phase: "action", content: "act" },
        ],
        stepCount: 2,
      }),
    ];
    const { finalized, messages } = finalizeStreamingAgentMessage(
      streaming,
      {
        id: "persisted-1",
        role: "assistant",
        agentId: "alex",
        agentName: "Alex",
        content: "final",
      },
      { messageType: "chat" },
    );
    expect(finalized.reactSteps).toHaveLength(2);
    expect(finalized.stepCount).toBe(2);
    expect(messages).toHaveLength(1);
    expect(messages[0].status).toBe("complete");
  });

  it("prefers reactSteps from message_complete payload over streaming", () => {
    const streaming = [
      msg({
        id: "stream-alex",
        role: "assistant",
        agentId: "alex",
        content: "",
        status: "streaming",
        reactSteps: [{ phase: "thought", content: "old" }],
      }),
    ];
    const { finalized } = finalizeStreamingAgentMessage(streaming, {
      id: "persisted-1",
      role: "assistant",
      agentId: "alex",
      content: "final",
      reactSteps: [
        { phase: "thought", content: "new-thought" },
        { phase: "action", content: "new-action" },
        { phase: "observation", content: "new-obs" },
      ],
      stepCount: 3,
    });
    expect(finalized.reactSteps).toHaveLength(3);
    expect(finalized.reactSteps?.[0].content).toBe("new-thought");
  });
});

describe("buildTimeline handoff placement", () => {
  it("inserts handoff after the from-agent message, not before the to-agent", () => {
    const messages: ConversationMessage[] = [
      msg({
        id: "mike-1",
        role: "assistant",
        agentId: "mike",
        content: "plan",
        createdAt: "2026-06-30T03:00:00.000Z",
      }),
      msg({
        id: "emma-stream",
        role: "assistant",
        agentId: "emma",
        content: "prd preview",
        status: "streaming",
        createdAt: "2026-06-30T03:05:00.000Z",
      }),
    ];
    const handoffs = [
      {
        id: "ho-1",
        from: "mike",
        to: "emma",
        message: "计划已确认，直接推进。@Emma",
        createdAt: "2026-06-30T03:01:00.000Z",
        insertAfterMessageId: "mike-1",
      },
    ];

    const timeline = buildTimeline(messages, handoffs, []);
    expect(timeline.map((item) => item.type)).toEqual(["message", "handoff", "message"]);
    if (timeline[0].type === "message") expect(timeline[0].message.id).toBe("mike-1");
    if (timeline[2].type === "message") expect(timeline[2].message.id).toBe("emma-stream");
  });
});

describe("buildTimeline rollback placement", () => {
  it("inserts rollback chronologically between two completions of the same agent", () => {
    const messages: ConversationMessage[] = [
      msg({
        id: "emma-1",
        role: "assistant",
        agentId: "emma",
        content: "first",
        createdAt: "2026-06-30T03:00:00.000Z",
      }),
      msg({
        id: "emma-2",
        role: "assistant",
        agentId: "emma",
        content: "second",
        createdAt: "2026-06-30T03:10:00.000Z",
      }),
    ];
    const rollbacks: RollbackEvent[] = [
      {
        id: "rb-1",
        agentId: "emma",
        agentName: "Emma",
        message: "回退：重新执行 Emma 阶段",
        createdAt: "2026-06-30T03:05:00.000Z",
        insertAfterMessageId: "emma-1",
      },
    ];

    const timeline = buildTimeline(messages, [], rollbacks);
    expect(timeline.map((item) => item.type)).toEqual(["message", "rollback", "message"]);
    if (timeline[0].type === "message") expect(timeline[0].message.id).toBe("emma-1");
    if (timeline[2].type === "message") expect(timeline[2].message.id).toBe("emma-2");
  });
});

describe("buildTimeline full gate flow", () => {
  it("interleaves handoffs and rollbacks after their anchored agent outputs", () => {
    const messages: ConversationMessage[] = [
      msg({
        id: "mike-1",
        role: "assistant",
        agentId: "mike",
        content: "plan",
        createdAt: "2026-06-30T03:00:00.000Z",
      }),
      msg({
        id: "stage-emma-1",
        role: "assistant",
        agentId: "emma",
        content: "first prd",
        createdAt: "2026-06-30T03:05:00.000Z",
      }),
      msg({
        id: "emma-2",
        role: "assistant",
        agentId: "emma",
        content: "revised prd",
        createdAt: "2026-06-30T03:15:00.000Z",
      }),
    ];
    const handoffs: HandoffEvent[] = [
      {
        id: "ho-mike",
        from: "mike",
        to: "emma",
        message: "计划已确认，直接推进。@Emma",
        createdAt: "2026-06-30T03:01:00.000Z",
        insertAfterMessageId: "mike-1",
      },
      {
        id: "ho-emma",
        from: "emma",
        to: "luna",
        message: "移交 @Luna",
        createdAt: "2026-06-30T03:16:00.000Z",
        insertAfterMessageId: "emma-2",
      },
    ];
    const rollbacks: RollbackEvent[] = [
      {
        id: "rb-emma",
        agentId: "emma",
        agentName: "Emma",
        message: "回退：重新执行 Emma 阶段",
        createdAt: "2026-06-30T03:10:00.000Z",
        insertAfterMessageId: "stage-emma-1",
      },
    ];

    const timeline = buildTimeline(messages, handoffs, rollbacks);
    expect(timeline.map((item) => item.type)).toEqual([
      "message",
      "handoff",
      "message",
      "rollback",
      "message",
      "handoff",
    ]);
    if (timeline[0].type === "message") expect(timeline[0].message.id).toBe("mike-1");
    if (timeline[2].type === "message") expect(timeline[2].message.id).toBe("stage-emma-1");
    if (timeline[4].type === "message") expect(timeline[4].message.id).toBe("emma-2");
  });
});

describe("partitionTimelineMessages", () => {
  it("extracts persisted handoff and rollback rows from conversation messages", () => {
    const input: ConversationMessage[] = [
      msg({ id: "mike-1", role: "assistant", agentId: "mike", content: "plan" }),
      {
        id: "ho-1",
        role: "system",
        content: "计划已确认，直接推进。@Emma",
        createdAt: "2026-06-30T03:01:00.000Z",
        messageType: "handoff",
        metadata: {
          eventKind: "handoff",
          from: "mike",
          to: "emma",
          insertAfterMessageId: "mike-1",
        },
      },
      {
        id: "rb-1",
        role: "system",
        content: "回退：重新执行 Emma 阶段",
        createdAt: "2026-06-30T03:10:00.000Z",
        messageType: "system",
        metadata: {
          eventKind: "rollback",
          agentId: "emma",
          agentName: "Emma",
          insertAfterMessageId: "emma-1",
        },
      },
    ];

    const { messages, handoffs, rollbacks } = partitionTimelineMessages(input);
    expect(messages).toHaveLength(1);
    expect(handoffs).toHaveLength(1);
    expect(rollbacks).toHaveLength(1);
    expect(handoffs[0]?.insertAfterMessageId).toBe("mike-1");
  });

  it("fills missing handoff.to from @mention in persisted content", () => {
    const input: ConversationMessage[] = [
      msg({ id: "luna-1", role: "assistant", agentId: "designer", content: "design" }),
      {
        id: "handoff-designer-abc",
        role: "system",
        content: "移交 @Bob",
        createdAt: "2026-06-30T03:05:00.000Z",
        messageType: "handoff",
        metadata: {
          eventKind: "handoff",
          from: "designer",
          insertAfterMessageId: "luna-1",
        },
      },
    ];

    const { handoffs } = partitionTimelineMessages(input);
    expect(handoffs[0]?.from).toBe("designer");
    expect(handoffs[0]?.to).toBe("bob");
  });
});

describe("resolveHandoffAgentIds", () => {
  it("parses @mention when to is missing", () => {
    expect(
      resolveHandoffAgentIds({
        id: "handoff-designer-abc",
        from: "designer",
        to: "",
        message: "移交 @Bob",
      }),
    ).toEqual({ from: "designer", to: "bob" });
  });

  it("falls back to pipeline order when mention is absent", () => {
    expect(
      resolveHandoffAgentIds({
        id: "handoff-emma-abc",
        from: "emma",
        to: "",
        message: "继续推进",
      }),
    ).toEqual({ from: "emma", to: "designer" });
  });

  it("normalizes handoff events without changing complete metadata", () => {
    const handoff: HandoffEvent = {
      id: "ho-1",
      from: "mike",
      to: "emma",
      message: "计划已确认，直接推进。@Emma",
      createdAt: baseTime,
    };
    expect(normalizeHandoffEvent(handoff)).toBe(handoff);
  });
});

describe("buildTimeline anchor fallback", () => {
  it("places handoff after the from-agent message when anchor id changed after persistence", () => {
    const messages: ConversationMessage[] = [
      msg({
        id: "db-mike-1",
        role: "assistant",
        agentId: "mike",
        content: "plan",
        createdAt: "2026-06-30T03:00:00.000Z",
      }),
      msg({
        id: "stage-emma-1",
        role: "assistant",
        agentId: "emma",
        content: "first",
        createdAt: "2026-06-30T03:05:00.000Z",
      }),
    ];
    const handoffs: HandoffEvent[] = [
      {
        id: "ho-mike",
        from: "mike",
        to: "emma",
        message: "计划已确认，直接推进。@Emma",
        createdAt: "2026-06-30T03:01:00.000Z",
        insertAfterMessageId: "stage-mike-1",
      },
    ];

    const timeline = buildTimeline(messages, handoffs, []);
    expect(timeline.map((item) => item.type)).toEqual(["message", "handoff", "message"]);
  });

  it("places rollback after the agent message when anchor id is stale", () => {
    const messages: ConversationMessage[] = [
      msg({
        id: "emma-1",
        role: "assistant",
        agentId: "emma",
        content: "first",
        createdAt: "2026-06-30T03:05:00.000Z",
      }),
      msg({
        id: "emma-2",
        role: "assistant",
        agentId: "emma",
        content: "second",
        createdAt: "2026-06-30T03:15:00.000Z",
      }),
    ];
    const rollbacks: RollbackEvent[] = [
      {
        id: "rb-1",
        agentId: "emma",
        agentName: "Emma",
        message: "回退：重新执行 Emma 阶段",
        createdAt: "2026-06-30T03:10:00.000Z",
        insertAfterMessageId: "stage-emma-stale",
      },
    ];

    const timeline = buildTimeline(messages, [], rollbacks);
    expect(timeline.map((item) => item.type)).toEqual(["message", "rollback", "message"]);
  });
});

describe("buildTimeline duplicate key prevention", () => {
  it("does not render rollback twice when annotation row remains in messages", () => {
    const messages: ConversationMessage[] = [
      msg({
        id: "emma-1",
        role: "assistant",
        agentId: "emma",
        content: "first",
        createdAt: "2026-06-30T03:05:00.000Z",
      }),
      {
        id: "rollback-emma-1",
        role: "system",
        content: "回退：重新执行 Emma 阶段",
        agentId: "emma",
        agentName: "Emma",
        createdAt: "2026-06-30T03:10:00.000Z",
        messageType: "system",
      },
    ];
    const rollbacks: RollbackEvent[] = [
      {
        id: "rollback-emma-1",
        agentId: "emma",
        agentName: "Emma",
        message: "回退：重新执行 Emma 阶段",
        createdAt: "2026-06-30T03:10:00.000Z",
        insertAfterMessageId: "emma-1",
      },
    ];

    const timeline = buildTimeline(messages, [], rollbacks);
    const rollbackItems = timeline.filter((item) => item.type === "rollback");
    expect(rollbackItems).toHaveLength(1);
    expect(timeline.map((item) => item.type)).toEqual(["message", "rollback"]);
  });
});

describe("dedupeTimelineEvents", () => {
  it("keeps one entry per id and preserves first occurrence", () => {
    const events: HandoffEvent[] = [
      {
        id: "ho-1",
        from: "mike",
        to: "emma",
        message: "persisted",
        createdAt: "2026-06-30T03:01:00.000Z",
      },
      {
        id: "ho-1",
        from: "mike",
        to: "emma",
        message: "live duplicate",
        createdAt: "2026-06-30T03:01:00.000Z",
      },
      {
        id: "ho-2",
        from: "emma",
        to: "designer",
        message: "second",
        createdAt: "2026-06-30T03:16:00.000Z",
      },
    ];

    const deduped = dedupeTimelineEvents(events);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.message).toBe("persisted");
  });
});
