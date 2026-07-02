"use client";

export type GatePromptEvent = {
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

type GateDecisionBarProps = {
  gate: GatePromptEvent;
  submitting?: boolean;
  onProceed: () => void;
  onRollback: () => void;
  variant?: "light" | "dark";
};

export function GateDecisionBar({
  gate,
  submitting,
  onProceed,
  onRollback,
  variant = "light",
}: GateDecisionBarProps) {
  const isDark = variant === "dark";
  const roleSuffix = gate.roleZh ? `（${gate.roleZh}）` : "";
  const rollbackLabel = `回退并重新执行 ${gate.agentName}`;

  return (
    <div
      className={`mx-3 mb-3 rounded-xl border p-4 shrink-0 ${
        isDark
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <p
        className={`text-sm font-medium mb-1 ${
          isDark ? "text-amber-100" : "text-amber-900"
        }`}
      >
        {gate.agentName} 阶段已完成{roleSuffix}
      </p>
      <p className={`text-xs mb-3 ${isDark ? "text-amber-200/80" : "text-amber-800/80"}`}>
        {gate.isFinal
          ? `确认结果以完成整个流水线，或回退并重新执行 ${gate.agentName} 阶段。`
          : gate.nextAgentName
            ? `继续将进入 ${gate.nextAgentName} 阶段；回退将重新执行 ${gate.agentName} 阶段的所有步骤。`
            : "请选择继续或回退。"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={onProceed}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
        >
          {gate.isFinal ? "确认并完成" : gate.nextAgentName ? `继续 → ${gate.nextAgentName}` : "继续下一阶段"}
        </button>
        {gate.canRollback !== false && (
          <button
            type="button"
            disabled={submitting}
            onClick={onRollback}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border disabled:opacity-50 transition-colors ${
              isDark
                ? "border-amber-400/40 text-amber-100 hover:bg-amber-500/20"
                : "border-amber-300 text-amber-900 hover:bg-amber-100"
            }`}
          >
            {rollbackLabel}
          </button>
        )}
      </div>
    </div>
  );
}
