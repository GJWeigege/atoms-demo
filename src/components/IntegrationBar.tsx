"use client";

const INTEGRATIONS = [
  { id: "github", label: "GitHub", emoji: "🐙" },
  { id: "figma", label: "Figma", emoji: "🎨" },
  { id: "notion", label: "Notion", emoji: "📝" },
  { id: "slack", label: "Slack", emoji: "💬" },
  { id: "stripe", label: "Stripe", emoji: "💳" },
  { id: "vercel", label: "Vercel", emoji: "▲" },
  { id: "supabase", label: "Supabase", emoji: "⚡" },
  { id: "linear", label: "Linear", emoji: "📐" },
];

export function IntegrationBar() {
  return (
    <div className="mt-3 px-1">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs text-zinc-400 shrink-0">
          将您的工具连接到 Atoms
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {INTEGRATIONS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              title={`${tool.label}（演示）`}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-base transition-colors"
            >
              {tool.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
