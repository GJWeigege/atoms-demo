"use client";

export type ViewerMode = "preview" | "design" | "editor" | "files";

type AppViewerToolbarProps = {
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  device: "desktop" | "mobile";
  onDeviceChange: (device: "desktop" | "mobile") => void;
  onRefresh: () => void;
  onOpenNewTab: () => void;
  showConsole: boolean;
  onToggleConsole: () => void;
  status: string;
};

const MODES: { id: ViewerMode; label: string }[] = [
  { id: "preview", label: "应用查看器" },
  { id: "design", label: "设计" },
  { id: "editor", label: "编辑器" },
  { id: "files", label: "文件" },
];

export function AppViewerToolbar({
  mode,
  onModeChange,
  device,
  onDeviceChange,
  onRefresh,
  onOpenNewTab,
  showConsole,
  onToggleConsole,
  status,
}: AppViewerToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border border-zinc-200 border-b-0 bg-white rounded-t-lg flex-wrap">
      <div className="flex items-center gap-0.5 bg-zinc-100 rounded-md p-0.5 border border-zinc-200">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            disabled={status === "generating" && m.id !== "preview"}
            className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
              mode === m.id
                ? "bg-white text-zinc-900 shadow-sm font-medium"
                : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <button
          type="button"
          onClick={() => onDeviceChange(device === "desktop" ? "mobile" : "desktop")}
          className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded"
          title={device === "desktop" ? "切换为手机视图" : "切换为桌面视图"}
        >
          {device === "desktop" ? "🖥" : "📱"}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded"
        >
          刷新
        </button>
        <button
          type="button"
          onClick={onOpenNewTab}
          disabled={status !== "ready"}
          className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded disabled:opacity-40"
        >
          新标签
        </button>
        <button
          type="button"
          onClick={onToggleConsole}
          className={`text-xs px-2 py-1 rounded ${
            showConsole ? "bg-zinc-200 text-zinc-800" : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
          }`}
        >
          控制台
        </button>
        <button
          type="button"
          disabled
          title="演示功能 — 即将推出"
          className="text-xs px-2.5 py-1 bg-zinc-100 text-zinc-400 rounded cursor-not-allowed"
        >
          分享
        </button>
        <button
          type="button"
          disabled
          title="演示功能 — 即将推出"
          className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-300 rounded cursor-not-allowed"
        >
          发布
        </button>
      </div>
    </div>
  );
}
