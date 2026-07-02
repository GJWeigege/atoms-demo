"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectTemplate } from "@/lib/config/types";
import { clientFetch } from "@/lib/client-api";

type NewProjectModalProps = {
  templates: ProjectTemplate[];
  onClose: () => void;
};

export function NewProjectModal({ templates, onClose }: NewProjectModalProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function selectTemplate(template: ProjectTemplate) {
    setSelectedTemplate(template.id);
    setPrompt(template.prompt);
    setName(template.name);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await clientFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          name: name.trim() || undefined,
          templateId: selectedTemplate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "创建项目失败");
        return;
      }
      router.push(`/project/${data.project.id}`);
    } catch {
      setError("网络错误，请检查连接");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">新建项目</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors duration-200 focus-ring"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              从模板开始（可选）
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTemplate(t)}
                  className={`text-left p-3 rounded-lg border transition-all duration-200 focus-ring ${
                    selectedTemplate === t.id
                      ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30"
                      : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/80 bg-zinc-800/50"
                  }`}
                >
                  <span className="text-lg">{t.icon}</span>
                  <p className="text-sm font-medium text-white mt-1">{t.name}</p>
                  <p className="text-xs text-zinc-500 line-clamp-2">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              项目名称
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field bg-zinc-800"
              placeholder="我的应用"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              描述你的应用
            </label>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setSelectedTemplate(null);
              }}
              rows={4}
              className="input-field bg-zinc-800 resize-none"
              placeholder="构建一个深色主题的待办应用，支持本地存储..."
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors duration-200 focus-ring"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="interactive-scale focus-ring px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {loading ? "创建中..." : "智能体生成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ProjectSidebarProps = {
  projects: Array<{
    id: string;
    name: string;
    status: string;
    updatedAt: string;
  }>;
  currentId?: string;
  templates: ProjectTemplate[];
};

export function ProjectSidebar({ projects, currentId, templates }: ProjectSidebarProps) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("确定删除此项目？")) return;
    await clientFetch(`/api/projects/${id}`, { method: "DELETE" });
    if (currentId === id) router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full">
        <div className="p-4 border-b border-zinc-800">
          <button
            onClick={() => setShowModal(true)}
            className="interactive-scale focus-ring w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg"
          >
            + 新建项目
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 py-2">
            项目历史
          </p>
          {projects.length === 0 ? (
            <p className="text-xs text-zinc-600 px-2 py-4">暂无项目</p>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg mb-1 transition-all duration-200 focus-ring ${
                  currentId === p.id
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/20"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white border border-transparent"
                }`}
              >
                <span className="text-sm truncate flex-1">{p.name}</span>
                <StatusDot status={p.status} />
                <button
                  onClick={(e) => handleDelete(p.id, e)}
                  className="opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-zinc-600 hover:text-red-400 w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/10 transition-all duration-200"
                  aria-label="删除项目"
                >
                  ×
                </button>
              </Link>
            ))
          )}
        </div>
      </aside>
      {showModal && (
        <NewProjectModal templates={templates} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ready"
      ? "bg-emerald-400"
      : status === "generating"
        ? "bg-indigo-400 animate-pulse"
        : "bg-zinc-600";
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} title={status} />;
}
