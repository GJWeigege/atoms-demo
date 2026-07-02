"use client";

import { useMemo, useState } from "react";
import type { ProjectTemplate } from "@/lib/config/types";
import type { TemplateCategoryId } from "@/lib/template-categories";
import { TemplateCard } from "./TemplateCard";
import { TemplateCategoryTabs } from "./TemplateCategoryTabs";

type TemplatesPanelProps = {
  templates: ProjectTemplate[];
  onClone: (template: ProjectTemplate) => Promise<void>;
  cloning?: boolean;
};

export function TemplatesPanel({ templates, onClone, cloning }: TemplatesPanelProps) {
  const [category, setCategory] = useState<TemplateCategoryId | "all">("all");

  const filtered = useMemo(() => {
    if (category === "all") return templates;
    return templates.filter((t) => t.category === category);
  }, [templates, category]);

  return (
    <div className="space-y-4">
      <TemplateCategoryTabs active={category} onChange={setCategory} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((template) => (
          <TemplateCard key={template.id} template={template} onClone={onClone} cloning={cloning} />
        ))}
      </div>
    </div>
  );
}
