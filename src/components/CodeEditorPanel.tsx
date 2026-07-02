"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/lib/client-api";

type CodeEditorPanelProps = {
  projectId: string;
  initialPath?: string | null;
};

type OpenTab = {
  path: string;
  content: string;
  dirty: boolean;
};

function languageForPath(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".html")) return "html";
  return "plaintext";
}

export function CodeEditorPanel({ projectId, initialPath }: CodeEditorPanelProps) {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(initialPath ?? null);

  useEffect(() => {
    if (!pendingPath) return;
    let cancelled = false;
    void (async () => {
      const path = pendingPath;
      const res = await clientFetch(
        `/api/projects/${projectId}/files/${encodeURIComponent(path)}`,
      );
      if (cancelled || !res.ok) return;
      const data = await res.json();
      setTabs((prev) => {
        if (prev.some((t) => t.path === path)) return prev;
        return [...prev, { path, content: data.file.content, dirty: false }];
      });
      setActivePath(path);
      setPendingPath(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingPath, projectId]);

  useEffect(() => {
    if (tabs.length > 0 || initialPath || pendingPath) return;
    let cancelled = false;
    void (async () => {
      const res = await clientFetch(`/api/projects/${projectId}/files`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      const files: { path: string }[] = data.files ?? [];
      const preferred = files.find((f) => f.path === "index.html") ?? files[0];
      if (preferred && !cancelled) {
        setPendingPath(preferred.path);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, tabs.length, initialPath, pendingPath]);

  const activeTab = tabs.find((t) => t.path === activePath);

  function selectTab(path: string) {
    setActivePath(path);
  }

  function updateContent(content: string) {
    if (!activePath) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activePath ? { ...t, content, dirty: true } : t,
      ),
    );
  }

  async function saveFile() {
    if (!activeTab) return;
    setSaving(true);
    try {
      const res = await clientFetch(
        `/api/projects/${projectId}/files/${encodeURIComponent(activeTab.path)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: activeTab.content }),
        },
      );
      if (res.ok) {
        setTabs((prev) =>
          prev.map((t) =>
            t.path === activeTab.path ? { ...t, dirty: false } : t,
          ),
        );
        window.dispatchEvent(new CustomEvent("app-updated"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-b-lg border border-zinc-200 border-t-0">
      <div className="flex items-center border-b border-zinc-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.path}
            type="button"
            onClick={() => selectTab(tab.path)}
            className={`text-xs px-3 py-2 border-r border-zinc-200 shrink-0 ${
              activePath === tab.path
                ? "bg-zinc-100 text-zinc-900 font-medium"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab.path.split("/").pop()}
            {tab.dirty ? " •" : ""}
          </button>
        ))}
        {activeTab && (
          <button
            type="button"
            onClick={saveFile}
            disabled={!activeTab.dirty || saving}
            className="ml-auto mr-2 text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white disabled:opacity-40"
          >
            {saving ? "保存中" : "保存"}
          </button>
        )}
      </div>
      {activeTab ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-3 py-1 text-[10px] text-zinc-500 border-b border-zinc-200 font-mono">
            {activeTab.path} · {languageForPath(activeTab.path)}
          </div>
          <textarea
            value={activeTab.content}
            onChange={(e) => updateContent(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full p-3 bg-zinc-50 text-zinc-800 font-mono text-xs leading-relaxed resize-none focus:outline-none"
          />
        </div>
      ) : (
        <p className="p-4 text-xs text-zinc-500">从「文件」面板选择文件，或在编辑器中打开默认文件</p>
      )}
    </div>
  );
}
