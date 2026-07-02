"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientFetch } from "@/lib/client-api";
import type { ReactPhase } from "@/lib/conversation-types";

export type ReactEvent = {
  id: string;
  phase: ReactPhase;
  agentId?: string;
  stepId?: string;
  content: string;
  timestamp: number;
};

export type StreamMessage = {
  id: string;
  role: string;
  content: string;
  agentId?: string;
  agentName?: string;
  streaming?: boolean;
  createdAt?: string;
  reactSteps?: Array<{ phase: ReactPhase; content: string; timestamp?: string }>;
  stepCount?: number;
};

export type RunStatusEvent = {
  runId: string;
  agentId?: string;
  stepId?: string;
  status: string;
};

export type AgentStartEvent = {
  agentId: string;
  agentName: string;
  roleZh?: string;
  messageType?: string;
};

export type AgentCompleteEvent = {
  id?: string;
  agentId: string;
  agentName?: string;
  roleZh?: string;
  stepCount?: number;
  fullContent?: string;
  content?: string;
  reactSteps?: Array<{ phase: ReactPhase; content: string; timestamp?: string }>;
  messageType?: string;
  status?: string;
  createdAt?: string;
};

export type HandoffStreamEvent = {
  id?: string;
  from: string;
  to: string;
  message?: string;
  createdAt?: string;
  insertAfterMessageId?: string;
};

export type StageOutputStreamEvent = {
  agentId: string;
  agentName: string;
  roleZh?: string;
  fullContent: string;
  reactSteps?: Array<{ phase: ReactPhase; content: string; timestamp?: string }>;
  stepCount?: number;
  messageType?: string;
  messageId?: string;
};

export type GatePromptStreamEvent = {
  agentId: string;
  agentName: string;
  roleZh?: string;
  previousAgentId?: string | null;
  previousAgentName?: string | null;
  nextAgentId?: string | null;
  nextAgentName?: string | null;
  canRollback?: boolean;
  isFinal?: boolean;
};

export type GateRollbackStreamEvent = {
  id?: string;
  agentId: string;
  agentName: string;
  roleZh?: string;
  message?: string;
  createdAt?: string;
  insertAfterMessageId?: string;
};

type UseProjectStreamOptions = {
  onAgentStart?: (event: AgentStartEvent) => void;
  onReactEvent?: (event: ReactEvent) => void;
  onRunStatus?: (event: RunStatusEvent) => void;
  onStepComplete?: (data: { stepId?: string; agentId?: string; artifactType?: string }) => void;
  onMessageChunk?: (chunk: string, meta: { agentId?: string; role?: string }) => void;
  onAgentComplete?: (event: AgentCompleteEvent) => void;
  onStageOutput?: (event: StageOutputStreamEvent) => void;
  onHandoff?: (event: HandoffStreamEvent) => void;
  onGatePrompt?: (event: GatePromptStreamEvent) => void;
  onGateRollback?: (event: GateRollbackStreamEvent) => void;
  onMessageComplete?: (message: StreamMessage) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data = line.slice(5).trim();
  }
  if (!data && event === "message") return null;
  return { event, data };
}

function streamErrorMessage(status: number): string {
  if (status === 401) return "登录已过期，请重新登录";
  if (status === 404) return "项目不存在或无权访问";
  return `流式连接失败 (${status})`;
}

/** @returns true when an SSE error event was dispatched */
function dispatchSseEvent(
  event: string,
  data: string,
  opts: UseProjectStreamOptions,
): boolean {
  let payload: Record<string, unknown> = {};
  try {
    payload = data ? JSON.parse(data) : {};
  } catch {
    payload = { content: data };
  }

  if (event === "agent_start") {
    opts.onAgentStart?.(payload as unknown as AgentStartEvent);
  } else if (event === "react_step") {
    const phase = payload.phase as ReactPhase;
    opts.onReactEvent?.({
      id: `${phase}-${Date.now()}-${Math.random()}`,
      phase,
      agentId: payload.agentId as string | undefined,
      stepId: payload.stepId as string | undefined,
      content: (payload.content as string) ?? "",
      timestamp: Date.now(),
    });
  } else if (event === "thought" || event === "action" || event === "observation") {
    opts.onReactEvent?.({
      id: `${event}-${Date.now()}-${Math.random()}`,
      phase: event as ReactPhase,
      agentId: payload.agentId as string | undefined,
      stepId: payload.stepId as string | undefined,
      content: (payload.content as string) ?? "",
      timestamp: Date.now(),
    });
  } else if (event === "run_status") {
    opts.onRunStatus?.(payload as unknown as RunStatusEvent);
  } else if (event === "step_complete") {
    opts.onStepComplete?.(
      payload as { stepId?: string; agentId?: string; artifactType?: string },
    );
  } else if (event === "message" || event === "message_delta") {
    const chunk = (payload.content as string) ?? (payload.delta as string) ?? "";
    opts.onMessageChunk?.(chunk, {
      agentId: payload.agentId as string | undefined,
      role: payload.role as string | undefined,
    });
  } else if (event === "agent_complete") {
    opts.onAgentComplete?.(payload as unknown as AgentCompleteEvent);
  } else if (event === "stage_output") {
    opts.onStageOutput?.(payload as unknown as StageOutputStreamEvent);
  } else if (event === "handoff") {
    opts.onHandoff?.(payload as unknown as HandoffStreamEvent);
  } else if (event === "gate_prompt") {
    opts.onGatePrompt?.(payload as unknown as GatePromptStreamEvent);
  } else if (event === "gate_rollback") {
    opts.onGateRollback?.(payload as unknown as GateRollbackStreamEvent);
  } else if (event === "message_complete") {
    opts.onMessageComplete?.({
      id: (payload.id as string) ?? `msg-${Date.now()}`,
      role: (payload.role as string) ?? "assistant",
      content: (payload.content as string) ?? "",
      agentId: payload.agentId as string | undefined,
      agentName: payload.agentName as string | undefined,
      createdAt: payload.createdAt as string | undefined,
      reactSteps: payload.reactSteps as StreamMessage["reactSteps"],
      stepCount: payload.stepCount as number | undefined,
    });
  } else if (event === "error") {
    opts.onError?.((payload.message as string) ?? "未知错误");
    return true;
  } else if (event === "done") {
    opts.onDone?.();
  }
  return false;
}

function processSseBuffer(
  buffer: string,
  opts: UseProjectStreamOptions,
): { remainder: string; sawError: boolean } {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  let sawError = false;
  for (const part of parts) {
    if (!part.trim()) continue;
    const parsed = parseSseBlock(part);
    if (!parsed) continue;
    if (dispatchSseEvent(parsed.event, parsed.data, opts)) {
      sawError = true;
    }
  }
  return { remainder, sawError };
}

export function useProjectStream(projectId: string, options: UseProjectStreamOptions = {}) {
  const [generationStreaming, setGenerationStreaming] = useState(false);
  const [chatStreaming, setChatStreaming] = useState(false);
  const generationAbortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const optsRef = useRef(options);

  useEffect(() => {
    optsRef.current = options;
  }, [options]);

  const consumeStream = useCallback(async (response: Response): Promise<boolean> => {
    const reader = response.body?.getReader();
    if (!reader) {
      optsRef.current.onError?.("无法读取流式响应");
      return false;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let sawError = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const result = processSseBuffer(buffer, optsRef.current);
        buffer = result.remainder;
        if (result.sawError) sawError = true;
      }

      if (buffer.trim()) {
        const result = processSseBuffer(`${buffer}\n\n`, optsRef.current);
        if (result.sawError) sawError = true;
      }
      return !sawError;
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        optsRef.current.onError?.("流式连接中断");
      }
      return false;
    }
  }, []);

  const connectGenerationStream = useCallback(async (): Promise<boolean> => {
    generationAbortRef.current?.abort();
    const controller = new AbortController();
    generationAbortRef.current = controller;
    setGenerationStreaming(true);
    try {
      const res = await clientFetch(`/api/projects/${projectId}/generate/stream`, {
        method: "POST",
        signal: controller.signal,
      });
      if (!res.ok) {
        optsRef.current.onError?.(streamErrorMessage(res.status));
        return false;
      }
      return await consumeStream(res);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        optsRef.current.onError?.("SSE 连接失败");
      }
      return false;
    } finally {
      setGenerationStreaming(false);
    }
  }, [projectId, consumeStream]);

  const sendChatStream = useCallback(
    async (message: string): Promise<boolean> => {
      chatAbortRef.current?.abort();
      const controller = new AbortController();
      chatAbortRef.current = controller;
      setChatStreaming(true);
      try {
        const res = await clientFetch(`/api/projects/${projectId}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });
        if (!res.ok) {
          optsRef.current.onError?.(streamErrorMessage(res.status));
          return false;
        }
        return await consumeStream(res);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          optsRef.current.onError?.("聊天流式连接失败");
        }
        return false;
      } finally {
        setChatStreaming(false);
      }
    },
    [projectId, consumeStream],
  );

  const disconnectGeneration = useCallback(() => {
    generationAbortRef.current?.abort();
    setGenerationStreaming(false);
  }, []);

  const disconnect = useCallback(() => {
    generationAbortRef.current?.abort();
    chatAbortRef.current?.abort();
    setGenerationStreaming(false);
    setChatStreaming(false);
  }, []);

  const submitGateDecision = useCallback(
    async (decision: "proceed" | "rollback"): Promise<boolean> => {
      try {
        const res = await clientFetch(`/api/projects/${projectId}/generate/gate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { detail?: string } | null;
          optsRef.current.onError?.(err?.detail ?? "阶段决策提交失败");
          return false;
        }
        return true;
      } catch {
        optsRef.current.onError?.("阶段决策提交失败");
        return false;
      }
    },
    [projectId],
  );

  return {
    streaming: generationStreaming || chatStreaming,
    generationStreaming,
    chatStreaming,
    connectGenerationStream,
    sendChatStream,
    submitGateDecision,
    disconnectGeneration,
    disconnect,
  };
}

export type { HandoffStreamEvent as HandoffEvent, GatePromptStreamEvent as GatePromptEvent, GateRollbackStreamEvent as GateRollbackEvent, StageOutputStreamEvent as StageOutputEvent };
