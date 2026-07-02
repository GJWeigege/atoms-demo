"use client";

import { useCallback, useState } from "react";
import { AppViewerToolbar, type ViewerMode } from "./AppViewerToolbar";
import { PreviewFrame, usePreviewControls, type SelectedElement } from "./PreviewFrame";
import { VisualEditorPanel } from "./VisualEditorPanel";
import { FileExplorer } from "./FileExplorer";
import { CodeEditorPanel } from "./CodeEditorPanel";

type ProjectWorkspaceProps = {
  projectId: string;
  projectName: string;
  status: string;
  onRefineRequest?: (prompt: string) => void;
};

export function ProjectWorkspace({
  projectId,
  status,
  onRefineRequest,
}: ProjectWorkspaceProps) {
  const [mode, setMode] = useState<ViewerMode>("preview");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [showConsole, setShowConsole] = useState(false);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [editorPath, setEditorPath] = useState<string | null>(null);
  const { openNewTab, refreshKey } = usePreviewControls(projectId);

  const handleOpenFile = useCallback((path: string) => {
    setEditorPath(path);
    setMode("editor");
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppViewerToolbar
        mode={mode}
        onModeChange={setMode}
        device={device}
        onDeviceChange={setDevice}
        onRefresh={refreshKey}
        onOpenNewTab={openNewTab}
        showConsole={showConsole}
        onToggleConsole={() => setShowConsole((v) => !v)}
        status={status}
      />

      <div className="flex-1 flex min-h-0">
        {mode === "design" && (
          <VisualEditorPanel
            projectId={projectId}
            selected={selected}
            onApply={refreshKey}
            onRefineRequest={onRefineRequest}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {mode === "preview" && (
            <PreviewFrame
              projectId={projectId}
              status={status}
              device={device}
            />
          )}
          {mode === "design" && (
            <PreviewFrame
              projectId={projectId}
              status={status}
              designMode
              device={device}
              onSelect={setSelected}
            />
          )}
          {mode === "editor" && (
            <CodeEditorPanel
              key={editorPath ?? "default"}
              projectId={projectId}
              initialPath={editorPath}
            />
          )}
          {mode === "files" && (
            <FileExplorer
              projectId={projectId}
              selectedPath={editorPath}
              onOpenFile={handleOpenFile}
            />
          )}

          {showConsole && mode !== "files" && (
            <div className="h-24 shrink-0 border-t border-zinc-200 bg-zinc-50 p-2 overflow-y-auto">
              <p className="text-[10px] text-zinc-500 font-mono">
                [console] 预览控制台（演示）— 应用日志将在此显示
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
