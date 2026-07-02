"use client";

type WorkspacePlaceholderProps = {
  variant?: "light" | "dark";
};

export function WorkspacePlaceholder({ variant = "light" }: WorkspacePlaceholderProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed ${
        isDark ? "border-zinc-700 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
          isDark ? "bg-zinc-800" : "bg-white shadow-sm"
        }`}
      >
        <span className="text-2xl">📱</span>
      </div>
      <p className={`text-sm font-medium mb-1 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
        构建后将在此预览应用
      </p>
      <p className={`text-xs max-w-xs text-center ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        与智能体讨论需求后，点击「构建」生成应用，预览与设计工具将显示在此
      </p>
    </div>
  );
}
