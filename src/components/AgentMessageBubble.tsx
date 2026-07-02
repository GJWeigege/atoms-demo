"use client";

import { useAgentTeam } from "@/components/AppConfigProvider";
import { AgentAvatar } from "./AgentAvatarRow";
import { MarkdownContent } from "./MarkdownContent";
import { CollapsibleReactSteps } from "./CollapsibleReactSteps";
import type { ConversationMessage } from "@/lib/conversation-types";
import { formatMessageTime, normalizeReactSteps } from "@/lib/conversation-types";
import { getAgentOutputPreview } from "@/lib/message-preview";

type AgentMessageBubbleProps = {
  message: ConversationMessage;
  variant?: "light" | "dark";
  onBuild?: () => void;
  building?: boolean;
  bodyCollapsed?: boolean;
  onToggleBody?: () => void;
};

function suggestsBuildAction(content: string): boolean {
  return /点击[^「]*「(?:开始)?构建」/.test(content);
}

export function AgentMessageBubble({
  message,
  variant = "light",
  onBuild,
  building = false,
  bodyCollapsed = false,
  onToggleBody,
}: AgentMessageBubbleProps) {
  const agentTeam = useAgentTeam();
  const agent =
    agentTeam.find((a) => a.id === message.agentId) ??
    agentTeam.find((a) => a.name === message.agentName);

  const isDark = variant === "dark";
  const isStreaming = message.status === "streaming";
  const steps = normalizeReactSteps(message.reactSteps);
  const stepCount = message.stepCount ?? steps.length;
  const hasDeliverable = message.content.trim().length > 0;
  const reactStepsDefaultOpen = isStreaming && !hasDeliverable;
  const canCollapseBody = Boolean(onToggleBody && hasDeliverable);
  const outputPreview = hasDeliverable ? getAgentOutputPreview(message.content) : "";

  const bodyContent = (
    <>
      <MarkdownContent content={message.content} theme={variant} />
      {isStreaming && (
        <span className="inline-block w-1 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
      )}
      {onBuild && suggestsBuildAction(message.content) && (
        <div className={`mt-3 pt-3 border-t ${isDark ? "border-zinc-700" : "border-zinc-200/80"}`}>
          <button
            type="button"
            onClick={onBuild}
            disabled={building}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            {building ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                构建中…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                开始构建
              </>
            )}
          </button>
        </div>
      )}
    </>
  );

  const bodyShellClass = isDark
    ? "bg-zinc-800/90 border border-zinc-700/60"
    : "bg-zinc-50 border border-zinc-100";

  return (
    <div className="flex gap-3 max-w-[92%]">
      {message.agentId ? (
        <AgentAvatar agentId={message.agentId} />
      ) : (
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isDark ? "bg-zinc-800" : "bg-zinc-100"
          }`}
        >
          🤖
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-semibold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
            {message.agentName ?? agent?.name ?? "助手"}
          </span>
          {(agent?.roleZh || message.messageType === "completion") && (
            <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {agent?.roleZh ?? (message.messageType === "completion" ? "工程师" : "")}
            </span>
          )}
          <span className={`text-[10px] ml-auto ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            {formatMessageTime(message.createdAt)}
          </span>
        </div>

        {(steps.length > 0 || stepCount > 0 || isStreaming) && (
          <CollapsibleReactSteps
            steps={steps}
            stepCount={isStreaming ? Math.max(stepCount, steps.length) : stepCount}
            defaultOpen={reactStepsDefaultOpen}
            variant={variant}
          />
        )}

        {canCollapseBody && bodyCollapsed ? (
          <button
            type="button"
            onClick={onToggleBody}
            className={`w-full text-left rounded-2xl rounded-tl-md px-4 py-3 text-xs transition-colors ${bodyShellClass} ${
              isDark ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <span className="font-medium">▶ 查看产出物</span>
            {outputPreview ? (
              <span className={isDark ? "text-zinc-500" : "text-zinc-400"}> · {outputPreview}</span>
            ) : null}
          </button>
        ) : (
          <div>
            {canCollapseBody && (
              <button
                type="button"
                onClick={onToggleBody}
                className={`mb-1 text-[11px] transition-colors ${
                  isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                ▼ 收起产出物
              </button>
            )}
            <div className={`rounded-2xl rounded-tl-md px-4 py-3 ${bodyShellClass}`}>{bodyContent}</div>
          </div>
        )}
      </div>
    </div>
  );
}
