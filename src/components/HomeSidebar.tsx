"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  DeleteConversationDialog,
  type DeleteConversationTarget,
} from "./DeleteConversationDialog";

export type ConversationSummary = {
  id: string;
  title: string | null;
  theme?: string | null;
  updatedAt: string;
  projectId: string | null;
  messageCount?: number;
  projectName?: string | null;
  projectStatus?: string | null;
};

type HomeSidebarProps = {
  userName: string;
  projects: Array<{ id: string; name: string; status: string }>;
  conversations: ConversationSummary[];
  activeConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (id: string) => Promise<boolean>;
  activeTab?: "discover" | "projects" | "templates";
  onTabChange?: (tab: "discover" | "projects" | "templates") => void;
};

export function HomeSidebar({
  userName,
  projects,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  activeTab = "discover",
}: HomeSidebarProps) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const activeProjectId = pathname.startsWith("/project/")
    ? pathname.split("/")[2] ?? null
    : null;
  const isProjectPage = activeProjectId !== null;
  const [pendingDelete, setPendingDelete] = useState<DeleteConversationTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openDeleteDialog(conv: ConversationSummary, e: React.MouseEvent) {
    e.stopPropagation();
    setPendingDelete({
      id: conv.id,
      title: conv.title,
      messageCount: conv.messageCount,
      projectId: conv.projectId,
      projectName: conv.projectName ?? projects.find((p) => p.id === conv.projectId)?.name,
      projectStatus:
        conv.projectStatus ?? projects.find((p) => p.id === conv.projectId)?.status,
    });
  }

  async function confirmDelete() {
    if (!pendingDelete || !onDeleteConversation) return;
    setDeleting(true);
    try {
      const ok = await onDeleteConversation(pendingDelete.id);
      if (ok) setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white flex flex-col h-full">
      <div className="p-3 border-b border-zinc-100">
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors text-left"
        >
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            {userName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-800 truncate">{userName} 的工作区</p>
            <p className="text-[10px] text-zinc-400">个人 · 免费版</p>
          </div>
          <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <nav className="p-3 space-y-0.5">
        <SidebarLink
          href="/dashboard"
          active={isDashboard && activeTab === "discover"}
          icon="🏠"
          label="首页"
        />
        <SidebarLink
          href="/dashboard?tab=templates"
          active={isDashboard && activeTab === "templates"}
          icon="📦"
          label="资源"
        />
        <SidebarLink
          href="/dashboard?tab=projects"
          active={isDashboard && activeTab === "projects"}
          icon="📁"
          label="我的项目"
        />
      </nav>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex items-center justify-between mb-2 mt-1">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            对话历史
          </p>
          <button
            type="button"
            onClick={onNewConversation}
            className="text-[11px] text-indigo-600 hover:text-indigo-500 font-medium"
          >
            + 新对话
          </button>
        </div>

        {conversations.length === 0 ? (
          <p className="text-xs text-zinc-400 px-1 py-2">暂无对话</p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.slice(0, 12).map((c) => (
              <li key={c.id}>
                <div
                  className={`group flex items-center gap-1 rounded-lg ${
                    !isProjectPage && activeConversationId === c.id
                      ? "bg-indigo-50"
                      : "hover:bg-zinc-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectConversation?.(c.id)}
                    className={`flex-1 min-w-0 text-left px-2.5 py-2 text-sm transition-colors truncate ${
                      !isProjectPage && activeConversationId === c.id
                        ? "text-indigo-700 font-medium"
                        : "text-zinc-600"
                    }`}
                  >
                    {c.title ?? "新对话"}
                    {c.projectId && (
                      <span className="ml-1 text-xs text-emerald-500" title="已关联项目">
                        ●
                      </span>
                    )}
                  </button>
                  {onDeleteConversation && (
                    <button
                      type="button"
                      onClick={(e) => openDeleteDialog(c, e)}
                      className="shrink-0 mr-1.5 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                      aria-label="删除对话"
                      title="删除对话"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {projects.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              最近项目
            </p>
            <ul className="space-y-0.5">
              {projects.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/project/${p.id}`}
                    className={`block px-2.5 py-2 rounded-lg text-sm truncate transition-colors ${
                      activeProjectId === p.id
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2 border-t border-zinc-100">
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
          <p className="text-xs font-semibold text-indigo-700 mb-0.5">加入社区</p>
          <p className="text-[10px] text-indigo-500/80 leading-relaxed">
            与创作者交流模板与最佳实践
          </p>
        </div>
        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-zinc-700">Credits</p>
            <span className="text-xs font-bold text-zinc-800">100</span>
          </div>
          <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
            <div className="h-full w-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">演示额度 · 不可充值</p>
        </div>
      </div>

      {pendingDelete && (
        <DeleteConversationDialog
          conversation={pendingDelete}
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setPendingDelete(null)}
          deleting={deleting}
        />
      )}
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  label,
  onClick,
}: {
  href: string;
  active: boolean;
  icon: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-zinc-100 text-zinc-900 font-medium"
          : "text-zinc-600 hover:bg-zinc-50"
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  );
}
