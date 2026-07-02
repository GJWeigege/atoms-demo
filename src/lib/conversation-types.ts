export type ReactPhase = "thought" | "action" | "observation";

export type ReactStep = {
  phase: ReactPhase;
  content: string;
  timestamp?: string;
};

const VALID_PHASES = new Set<ReactPhase>(["thought", "action", "observation"]);

/** Normalize reactSteps from API/DB (may be JSON string or malformed). */
export function normalizeReactSteps(raw: unknown): ReactStep[] {
  if (raw == null) return [];

  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is ReactStep =>
        item != null &&
        typeof item === "object" &&
        "phase" in item &&
        "content" in item &&
        VALID_PHASES.has((item as ReactStep).phase) &&
        typeof (item as ReactStep).content === "string",
    )
    .map((item) => ({
      phase: item.phase,
      content: item.content,
      timestamp: item.timestamp,
    }));
}

export type ConversationMessage = {
  id: string;
  role: string;
  content: string;
  agentId?: string | null;
  agentName?: string | null;
  createdAt: string;
  reactSteps?: ReactStep[] | null;
  messageType?: "chat" | "plan" | "handoff" | "completion" | "system" | null;
  status?: "streaming" | "complete" | null;
  stepCount?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type HandoffEvent = {
  id: string;
  from: string;
  to: string;
  message?: string;
  createdAt: string;
  insertAfterMessageId?: string;
};

export type RollbackEvent = {
  id: string;
  agentId: string;
  agentName: string;
  roleZh?: string;
  message?: string;
  createdAt: string;
  insertAfterMessageId?: string;
};

export type ChatTimelineItem =
  | { type: "message"; message: ConversationMessage }
  | { type: "handoff"; handoff: HandoffEvent }
  | { type: "rollback"; rollback: RollbackEvent };

export function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Merge an incoming message into local chat state without dropping optimistic user bubbles. */
export function mergeConversationMessage(
  prev: ConversationMessage[],
  msg: ConversationMessage,
): ConversationMessage[] {
  const existingIdx = prev.findIndex((m) => m.id === msg.id);
  if (existingIdx >= 0) {
    const next = [...prev];
    next[existingIdx] = { ...next[existingIdx], ...msg };
    return next;
  }

  if (msg.role === "user" && !msg.id.startsWith("temp-")) {
    const withoutMatchingTemp = prev.filter(
      (m) =>
        !(
          m.id.startsWith("temp-") &&
          m.role === "user" &&
          m.content === msg.content
        ),
    );
    return [...withoutMatchingTemp, msg];
  }

  return [...prev, msg];
}

/** Finalize a streaming agent bubble into a persisted message, preserving ReAct steps. */
export function finalizeStreamingAgentMessage(
  streamMessages: ConversationMessage[],
  msg: {
    id: string;
    role: string;
    content: string;
    agentId?: string | null;
    agentName?: string | null;
    createdAt?: string;
    reactSteps?: ReactStep[] | null;
    stepCount?: number | null;
  },
  options?: { messageType?: ConversationMessage["messageType"] },
): { messages: ConversationMessage[]; finalized: ConversationMessage } {
  const streaming =
    msg.agentId != null
      ? streamMessages.find((m) => m.agentId === msg.agentId && m.status === "streaming")
      : undefined;
  const reactSteps = normalizeReactSteps(msg.reactSteps ?? streaming?.reactSteps);
  const finalized: ConversationMessage = {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    agentId: msg.agentId,
    agentName: msg.agentName,
    status: "complete",
    messageType: options?.messageType ?? "chat",
    reactSteps,
    stepCount: msg.stepCount ?? streaming?.stepCount ?? reactSteps.length,
    createdAt: msg.createdAt ?? new Date().toISOString(),
  };
  const without = streamMessages.filter(
    (m) => !(msg.agentId && m.agentId === msg.agentId && m.status === "streaming"),
  );
  return { messages: [...without, finalized], finalized };
}

function sortByCreatedAt(messages: ConversationMessage[]): ConversationMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Dual-write dedup: same role+content within a short window (not repeated user input). */
const DUAL_WRITE_DEDUP_MS = 5000;

function isNearDuplicateOfBase(
  candidate: ConversationMessage,
  base: ConversationMessage[],
): boolean {
  const candidateTime = new Date(candidate.createdAt).getTime();
  return base.some((existing) => {
    if (existing.role !== candidate.role || existing.content !== candidate.content) {
      return false;
    }
    return Math.abs(new Date(existing.createdAt).getTime() - candidateTime) < DUAL_WRITE_DEDUP_MS;
  });
}

/** Normalize project-level messages for chat display (refinement replies use Alex). */
export function normalizeProjectMessages(
  messages: Array<{ id: string; role: string; content: string; createdAt: string }>,
): ConversationMessage[] {
  return messages.map((m) => ({
    ...m,
    status: "complete" as const,
    ...(m.role === "assistant"
      ? {
          agentId: "alex",
          agentName: "Alex",
          messageType: "chat" as const,
        }
      : {}),
  }));
}

/**
 * Merge conversation timeline with project-level refinement messages.
 * Base (ConversationMessage) is authoritative when present; project messages
 * fill gaps from legacy dual-write or missing conversation sync.
 */
export function mergeProjectChatMessages(
  base: ConversationMessage[],
  projectMessages: ConversationMessage[],
): ConversationMessage[] {
  if (projectMessages.length === 0) return base;
  if (base.length === 0) return sortByCreatedAt(projectMessages);

  const baseIds = new Set(base.map((m) => m.id));
  const latestBaseTime = Math.max(
    ...base.map((m) => new Date(m.createdAt).getTime()),
  );

  const extras = projectMessages.filter(
    (m) =>
      !baseIds.has(m.id) &&
      !isNearDuplicateOfBase(m, base) &&
      new Date(m.createdAt).getTime() >= latestBaseTime,
  );

  if (extras.length === 0) return base;
  return sortByCreatedAt([...base, ...extras]);
}

function agentIdFromGateEventId(id: string, kind: "handoff" | "rollback"): string | undefined {
  const prefix = `${kind}-`;
  if (!id.startsWith(prefix)) return undefined;
  const rest = id.slice(prefix.length);
  const agentId = rest.split("-")[0];
  return agentId || undefined;
}

const PIPELINE_AGENT_IDS = ["mike", "emma", "designer", "bob", "alex"] as const;

const MENTION_DISPLAY_NAME_TO_ID: Record<string, string> = {
  Mike: "mike",
  Emma: "emma",
  Luna: "designer",
  Bob: "bob",
  Alex: "alex",
};

type HandoffAgentLookup = { id: string; name: string; nameZh?: string };

function lookupAgentId(
  token: string,
  agents?: HandoffAgentLookup[],
): string | undefined {
  const trimmed = token.trim();
  if (!trimmed) return undefined;

  const fromAgents = agents?.find(
    (agent) =>
      agent.id === trimmed ||
      agent.id === trimmed.toLowerCase() ||
      agent.name === trimmed ||
      agent.nameZh === trimmed,
  );
  if (fromAgents) return fromAgents.id;

  return MENTION_DISPLAY_NAME_TO_ID[trimmed] ?? trimmed.toLowerCase();
}

function parseHandoffMentionAgentId(
  message: string | undefined,
  agents?: HandoffAgentLookup[],
): string | undefined {
  if (!message) return undefined;
  const match = message.match(/[@＠]([^\s@＠]+)/);
  if (!match) return undefined;
  return lookupAgentId(match[1], agents);
}

/** Resolve handoff endpoints when persisted metadata is incomplete. */
export function resolveHandoffAgentIds(
  handoff: Pick<HandoffEvent, "id" | "from" | "to" | "message">,
  agents?: HandoffAgentLookup[],
): { from: string; to: string } {
  let from = handoff.from.trim();
  let to = handoff.to.trim();

  if (!from) {
    from = agentIdFromGateEventId(handoff.id, "handoff") ?? "";
  }

  if (!to) {
    to = parseHandoffMentionAgentId(handoff.message, agents) ?? "";
  }

  if (!to && from) {
    const fromIndex = PIPELINE_AGENT_IDS.indexOf(from as (typeof PIPELINE_AGENT_IDS)[number]);
    if (fromIndex >= 0 && fromIndex < PIPELINE_AGENT_IDS.length - 1) {
      to = PIPELINE_AGENT_IDS[fromIndex + 1];
    }
  }

  return { from, to };
}

export function normalizeHandoffEvent(
  handoff: HandoffEvent,
  agents?: HandoffAgentLookup[],
): HandoffEvent {
  const { from, to } = resolveHandoffAgentIds(handoff, agents);
  if (from === handoff.from && to === handoff.to) return handoff;
  return { ...handoff, from, to };
}

export function isHandoffAnnotationMessage(message: ConversationMessage): boolean {
  return message.messageType === "handoff" || message.id.startsWith("handoff-");
}

export function isRollbackAnnotationMessage(message: ConversationMessage): boolean {
  return (
    (message.messageType === "system" && message.metadata?.eventKind === "rollback") ||
    message.id.startsWith("rollback-")
  );
}

/** Split persisted chat rows from handoff/rollback timeline annotations. */
export function partitionTimelineMessages(messages: ConversationMessage[]): {
  messages: ConversationMessage[];
  handoffs: HandoffEvent[];
  rollbacks: RollbackEvent[];
} {
  const chatMessages: ConversationMessage[] = [];
  const handoffs: HandoffEvent[] = [];
  const rollbacks: RollbackEvent[] = [];

  for (const message of messages) {
    if (isHandoffAnnotationMessage(message)) {
      const meta = message.metadata ?? {};
      handoffs.push(
        normalizeHandoffEvent({
          id: message.id,
          from: String(meta.from ?? agentIdFromGateEventId(message.id, "handoff") ?? ""),
          to: String(meta.to ?? ""),
          message: message.content,
          createdAt: message.createdAt,
          insertAfterMessageId:
            typeof meta.insertAfterMessageId === "string"
              ? meta.insertAfterMessageId
              : undefined,
        }),
      );
      continue;
    }

    if (isRollbackAnnotationMessage(message)) {
      const meta = message.metadata ?? {};
      rollbacks.push({
        id: message.id,
        agentId: String(
          meta.agentId ?? message.agentId ?? agentIdFromGateEventId(message.id, "rollback") ?? "",
        ),
        agentName: String(meta.agentName ?? message.agentName ?? ""),
        roleZh: typeof meta.roleZh === "string" ? meta.roleZh : undefined,
        message: message.content,
        createdAt: message.createdAt,
        insertAfterMessageId:
          typeof meta.insertAfterMessageId === "string"
            ? meta.insertAfterMessageId
            : undefined,
      });
      continue;
    }

    chatMessages.push(message);
  }

  return { messages: chatMessages, handoffs, rollbacks };
}

export function dedupeTimelineEvents<T extends { id: string }>(events: T[]): T[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function resolveAnnotationPosition(
  annotation: { kind: "handoff"; data: HandoffEvent } | { kind: "rollback"; data: RollbackEvent },
  messageEntries: Array<{ at: number; item: ChatTimelineItem }>,
  anchorSlot: Map<string, number>,
  annotationIndex: number,
): number {
  const data = annotation.data;
  const at = new Date(data.createdAt).getTime();

  if (data.insertAfterMessageId) {
    const anchor = messageEntries.find(
      (entry) =>
        entry.item.type === "message" &&
        entry.item.message.id === data.insertAfterMessageId,
    );
    if (anchor) {
      const slot = anchorSlot.get(data.insertAfterMessageId) ?? 0;
      anchorSlot.set(data.insertAfterMessageId, slot + 1);
      return anchor.at + 1 + slot * 0.001;
    }
  }

  const agentId =
    annotation.kind === "handoff"
      ? annotation.data.from
      : annotation.data.agentId;
  if (agentId) {
    const candidates = messageEntries.filter(
      (entry) =>
        entry.item.type === "message" && entry.item.message.agentId === agentId,
    );
    const before = candidates.filter((entry) => entry.at <= at);
    const last = before[before.length - 1];
    if (last) {
      const slotKey = `${agentId}:${last.item.type === "message" ? last.item.message.id : ""}:${annotationIndex}`;
      const slot = anchorSlot.get(slotKey) ?? 0;
      anchorSlot.set(slotKey, slot + 1);
      return last.at + 1 + slot * 0.001;
    }
  }

  return at;
}

export function buildTimeline(
  messages: ConversationMessage[],
  handoffs: HandoffEvent[] = [],
  rollbacks: RollbackEvent[] = [],
): ChatTimelineItem[] {
  type TimedEntry = { at: number; order: number; item: ChatTimelineItem };

  const chatMessages = messages.filter(
    (message) =>
      !isHandoffAnnotationMessage(message) && !isRollbackAnnotationMessage(message),
  );
  const uniqueHandoffs = dedupeTimelineEvents(handoffs);
  const uniqueRollbacks = dedupeTimelineEvents(rollbacks);

  const entries: TimedEntry[] = chatMessages.map((message, idx) => ({
    at: new Date(message.createdAt).getTime(),
    order: idx,
    item: { type: "message", message },
  }));

  type TimelineAnnotation =
    | { kind: "handoff"; data: HandoffEvent }
    | { kind: "rollback"; data: RollbackEvent };

  const annotations: TimelineAnnotation[] = [
    ...uniqueHandoffs.map((handoff) => ({ kind: "handoff" as const, data: handoff })),
    ...uniqueRollbacks.map((rollback) => ({ kind: "rollback" as const, data: rollback })),
  ].sort(
    (a, b) =>
      new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime(),
  );

  const anchorSlot = new Map<string, number>();

  for (const [idx, annotation] of annotations.entries()) {
    const at = resolveAnnotationPosition(annotation, entries, anchorSlot, idx);
    const item: ChatTimelineItem =
      annotation.kind === "handoff"
        ? { type: "handoff", handoff: annotation.data }
        : { type: "rollback", rollback: annotation.data };
    entries.push({ at, order: 10_000 + idx, item });
  }

  entries.sort((a, b) => a.at - b.at || a.order - b.order);
  return entries.map((entry) => entry.item);
}

export function timelineItemKey(item: ChatTimelineItem): string {
  if (item.type === "handoff") return `handoff:${item.handoff.id}`;
  if (item.type === "rollback") return `rollback:${item.rollback.id}`;
  return `message:${item.message.id}`;
}
