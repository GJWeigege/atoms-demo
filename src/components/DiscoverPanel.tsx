"use client";

import { useAppConfig } from "./AppConfigProvider";

type DiscoverPanelProps = {
  onRemix: (prompt: string) => void;
};

export function DiscoverPanel({ onRemix }: DiscoverPanelProps) {
  const { discoverProjects } = useAppConfig();

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {discoverProjects.map((project) => (
        <div
          key={project.id}
          className="group bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-zinc-300 hover:shadow-md transition-all"
        >
          <div
            className={`h-24 bg-gradient-to-br ${project.gradient} flex items-center justify-center relative`}
          >
            <span className="text-3xl">{project.emoji}</span>
            <span className="absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 bg-white/90 text-zinc-600 rounded-full">
              {project.category}
            </span>
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-sm text-zinc-800 mb-0.5">
              {project.name}
            </h3>
            <p className="text-xs text-zinc-500 mb-1">{project.description}</p>
            <p className="text-[10px] text-zinc-400 mb-3">by {project.author}</p>
            <button
              type="button"
              onClick={() => onRemix(project.remixPrompt)}
              className="w-full py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              Remix the Session
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
