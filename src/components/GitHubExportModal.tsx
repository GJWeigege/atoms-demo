"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/lib/client-api";

type GitHubExportModalProps = {
  projectId: string;
  projectName: string;
  onClose: () => void;
};

export function GitHubExportModal({
  projectId,
  projectName,
  onClose,
}: GitHubExportModalProps) {
  const [repoName, setRepoName] = useState(
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40) || "atoms-app",
  );
  const [githubToken, setGithubToken] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [existingRepo, setExistingRepo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ repoUrl: string; filesUploaded: string[] } | null>(null);
  const [tokenConfigured, setTokenConfigured] = useState(false);

  useEffect(() => {
    clientFetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => setTokenConfigured(Boolean(d.github?.configured)))
      .catch(() => {});
  }, []);

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await clientFetch(`/api/projects/${projectId}/export/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoName,
          isPrivate,
          existingRepo,
          ...(githubToken.trim() ? { githubToken: githubToken.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "导出失败");
        return;
      }
      setResult(data);
    } catch {
      setError("网络错误，请重试");
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
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">导出到 GitHub</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
          >
            ×
          </button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <p className="text-emerald-400 text-sm">✓ 已成功推送到 GitHub</p>
            <a
              href={result.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-indigo-400 hover:text-indigo-300 text-sm break-all"
            >
              {result.repoUrl}
            </a>
            <p className="text-xs text-zinc-500">
              已上传：{result.filesUploaded.join("、")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm"
            >
              关闭
            </button>
          </div>
        ) : (
          <form onSubmit={handleExport} className="p-5 space-y-4">
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">仓库名称</label>
              <input
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="input-field bg-zinc-800 w-full"
                placeholder="my-atoms-app"
                required
              />
            </div>

            {!tokenConfigured && (
              <div>
                <label className="block text-sm text-zinc-300 mb-1.5">
                  GitHub Personal Access Token
                </label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="input-field bg-zinc-800 w-full"
                  placeholder="ghp_..."
                  required={!tokenConfigured}
                />
                <p className="text-xs text-zinc-500 mt-1">
                  需要 repo 权限。Token 将保存到你的账户设置。
                </p>
              </div>
            )}

            {tokenConfigured && (
              <p className="text-xs text-emerald-500/80">
                ✓ GitHub Token 已配置（可在下方更新）
              </p>
            )}

            {tokenConfigured && (
              <div>
                <label className="block text-sm text-zinc-300 mb-1.5">
                  更新 Token（可选）
                </label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="input-field bg-zinc-800 w-full"
                  placeholder="留空则使用已保存的 Token"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded"
              />
              私有仓库
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={existingRepo}
                onChange={(e) => setExistingRepo(e.target.checked)}
                className="rounded"
              />
              推送到已存在的仓库
            </label>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {loading ? "推送中..." : "导出到 GitHub"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
