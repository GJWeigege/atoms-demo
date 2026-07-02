"use client";

import { useAgentTeam } from "@/components/AppConfigProvider";
import type { AgentConfig } from "@/lib/config/types";

type AgentSelectorProps = {
  open: boolean;
  filter?: string;
  onSelect: (agent: AgentConfig) => void;
  onClose: () => void;
  position?: { top: number; left: number };
};

export function AgentSelector({
  open,
  filter = "",
  onSelect,
  onClose,
  position,
}: AgentSelectorProps) {
  const agentTeam = useAgentTeam();

  if (!open) return null;

  const lowerFilter = filter.toLowerCase();
  const filtered = agentTeam.filter(
    (a) =>
      !lowerFilter ||
      a.name.toLowerCase().includes(lowerFilter) ||
      a.roleZh.includes(filter),
  );

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute z-50 w-64 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden"
        style={position ? { top: position.top, left: position.left } : { bottom: "100%", left: 0, marginBottom: 8 }}
      >
        <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50">
          <p className="text-xs font-semibold text-zinc-500">组成员</p>
        </div>
        <ul className="max-h-56 overflow-y-auto py-1">
          {filtered.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(agent);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 text-left transition-colors"
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
                  style={{ backgroundColor: agent.bgColor }}
                >
                  {agent.emoji}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800">{agent.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{agent.roleZh}</p>
                </div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-sm text-zinc-400 text-center">无匹配成员</li>
          )}
        </ul>
      </div>
    </>
  );
}
