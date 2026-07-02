"use client";

import { useEffect, useRef, useState } from "react";
import { THEME_OPTIONS, type ThemeId } from "@/lib/themes";

type ThemeSelectorProps = {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
  disabled?: boolean;
};

export function ThemeSelector({
  value,
  onChange,
  disabled = false,
}: ThemeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = THEME_OPTIONS.find((t) => t.id === value) ?? THEME_OPTIONS[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
        title="选择视觉主题"
      >
        <span>{selected.emoji}</span>
        <span className="hidden sm:inline">主题</span>
        <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50">
            <p className="text-xs font-semibold text-zinc-500">视觉主题</p>
          </div>
          <ul className="py-1">
            {THEME_OPTIONS.map((theme) => (
              <li key={theme.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(theme.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 text-left transition-colors ${
                    value === theme.id ? "bg-indigo-50" : ""
                  }`}
                >
                  <span className="text-lg">{theme.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{theme.label}</p>
                    <p className="text-xs text-zinc-500">{theme.description}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
