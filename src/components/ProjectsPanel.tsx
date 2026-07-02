"use client";

import Link from "next/link";
import { projectStatusLabel } from "@/lib/ui-labels";

type ProjectItem = {
  id: string;
  name: string;
  status: string;
  updatedAt?: string;
};

type ProjectsPanelProps = {
  projects: ProjectItem[];
  onCreateNew?: () => void;
};

export function ProjectsPanel({ projects, onCreateNew }: ProjectsPanelProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12 px-6 bg-white border border-zinc-200 rounded-2xl">
        <p className="text-4xl mb-3">📁</p>
        <h3 className="font-semibold text-zinc-800 mb-1">还没有项目</h3>
        <p className="text-sm text-zinc-500 mb-4">
          在上方输入框描述想法，点击「构建」创建你的第一个项目
        </p>
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            开始新对话
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/project/${project.id}`}
          className="group bg-white border border-zinc-200 rounded-2xl p-4 hover:border-indigo-200 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-2xl">📦</span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                project.status === "ready"
                  ? "bg-emerald-50 text-emerald-600"
                  : project.status === "generating"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {projectStatusLabel(project.status)}
            </span>
          </div>
          <h3 className="font-semibold text-sm text-zinc-800 group-hover:text-indigo-600 transition-colors truncate">
            {project.name}
          </h3>
          {project.updatedAt && (
            <p className="text-[10px] text-zinc-400 mt-1">
              更新于 {new Date(project.updatedAt).toLocaleDateString("zh-CN")}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
