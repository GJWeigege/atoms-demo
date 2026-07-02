"use client";

import { renderMarkdownToHtml } from "@/lib/markdown";

type ArtifactViewerProps = {
  content: string;
  type: string;
  loading?: boolean;
  mode?: "markdown" | "html" | "raw";
};

export function ArtifactViewer({
  content,
  type,
  loading,
  mode = "markdown",
}: ArtifactViewerProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800">
        <p className="text-zinc-500 text-sm">暂无 {type} 产物</p>
      </div>
    );
  }

  if (mode === "html") {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/80">
          <span className="text-xs text-zinc-500 font-medium uppercase">{type}</span>
        </div>
        <iframe
          title={`${type} preview`}
          srcDoc={content}
          sandbox="allow-scripts"
          className="flex-1 w-full bg-white"
        />
      </div>
    );
  }

  const body =
    mode === "markdown" ? (
      <div
        className="prose-invert max-w-none p-4 overflow-auto flex-1 text-sm"
        dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content, "dark") }}
      />
    ) : (
      <pre className="flex-1 overflow-auto p-4 text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
        {content}
      </pre>
    );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/80">
        <span className="text-xs text-zinc-500 font-medium uppercase">{type}</span>
      </div>
      {body}
    </div>
  );
}
