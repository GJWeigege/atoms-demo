"use client";

import { useState } from "react";
import { clientFetch } from "@/lib/client-api";
import type { SelectedElement } from "./PreviewFrame";

type VisualEditorPanelProps = {
  projectId: string;
  selected: SelectedElement | null;
  onApply: () => void;
  onRefineRequest?: (prompt: string) => void;
};

const STYLE_FIELDS: { key: string; label: string; cssKey: string }[] = [
  { key: "content", label: "内容", cssKey: "" },
  { key: "margin", label: "外边距", cssKey: "margin" },
  { key: "padding", label: "内边距", cssKey: "padding" },
  { key: "width", label: "宽度", cssKey: "width" },
  { key: "height", label: "高度", cssKey: "height" },
  { key: "fontSize", label: "字号", cssKey: "font-size" },
  { key: "fontWeight", label: "字重", cssKey: "font-weight" },
  { key: "color", label: "文字色", cssKey: "color" },
  { key: "backgroundColor", label: "背景色", cssKey: "background-color" },
];

export function VisualEditorPanel({
  projectId,
  selected,
  onApply,
  onRefineRequest,
}: VisualEditorPanelProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [refineInput, setRefineInput] = useState("");
  const [saving, setSaving] = useState(false);

  if (!selected) {
    return (
      <div className="w-64 shrink-0 border-r border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs text-zinc-500 leading-relaxed">
          在预览中点击元素进行选择，然后在此编辑样式属性。
        </p>
      </div>
    );
  }

  function getValue(key: string): string {
    if (values[key] !== undefined) return values[key];
    if (key === "content") return selected?.textContent ?? "";
    return selected?.styles[key] ?? "";
  }

  async function handleApply() {
    if (!selected) return;
    setSaving(true);
    try {
      const styles: Record<string, string> = {};
      for (const field of STYLE_FIELDS) {
        if (!field.cssKey) continue;
        const v = getValue(field.key);
        if (v) styles[field.cssKey] = v;
      }
      await clientFetch(`/api/projects/${projectId}/design/styles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selector: selected.selector, styles }),
      });
      onApply();
      window.dispatchEvent(new CustomEvent("app-updated"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-64 shrink-0 border-r border-zinc-200 bg-white flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-zinc-200">
        <p className="text-xs font-medium text-zinc-700">视觉编辑器</p>
        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{selected.selector}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {STYLE_FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="text-[10px] text-zinc-500">{field.label}</span>
            <input
              value={getValue(field.key)}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-zinc-200 rounded text-zinc-800"
            />
          </label>
        ))}
        <button
          type="button"
          onClick={handleApply}
          disabled={saving}
          className="w-full mt-2 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-white disabled:opacity-50"
        >
          {saving ? "应用中…" : "应用样式"}
        </button>
      </div>
      <form
        className="p-3 border-t border-zinc-200"
        onSubmit={(e) => {
          e.preventDefault();
          if (refineInput.trim()) {
            onRefineRequest?.(refineInput.trim());
            setRefineInput("");
          }
        }}
      >
        <input
          value={refineInput}
          onChange={(e) => setRefineInput(e.target.value)}
          placeholder="让 Atoms 团队修改所选元素…"
          className="w-full px-2 py-2 text-xs bg-white border border-zinc-200 rounded text-zinc-800 placeholder:text-zinc-400"
        />
      </form>
    </div>
  );
}
