"use client";

import { useAgentTeam } from "@/components/AppConfigProvider";
import type { AgentConfig } from "@/lib/config/types";

type AgentAvatarRowProps = {
  selectedAgentId?: string | null;
  onSelectAgent?: (agent: AgentConfig) => void;
};

export function AgentAvatarRow({
  selectedAgentId,
  onSelectAgent,
  compact = false,
}: AgentAvatarRowProps & { compact?: boolean }) {
  const agentTeam = useAgentTeam();

  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 scrollbar-thin">
        {agentTeam.map((agent) => {
          const selected = selectedAgentId === agent.id;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelectAgent?.(agent)}
              title={`${agent.name} — ${agent.roleZh}`}
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base border-2 transition-all ${
                selected
                  ? "border-indigo-500 ring-2 ring-indigo-100 scale-105"
                  : "border-white hover:border-zinc-200"
              }`}
              style={{ backgroundColor: agent.bgColor }}
            >
              {agent.emoji}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-end justify-start sm:justify-center gap-3 sm:gap-4 overflow-x-auto py-2 px-2 max-w-full scrollbar-thin">
      {agentTeam.map((agent) => {
        const selected = selectedAgentId === agent.id;
        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => onSelectAgent?.(agent)}
            title={`${agent.name} — ${agent.roleZh}`}
            className={`group shrink-0 flex flex-col items-center gap-1.5 transition-all duration-200 focus-ring rounded-xl p-1 ${
              selected ? "scale-105 -translate-y-0.5" : "hover:-translate-y-0.5"
            }`}
          >
            <div className="relative">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-md border-[3px] transition-all duration-200 ${
                  selected
                    ? "border-indigo-500 ring-4 ring-indigo-100"
                    : "border-white group-hover:border-zinc-200 group-hover:shadow-lg"
                }`}
                style={{ backgroundColor: agent.bgColor }}
              >
                {agent.emoji}
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
                style={{ backgroundColor: agent.color }}
              />
            </div>
            <div className="text-center">
              <span
                className={`block text-xs font-medium transition-colors ${
                  selected ? "text-indigo-600" : "text-zinc-600 group-hover:text-zinc-800"
                }`}
              >
                {agent.name}
              </span>
              <span className="block text-[10px] text-zinc-400 leading-tight max-w-[72px] truncate">
                {agent.roleZh}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function AgentAvatar({
  agentId,
  size = "md",
}: {
  agentId: string;
  size?: "sm" | "md";
}) {
  const agentTeam = useAgentTeam();
  const agent = agentTeam.find((a) => a.id === agentId);
  if (!agent) return null;

  const sizeClass = size === "sm" ? "w-7 h-7 text-sm" : "w-9 h-9 text-base";

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm`}
      style={{ backgroundColor: agent.bgColor }}
      title={`${agent.name} — ${agent.roleZh}`}
    >
      {agent.emoji}
    </div>
  );
}
