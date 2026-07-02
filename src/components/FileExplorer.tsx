"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/lib/client-api";

type ProjectFile = {
  id: string;
  path: string;
  size: number;
  updatedAt: string;
};

type FileExplorerProps = {
  projectId: string;
  onOpenFile?: (path: string) => void;
  selectedPath?: string | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function FileExplorer({ projectId, onOpenFile, selectedPath }: FileExplorerProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const breadcrumb = selectedPath ? selectedPath.split("/").filter(Boolean) : [];
  const isLoading = loading || loadedProjectId !== projectId;

  useEffect(() => {
    const handler = () => setRefreshToken((token) => token + 1);
    window.addEventListener("app-updated", handler);
    return () => window.removeEventListener("app-updated", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await clientFetch(`/api/projects/${projectId}/files`);
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
      } else {
        setFiles([]);
      }
      setLoadedProjectId(projectId);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshToken]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-b-lg border border-zinc-200 border-t-0">
      <div className="px-3 py-2 border-b border-zinc-200 flex items-center justify-between">
        <div className="text-xs text-zinc-500 truncate">
          {breadcrumb.length > 0 ? breadcrumb.join(" / ") : "项目文件"}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled
            title="演示功能"
            className="text-[10px] px-2 py-0.5 text-zinc-400 border border-zinc-200 rounded"
          >
            上传
          </button>
          <button
            type="button"
            disabled
            title="演示功能"
            className="text-[10px] px-2 py-0.5 text-zinc-400 border border-zinc-200 rounded"
          >
            下载
          </button>
        </div>
      </div>
      {isLoading ? (
        <p className="p-4 text-xs text-zinc-600">加载文件列表…</p>
      ) : files.length === 0 ? (
        <p className="p-4 text-xs text-zinc-600">暂无文件 — 完成流水线后将自动生成</p>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-200">
                <th className="text-left px-3 py-2 font-medium">名称</th>
                <th className="text-right px-3 py-2 font-medium">大小</th>
                <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">更新</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.id}
                  className={`border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer ${
                    selectedPath === f.path ? "bg-indigo-50" : ""
                  }`}
                  onClick={() => onOpenFile?.(f.path)}
                >
                  <td className="px-3 py-2 text-zinc-700 font-mono">{f.path}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{formatSize(f.size)}</td>
                  <td className="px-3 py-2 text-right text-zinc-600 hidden sm:table-cell">
                    {new Date(f.updatedAt).toLocaleDateString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
