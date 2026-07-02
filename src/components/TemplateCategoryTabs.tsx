"use client";

import { useAppConfig } from "@/components/AppConfigProvider";
import type { TemplateCategoryId } from "@/lib/template-categories";

type TemplateCategoryTabsProps = {
  active: TemplateCategoryId | "all";
  onChange: (category: TemplateCategoryId | "all") => void;
};

export function TemplateCategoryTabs({
  active,
  onChange,
}: TemplateCategoryTabsProps) {
  const { categories } = useAppConfig();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
          active === "all"
            ? "bg-zinc-900 text-white"
            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
        }`}
      >
        全部
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onChange(cat.id)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            active === cat.id
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          {cat.labelEn}
        </button>
      ))}
    </div>
  );
}
