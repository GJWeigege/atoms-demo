"use client";

import type { RefObject } from "react";
import { Fragment } from "react";
import { AgentMessageBubble } from "./AgentMessageBubble";
import { HandoffBadge } from "./HandoffBadge";
import { RollbackBadge } from "./RollbackBadge";
import type { ChatTimelineItem, ConversationMessage, HandoffEvent, RollbackEvent } from "@/lib/conversation-types";
import { buildTimeline, timelineItemKey } from "@/lib/conversation-types";

export type ChatMessageItem = ConversationMessage;

type ChatMessageListProps = {
  messages: ChatMessageItem[];
  handoffs?: HandoffEvent[];
  rollbacks?: RollbackEvent[];
  sending?: boolean;
  onBuild?: () => void;
  building?: boolean;
  variant?: "light" | "dark";
  emptyTitle?: string;
  emptyDescription?: string;
  bottomRef?: RefObject<HTMLDivElement | null>;
  collapsedMessageIds?: ReadonlySet<string>;
  onToggleMessageBody?: (messageId: string) => void;
};

function renderTimelineItem(
  item: ChatTimelineItem,
  props: Pick<
    ChatMessageListProps,
    "onBuild" | "building" | "variant" | "collapsedMessageIds" | "onToggleMessageBody"
  >,
) {
  if (item.type === "handoff") {
    return <HandoffBadge handoff={item.handoff} />;
  }

  if (item.type === "rollback") {
    return <RollbackBadge rollback={item.rollback} />;
  }

  const msg = item.message;
  if (msg.role === "user") {
    const isDark = props.variant === "dark";
    return (
      <div className="flex justify-end">
        <div
          className={`max-w-[75%] rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isDark ? "bg-indigo-600 text-white" : "bg-indigo-600 text-white"
          }`}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.agentId || msg.agentName) {
    const bodyCollapsed = props.collapsedMessageIds?.has(msg.id) ?? false;
    return (
      <AgentMessageBubble
        message={msg}
        variant={props.variant}
        onBuild={props.onBuild}
        building={props.building}
        bodyCollapsed={bodyCollapsed}
        onToggleBody={
          props.onToggleMessageBody ? () => props.onToggleMessageBody?.(msg.id) : undefined
        }
      />
    );
  }

  const isDark = props.variant === "dark";
  return (
    <div key={msg.id} className="flex gap-3 max-w-[85%]">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          isDark ? "bg-zinc-800" : "bg-zinc-100"
        }`}
      >
        🤖
      </div>
      <div
        className={`rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isDark
            ? "bg-zinc-800/90 border border-zinc-700/60 text-zinc-200"
            : "bg-zinc-50 border border-zinc-100 text-zinc-700"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

export function ChatMessageList({
  messages,
  handoffs = [],
  rollbacks = [],
  sending,
  onBuild,
  building = false,
  variant = "light",
  emptyTitle = "想创造什么？",
  emptyDescription = "描述你的想法，@ 团队成员深入讨论，或点击「构建」让智能体团队为你生成应用。",
  bottomRef,
  collapsedMessageIds,
  onToggleMessageBody,
}: ChatMessageListProps) {
  const isDark = variant === "dark";
  const timeline = buildTimeline(messages, handoffs, rollbacks);

  if (messages.length === 0 && !sending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
        <h2 className={`text-3xl font-bold mb-3 ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
          {emptyTitle}
        </h2>
        <p className={`max-w-md leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 space-y-5 min-h-0">
      {timeline.map((item) => (
        <Fragment key={timelineItemKey(item)}>
          {renderTimelineItem(item, {
            onBuild,
            building,
            variant,
            collapsedMessageIds,
            onToggleMessageBody,
          })}
        </Fragment>
      ))}

      {sending && (
        <div className="flex gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 animate-pulse ${
              isDark ? "bg-indigo-900/40" : "bg-indigo-50"
            }`}
          >
            🎯
          </div>
          <div
            className={`rounded-2xl px-4 py-3 border ${
              isDark ? "bg-zinc-800/90 border-zinc-700/60" : "bg-zinc-50 border-zinc-100"
            }`}
          >
            <div className="flex gap-1">
              <span
                className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-zinc-500" : "bg-zinc-300"}`}
                style={{ animationDelay: "0ms" }}
              />
              <span
                className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-zinc-500" : "bg-zinc-300"}`}
                style={{ animationDelay: "150ms" }}
              />
              <span
                className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-zinc-500" : "bg-zinc-300"}`}
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      )}
      {bottomRef && <div ref={bottomRef} />}
    </div>
  );
}
