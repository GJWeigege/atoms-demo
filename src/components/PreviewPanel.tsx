"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApiUrl, clientFetch } from "@/lib/client-api";

type PreviewPanelProps = {
  projectId: string;
  status: string;
};

export function PreviewPanel({ projectId, status }: PreviewPanelProps) {
  const [key, setKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(() => setKey((k) => k + 1), []);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("app-updated", handler);
    return () => window.removeEventListener("app-updated", handler);
  }, [refresh]);

  useEffect(() => {
    if (status === "generating") {
      const interval = setInterval(refresh, 3000);
      return () => clearInterval(interval);
    }
  }, [status, refresh]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await clientFetch(`/api/projects/${projectId}/preview`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        const blob = new Blob([data.html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `atoms-app-v${data.version}.html`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  }

  if (status === "generating") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">智能体正在构建你的应用…</p>
        <p className="text-zinc-600 text-xs mt-1">完成后将显示预览</p>
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800">
        <p className="text-zinc-500 text-sm">暂无预览</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 rounded-t-lg">
        <span className="text-xs text-zinc-500 font-medium">实时预览</span>
        <div className="flex gap-1">
          <button
            onClick={refresh}
            className="text-xs px-2.5 py-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors duration-200 focus-ring"
          >
            刷新
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-ring flex items-center gap-1.5"
          >
            {exporting && (
              <span className="w-3 h-3 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
            )}
            {exporting ? "导出中..." : "导出 HTML"}
          </button>
        </div>
      </div>
      <iframe
        key={key}
        src={clientApiUrl(`/api/projects/${projectId}/preview?t=${key}`)}
        className="flex-1 w-full bg-white rounded-b-lg border border-zinc-800 border-t-0"
        sandbox="allow-scripts allow-same-origin"
        title="应用预览"
      />
    </div>
  );
}
