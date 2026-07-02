"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessageList } from "./ChatMessageList";
import { GateDecisionBar, type GatePromptEvent } from "./GateDecisionBar";
import {
  useProjectStream,
  type HandoffStreamEvent,
  type ReactEvent,
  type StreamMessage,
} from "@/hooks/useProjectStream";
import type { ConversationMessage, HandoffEvent, ReactStep, RollbackEvent } from "@/lib/conversation-types";
import {
  dedupeTimelineEvents,
  finalizeStreamingAgentMessage,
  normalizeReactSteps,
  partitionTimelineMessages,
} from "@/lib/conversation-types";
import { computeDefaultFoldedAgentMessages, isAgentDeliverableMessage } from "@/lib/message-fold";

type StreamingChatPanelProps = {
  projectId: string;
  messages: ConversationMessage[];
  onNewMessage: (message: ConversationMessage) => void;
  disabled?: boolean;
  isGenerating?: boolean;
  onRunStatus?: (event: { runId: string; agentId?: string; stepId?: string; status: string }) => void;
  onPipelineDone?: () => void;
  onPipelineError?: () => void;
  variant?: "light" | "dark";
};

function upsertAgentMessage(
  list: ConversationMessage[],
  agentId: string,
  patch: Partial<ConversationMessage>,
): ConversationMessage[] {
  const idx = list.findIndex((m) => m.agentId === agentId && m.status === "streaming");
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...patch };
    return next;
  }
  return [
    ...list,
    {
      id: `stream-${agentId}-${Date.now()}`,
      role: "assistant",
      agentId,
      content: "",
      reactSteps: [],
      status: "streaming",
      createdAt: new Date().toISOString(),
      ...patch,
    },
  ];
}

export function StreamingChatPanel({
  projectId,
  messages,
  onNewMessage,
  disabled,
  isGenerating,
  onRunStatus,
  onPipelineDone,
  onPipelineError,
  variant = "light",
}: StreamingChatPanelProps) {
  const [input, setInput] = useState("");
  const [streamMessages, setStreamMessages] = useState<ConversationMessage[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffEvent[]>([]);
  const [rollbacks, setRollbacks] = useState<RollbackEvent[]>([]);
  const [pendingGate, setPendingGate] = useState<GatePromptEvent | null>(null);
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [connectingGeneration, setConnectingGeneration] = useState(false);
  const [foldOverridesByProject, setFoldOverridesByProject] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamStarted = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadStreamErrorRef = useRef(false);
  const currentAgentRef = useRef<string | null>(null);

  const streamMessagesRef = useRef<ConversationMessage[]>([]);
  const messagesRef = useRef(messages);

  useEffect(() => {
    streamMessagesRef.current = streamMessages;
  }, [streamMessages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const partitionedMessages = useMemo(
    () => partitionTimelineMessages(messages),
    [messages],
  );

  const appendHandoff = useCallback((event: HandoffEvent) => {
    setHandoffs((prev) => {
      if (prev.some((item) => item.id === event.id)) return prev;
      return [...prev, event];
    });
  }, []);

  const appendRollback = useCallback((event: RollbackEvent) => {
    setRollbacks((prev) => {
      if (prev.some((item) => item.id === event.id)) return prev;
      return [...prev, event];
    });
  }, []);

  const updateStreamMessages = useCallback(
    (updater: (prev: ConversationMessage[]) => ConversationMessage[]) => {
      setStreamMessages((prev) => {
        const next = updater(prev);
        streamMessagesRef.current = next;
        return next;
      });
    },
    [],
  );

  const findLastCompleteMessage = useCallback((agentId: string) => {
    // Persisted messages first; streamMessages fills gaps during live generation.
    const merged = [...messagesRef.current, ...streamMessagesRef.current];
    const seen = new Set<string>();
    return [...merged].reverse().find((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return m.agentId === agentId && m.status === "complete";
    });
  }, []);

  const collapsePreviousAgentMessages = useCallback(
    (newAgentId: string) => {
      const merged = [...messagesRef.current, ...streamMessagesRef.current];
      setFoldOverridesByProject((prev) => {
        const current = prev[projectId] ?? {};
        const next = { ...current };
        for (const m of merged) {
          if (
            m.role === "assistant" &&
            m.agentId &&
            m.agentId !== newAgentId &&
            m.content.trim().length > 0
          ) {
            next[m.id] = true;
          }
        }
        return { ...prev, [projectId]: next };
      });
    },
    [projectId],
  );

  const commitFinalizedAgentMessage = useCallback(
    (
      msg: Parameters<typeof finalizeStreamingAgentMessage>[1],
      options?: Parameters<typeof finalizeStreamingAgentMessage>[2],
    ) => {
      const result = finalizeStreamingAgentMessage(streamMessagesRef.current, msg, options);
      streamMessagesRef.current = result.messages;
      setStreamMessages(result.messages);
      onNewMessage(result.finalized);
    },
    [onNewMessage],
  );

  const appendReactStep = useCallback((ev: ReactEvent) => {
    if (!ev.agentId) return;
    currentAgentRef.current = ev.agentId;
    const step: ReactStep = {
      phase: ev.phase,
      content: ev.content,
      timestamp: new Date(ev.timestamp).toISOString(),
    };
    setStreamMessages((prev) => {
      const updated = upsertAgentMessage(prev, ev.agentId!, {
        agentName: prev.find((m) => m.agentId === ev.agentId)?.agentName,
      });
      const next = updated.map((m) => {
        if (m.agentId !== ev.agentId || m.status !== "streaming") return m;
        const existing = normalizeReactSteps(m.reactSteps);
        if (existing.some((s) => s.phase === step.phase && s.content === step.content)) {
          return m;
        }
        return {
          ...m,
          reactSteps: [...existing, step],
          stepCount: existing.length + 1,
        };
      });
      streamMessagesRef.current = next;
      return next;
    });
  }, []);

  const { streaming, connectGenerationStream, sendChatStream, submitGateDecision, disconnectGeneration, disconnect } =
    useProjectStream(projectId, {
    onAgentStart: (data) => {
      currentAgentRef.current = data.agentId;
      collapsePreviousAgentMessages(data.agentId);
      updateStreamMessages((prev) =>
        upsertAgentMessage(prev, data.agentId, {
          agentName: data.agentName,
          messageType: data.messageType as ConversationMessage["messageType"],
          status: "streaming",
        }),
      );
    },
    onReactEvent: appendReactStep,
    onRunStatus: (event) => onRunStatus?.(event),
    onStepComplete: () => {
      window.dispatchEvent(new CustomEvent("app-updated"));
    },
    onMessageChunk: (chunk, meta) => {
      if (!meta.agentId) return;
      currentAgentRef.current = meta.agentId;
      updateStreamMessages((prev) =>
        upsertAgentMessage(prev, meta.agentId!, {}).map((m) =>
          m.agentId === meta.agentId && m.status === "streaming"
            ? { ...m, content: m.content + chunk }
            : m,
        ),
      );
    },
    onAgentComplete: (data) => {
      // Chat stream finalizes via message_complete (keeps streaming ReAct steps intact).
      if (data.messageType === "chat") {
        window.dispatchEvent(new CustomEvent("app-updated"));
        return;
      }

      commitFinalizedAgentMessage(
        {
          id: data.id ?? `stream-${data.agentId}-${Date.now()}`,
          role: "assistant",
          agentId: data.agentId,
          agentName: data.agentName,
          content: data.fullContent ?? data.content ?? "",
          reactSteps: normalizeReactSteps(data.reactSteps),
          stepCount: data.stepCount ?? normalizeReactSteps(data.reactSteps).length,
          createdAt: data.createdAt ?? new Date().toISOString(),
        },
        {
          messageType: (data.messageType as ConversationMessage["messageType"]) ?? "plan",
        },
      );
      window.dispatchEvent(new CustomEvent("app-updated"));
    },
    onStageOutput: (data) => {
      updateStreamMessages((prev) =>
        upsertAgentMessage(prev, data.agentId, {
          id: data.messageId ?? `stream-${data.agentId}-${Date.now()}`,
          agentName: data.agentName,
          messageType: (data.messageType as ConversationMessage["messageType"]) ?? "plan",
          content: data.fullContent,
          reactSteps: normalizeReactSteps(data.reactSteps),
          stepCount: data.stepCount ?? normalizeReactSteps(data.reactSteps).length,
          status: "streaming",
        }),
      );
    },
    onHandoff: (data: HandoffStreamEvent) => {
      setPendingGate(null);
      const anchorId =
        data.insertAfterMessageId ?? findLastCompleteMessage(data.from)?.id;
      appendHandoff({
        id: data.id ?? `handoff-${data.from}-${data.to}-${Date.now()}`,
        from: data.from,
        to: data.to,
        message: data.message,
        createdAt: data.createdAt ?? new Date().toISOString(),
        insertAfterMessageId: anchorId,
      });
    },
    onGatePrompt: (data) => {
      setPendingGate({
        agentId: data.agentId,
        agentName: data.agentName,
        roleZh: data.roleZh,
        previousAgentId: data.previousAgentId,
        previousAgentName: data.previousAgentName,
        nextAgentId: data.nextAgentId,
        nextAgentName: data.nextAgentName,
        canRollback: data.canRollback,
        isFinal: data.isFinal,
      });
    },
    onGateRollback: (data) => {
      setPendingGate(null);
      const anchorId =
        data.insertAfterMessageId ?? findLastCompleteMessage(data.agentId)?.id;
      appendRollback({
        id: data.id ?? `rollback-${data.agentId}-${Date.now()}`,
        agentId: data.agentId,
        agentName: data.agentName,
        roleZh: data.roleZh,
        message: data.message,
        createdAt: data.createdAt ?? new Date().toISOString(),
        insertAfterMessageId: anchorId,
      });
    },
    onMessageComplete: (msg: StreamMessage) => {
      if (msg.agentId) {
        commitFinalizedAgentMessage(msg, { messageType: "chat" });
      } else {
        onNewMessage({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt ?? new Date().toISOString(),
          status: "complete",
        });
      }
      window.dispatchEvent(new CustomEvent("app-updated"));
    },
    onDone: () => {
      currentAgentRef.current = null;
      retryCountRef.current = 0;
      setPendingGate(null);
      setGateSubmitting(false);
      if (hadStreamErrorRef.current) {
        hadStreamErrorRef.current = false;
        setHandoffs([]);
        setRollbacks([]);
        onPipelineError?.();
        return;
      }
      setStreamError(null);
      setStreamMessages([]);
      streamMessagesRef.current = [];
      onPipelineDone?.();
    },
    onError: (message) => {
      hadStreamErrorRef.current = true;
      setStreamError(message);
    },
  },
  );

  const displayMessages = useMemo(() => {
    const base = partitionedMessages.messages;
    const persistedIds = new Set(base.map((m) => m.id));
    const liveOnly = streamMessages.filter((m) => !persistedIds.has(m.id));
    const merged = [...base];
    for (const live of liveOnly) {
      const dupIdx = merged.findIndex(
        (m) => m.agentId === live.agentId && m.status === "streaming",
      );
      if (dupIdx >= 0 && live.status === "streaming") {
        merged[dupIdx] = live;
      } else if (!merged.some((m) => m.id === live.id)) {
        merged.push(live);
      }
    }
    return merged.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [partitionedMessages.messages, streamMessages]);

  const defaultFolded = useMemo(
    () => computeDefaultFoldedAgentMessages(displayMessages),
    [displayMessages],
  );

  const collapsedMessageIds = useMemo(() => {
    const foldOverrides = foldOverridesByProject[projectId] ?? {};
    const collapsed = new Set<string>();
    for (const message of displayMessages) {
      if (!isAgentDeliverableMessage(message)) continue;
      const folded = foldOverrides[message.id] ?? defaultFolded[message.id] ?? false;
      if (folded) collapsed.add(message.id);
    }
    return collapsed;
  }, [displayMessages, defaultFolded, foldOverridesByProject, projectId]);

  const handleToggleMessageBody = useCallback(
    (messageId: string) => {
      setFoldOverridesByProject((prev) => {
        const current = prev[projectId] ?? {};
        const currentlyFolded = current[messageId] ?? defaultFolded[messageId] ?? false;
        return {
          ...prev,
          [projectId]: { ...current, [messageId]: !currentlyFolded },
        };
      });
    },
    [defaultFolded, projectId],
  );

  const timelineHandoffs = useMemo(
    () => dedupeTimelineEvents([...partitionedMessages.handoffs, ...handoffs]),
    [partitionedMessages.handoffs, handoffs],
  );

  const timelineRollbacks = useMemo(
    () => dedupeTimelineEvents([...partitionedMessages.rollbacks, ...rollbacks]),
    [partitionedMessages.rollbacks, rollbacks],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, timelineHandoffs, timelineRollbacks]);

  useEffect(() => {
    if (!isGenerating) {
      streamStarted.current = false;
      return;
    }
    if (streamStarted.current) return;

    setHandoffs([]);
    setRollbacks([]);

    let cancelled = false;
    setConnectingGeneration(true);

    async function connectWithRetry() {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => {
            retryTimerRef.current = setTimeout(resolve, 1000 * attempt);
          });
        }
        if (cancelled || streamStarted.current) return;

        const ok = await connectGenerationStream();
        if (ok) {
          streamStarted.current = true;
          retryCountRef.current = 0;
          setStreamError(null);
          return;
        }
        streamStarted.current = false;
      }
    }

    void connectWithRetry().finally(() => {
      if (!cancelled) setConnectingGeneration(false);
    });

    return () => {
      cancelled = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      disconnectGeneration();
      setConnectingGeneration(false);
    };
  }, [isGenerating, connectGenerationStream, disconnectGeneration]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      disconnect();
    };
  }, [disconnect]);

  useEffect(() => {
    function onRefine(e: Event) {
      const prompt = (e as CustomEvent<string>).detail;
      if (prompt && !disabled && !streaming) {
        onNewMessage({
          id: `temp-${Date.now()}`,
          role: "user",
          content: prompt,
          createdAt: new Date().toISOString(),
        });
        sendChatStream(prompt);
      }
    }
    window.addEventListener("workspace-refine", onRefine);
    return () => window.removeEventListener("workspace-refine", onRefine);
  }, [disabled, streaming, sendChatStream, onNewMessage]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streamBusy || disabled || pendingGate) return;

    const userMessage = input.trim();
    setInput("");

    onNewMessage({
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      createdAt: new Date().toISOString(),
    });

    await sendChatStream(userMessage);
  }

  async function handleGateDecision(decision: "proceed" | "rollback") {
    if (!pendingGate || gateSubmitting) return;
    setGateSubmitting(true);
    const ok = await submitGateDecision(decision);
    if (ok) {
      setPendingGate(null);
    }
    setGateSubmitting(false);
  }

  const isDark = variant === "dark";
  const streamBusy = streaming || connectingGeneration || gateSubmitting;

  return (
    <div className="flex flex-col h-full min-h-0">
      {streamError && (
        <div
          className={`mx-3 mt-2 px-3 py-2 rounded-lg text-xs shrink-0 ${
            isDark
              ? "bg-red-500/10 border border-red-500/30 text-red-300"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {streamError}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <ChatMessageList
          messages={displayMessages}
          handoffs={timelineHandoffs}
          rollbacks={timelineRollbacks}
          variant={variant}
          emptyTitle="开始对话"
          emptyDescription="描述你想要的修改，智能体将帮你优化应用…"
          bottomRef={bottomRef}
          collapsedMessageIds={collapsedMessageIds}
          onToggleMessageBody={handleToggleMessageBody}
        />
      </div>

      {pendingGate && (
        <GateDecisionBar
          gate={pendingGate}
          submitting={gateSubmitting}
          variant={variant}
          onProceed={() => void handleGateDecision("proceed")}
          onRollback={() => void handleGateDecision("rollback")}
        />
      )}

      <form
        onSubmit={handleSend}
        className={`p-3 border-t shrink-0 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingGate
                ? "请先确认阶段决策…"
                : disabled
                  ? "等待生成完成..."
                  : "让智能体团队继续优化…"
            }
            disabled={disabled || streamBusy || !!pendingGate}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/80 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark
                ? "bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-500 hover:border-zinc-600"
                : "bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-400"
            }`}
          />
          <button
            type="submit"
            disabled={disabled || streamBusy || !input.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all shrink-0"
          >
            {streamBusy ? "处理中" : "发送"}
          </button>
        </div>
      </form>
    </div>
  );
}
