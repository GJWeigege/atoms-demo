"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientApiUrl, getPreviewOrigin } from "@/lib/client-api";

export type SelectedElement = {
  selector: string;
  tagName: string;
  textContent: string;
  styles: Record<string, string>;
};

type PreviewFrameProps = {
  projectId: string;
  status: string;
  designMode?: boolean;
  device: "desktop" | "mobile";
  onSelect?: (el: SelectedElement | null) => void;
};

export function PreviewFrame({
  projectId,
  status,
  designMode = false,
  device,
  onSelect,
}: PreviewFrameProps) {
  const [key, setKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const refresh = useCallback(() => setKey((k) => k + 1), []);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("app-updated", handler);
    return () => window.removeEventListener("app-updated", handler);
  }, [refresh]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "atoms-design-mode", enabled: designMode },
      getPreviewOrigin(),
    );
  }, [designMode, key]);

  useEffect(() => {
    const previewOrigin = getPreviewOrigin();
    function onMessage(e: MessageEvent) {
      if (e.origin !== previewOrigin) return;
      if (e.data?.type === "atoms-select") {
        onSelect?.({
          selector: e.data.selector,
          tagName: e.data.tagName,
          textContent: e.data.textContent,
          styles: e.data.styles ?? {},
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelect]);

  if (status === "generating") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 rounded-b-lg border border-zinc-200 border-t-0">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-600 text-sm">智能体正在构建你的应用…</p>
        <p className="text-zinc-400 text-xs mt-1">左侧可查看 ReAct 推理步骤</p>
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50 rounded-b-lg border border-zinc-200 border-t-0">
        <p className="text-zinc-500 text-sm">暂无预览</p>
      </div>
    );
  }

  const maxWidth = device === "mobile" ? "390px" : "100%";

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-100 rounded-b-lg border border-zinc-200 border-t-0 overflow-hidden">
      <div className="flex-1 flex justify-center p-2 min-h-0 overflow-auto">
        <iframe
          ref={iframeRef}
          key={key}
          src={clientApiUrl(`/api/projects/${projectId}/preview?t=${key}`)}
          className="bg-white rounded-lg border border-zinc-200 shadow-lg transition-all duration-300"
          style={{
            width: maxWidth,
            maxWidth: "100%",
            height: device === "mobile" ? "667px" : "100%",
            minHeight: device === "mobile" ? "667px" : "400px",
          }}
          sandbox="allow-scripts allow-same-origin"
          title="应用预览"
        />
      </div>
    </div>
  );
}

export function usePreviewControls(projectId: string) {
  const openNewTab = useCallback(() => {
    window.open(clientApiUrl(`/api/projects/${projectId}/preview`), "_blank");
  }, [projectId]);

  const refreshKey = useCallback(() => {
    window.dispatchEvent(new CustomEvent("app-updated"));
  }, []);

  return { openNewTab, refreshKey };
}
