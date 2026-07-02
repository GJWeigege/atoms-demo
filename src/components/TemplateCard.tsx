"use client";

import { useState } from "react";
import type { ProjectTemplate } from "@/lib/config/types";

type TemplateCardProps = {
  template: ProjectTemplate;
  onClone: (template: ProjectTemplate) => void;
  cloning?: boolean;
};

export function TemplateCard({ template, onClone, cloning }: TemplateCardProps) {
  const [loading, setLoading] = useState(false);

  async function handleClone() {
    setLoading(true);
    try {
      await onClone(template);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="group relative bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-zinc-300 hover:shadow-md transition-all duration-200">
      <div
        className={`h-28 bg-gradient-to-br ${template.gradient} flex items-center justify-center`}
      >
        <span className="text-4xl drop-shadow-sm">{template.icon}</span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-zinc-800 text-sm mb-1">{template.name}</h3>
        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mb-3">
          {template.description}
        </p>
        <button
          type="button"
          onClick={handleClone}
          disabled={loading || cloning}
          className="w-full py-2 px-3 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {(loading || cloning) && (
            <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          )}
          {loading || cloning ? "克隆中..." : "克隆模板"}
        </button>
      </div>
    </div>
  );
}
