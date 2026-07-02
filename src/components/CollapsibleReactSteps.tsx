"use client";

import { useState } from "react";
import type { ReactStep } from "@/lib/conversation-types";

const PHASE_LABELS: Record<string, string> = {
  thought: "思考",
  action: "行动",
  observation: "观察",
};

type CollapsibleReactStepsProps = {
  steps: ReactStep[];
  stepCount: number;
  defaultOpen?: boolean;
  variant?: "light" | "dark";
};

export function CollapsibleReactSteps({
  steps,
  stepCount,
  defaultOpen = false,
  variant = "light",
}: CollapsibleReactStepsProps) {
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? defaultOpen;
  const count = stepCount || steps.length;
  if (count === 0) return null;

  const isDark = variant === "dark";

  return (
    <div
      className={`mb-2 rounded-lg overflow-hidden border ${
        isDark ? "border-zinc-700/80 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50/80"
      }`}
    >
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
          isDark ? "text-zinc-300 hover:bg-zinc-800/60" : "text-zinc-600 hover:bg-zinc-100"
        }`}
      >
        <span>
          {open ? "▼" : "▶"} 已处理 {count} 步
        </span>
      </button>
      {open && (
        <div
          className={`px-3 pb-2.5 space-y-1.5 border-t ${
            isDark ? "border-zinc-700/80" : "border-zinc-200"
          }`}
        >
          {steps.map((step, i) => (
            <div key={`${step.phase}-${i}`} className="text-[11px] leading-relaxed">
              <span
                className={`font-semibold mr-1 ${
                  step.phase === "thought"
                    ? "text-amber-500"
                    : step.phase === "action"
                      ? "text-sky-500"
                      : "text-emerald-500"
                }`}
              >
                {PHASE_LABELS[step.phase] ?? step.phase}:
              </span>
              <span className={isDark ? "text-zinc-400" : "text-zinc-600"}>{step.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
