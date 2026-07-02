"use client";

import type { ReactNode } from "react";
import { HomeSidebar, type ConversationSummary } from "./HomeSidebar";

type DashboardLayoutProps = {
  userName: string;
  projects: Array<{ id: string; name: string; status: string }>;
  conversations: ConversationSummary[];
  activeConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (id: string) => Promise<boolean>;
  activeTab: "discover" | "projects" | "templates";
  onTabChange: (tab: "discover" | "projects" | "templates") => void;
  inConversation?: boolean;
  wideLayout?: boolean;
  children: ReactNode;
  bottomPanel: ReactNode;
};

export function DashboardLayout({
  userName,
  projects,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  activeTab,
  onTabChange,
  inConversation = false,
  wideLayout = false,
  children,
  bottomPanel,
}: DashboardLayoutProps) {
  const showBottomPanel = !inConversation;

  return (
    <div className="flex flex-1 min-h-0 bg-[#f8f8f8]">
      <HomeSidebar
        userName={userName}
        projects={projects}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
        onDeleteConversation={onDeleteConversation}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div
          className={`flex-1 flex flex-col min-h-0 ${
            showBottomPanel ? "min-h-[45vh]" : ""
          }`}
        >
          <div
            className={`flex-1 flex flex-col min-h-0 ${
              wideLayout ? "w-full" : "max-w-4xl mx-auto w-full px-4 sm:px-6"
            }`}
          >
            {children}
          </div>
        </div>

        {showBottomPanel && (
          <div className="shrink-0 border-t border-zinc-200 bg-white overflow-y-auto max-h-[42vh]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between border-b border-zinc-100 sticky top-0 bg-white z-10">
                <nav className="flex gap-6">
                  {(
                    [
                      { id: "discover" as const, label: "发现" },
                      { id: "projects" as const, label: "我的项目" },
                      { id: "templates" as const, label: "模板" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      className={`text-sm py-3 transition-colors relative ${
                        activeTab === tab.id
                          ? "text-zinc-900 font-medium"
                          : "text-zinc-500 hover:text-zinc-700"
                      }`}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 rounded-full" />
                      )}
                    </button>
                  ))}
                </nav>
                <button
                  type="button"
                  onClick={() => onTabChange(activeTab)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 py-3 transition-colors"
                >
                  查看全部 &gt;
                </button>
              </div>
              <div className="py-4 sm:py-6">{bottomPanel}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
