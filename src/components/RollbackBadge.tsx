"use client";

import { useAgentTeam } from "@/components/AppConfigProvider";
import { AgentAvatar } from "./AgentAvatarRow";
import type { RollbackEvent } from "@/lib/conversation-types";

type RollbackBadgeProps = {
  rollback: RollbackEvent;
};

export function RollbackBadge({ rollback }: RollbackBadgeProps) {
  const agentTeam = useAgentTeam();
  const agent = agentTeam.find((a) => a.id === rollback.agentId);

  return (
    <div className="flex items-center justify-center gap-3 py-2 my-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        回退
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
        重新执行
      </span>
      {rollback.message && (
        <span className="text-xs text-amber-700/90 truncate max-w-[280px]">{rollback.message}</span>
      )}
      {agent && (
        <div className="flex items-center gap-1.5 shrink-0">
          <AgentAvatar agentId={agent.id} size="sm" />
          <span className="text-xs text-amber-800/80">
            {agent.name}
            {rollback.roleZh ? ` · ${rollback.roleZh}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
