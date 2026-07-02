"use client";

import { useAgentTeam } from "@/components/AppConfigProvider";
import { AgentAvatar } from "./AgentAvatarRow";
import { resolveHandoffAgentIds, type HandoffEvent } from "@/lib/conversation-types";

type HandoffBadgeProps = {
  handoff: HandoffEvent;
};

export function HandoffBadge({ handoff }: HandoffBadgeProps) {
  const agentTeam = useAgentTeam();
  const { from, to } = resolveHandoffAgentIds(handoff, agentTeam);
  const toAgent = agentTeam.find((a) => a.id === to);
  const fromAgent = agentTeam.find((a) => a.id === from);

  return (
    <div className="flex items-center justify-between gap-3 py-2 my-1 w-full min-w-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200 shrink-0">
          Submitted
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
          OK
        </span>
        {handoff.message && (
          <span className="text-xs text-zinc-400 truncate min-w-0">{handoff.message}</span>
        )}
      </div>
      {toAgent && (
        <div className="flex items-center gap-1.5 shrink-0">
          <AgentAvatar agentId={toAgent.id} size="sm" />
          <span className="text-xs text-zinc-500 whitespace-nowrap">
            {toAgent.name}
            {fromAgent ? ` ← ${fromAgent.name}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
