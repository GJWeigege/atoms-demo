"use client";

import { useEffect, useRef, useState } from "react";

type BuildMenuProps = {
  onBuild: () => void;
  onBuildFromTemplate?: () => void;
  onNewProject?: () => void;
  building?: boolean;
  disabled?: boolean;
};

export function BuildMenu({
  onBuild,
  onBuildFromTemplate,
  onNewProject,
  building = false,
  disabled = false,
}: BuildMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const items = [
    {
      id: "build",
      label: "直接构建",
      desc: "从当前对话生成项目",
      action: () => {
        setOpen(false);
        onBuild();
      },
    },
    {
      id: "new",
      label: "新建项目",
      desc: "清空对话并开始新项目",
      action: () => {
        setOpen(false);
        onNewProject?.();
      },
    },
    {
      id: "template",
      label: "从模板构建",
      desc: "选择模板快速启动",
      action: () => {
        setOpen(false);
        onBuildFromTemplate?.();
      },
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={building || disabled}
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors disabled:opacity-50"
      >
        {building ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            构建中
          </>
        ) : (
          <>
            构建
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {open && !building && (
        <div className="absolute bottom-full right-0 mb-2 w-52 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50">
            <p className="text-xs font-semibold text-zinc-500">构建选项</p>
          </div>
          <ul className="py-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={item.action}
                  className="w-full px-3 py-2.5 hover:bg-zinc-50 text-left transition-colors"
                >
                  <p className="text-sm font-medium text-zinc-800">{item.label}</p>
                  <p className="text-xs text-zinc-500">{item.desc}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
