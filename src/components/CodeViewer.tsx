"use client";

import { useState } from "react";

type CodeData = {
  html: string;
  css: string;
  js: string;
};

type CodeViewerProps = {
  code: CodeData | null;
  loading?: boolean;
};

export function CodeViewer({ code, loading }: CodeViewerProps) {
  const [tab, setTab] = useState<"html" | "css" | "js">("html");

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!code) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800">
        <p className="text-zinc-500 text-sm">暂无代码产物</p>
      </div>
    );
  }

  const tabs = [
    { id: "html" as const, label: "HTML" },
    { id: "css" as const, label: "CSS" },
    { id: "js" as const, label: "JavaScript" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              tab === t.id
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <pre className="flex-1 overflow-auto p-4 text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
        {code[tab]}
      </pre>
    </div>
  );
}
