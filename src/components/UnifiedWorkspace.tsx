"use client";

import type { ReactNode } from "react";
import { StreamingChatPanel } from "./StreamingChatPanel";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { ChatMessageList } from "./ChatMessageList";
import { WorkspacePlaceholder } from "./WorkspacePlaceholder";
import type { ConversationMessage } from "@/lib/conversation-types";
import type { RunStatusEvent } from "@/hooks/useProjectStream";
import { projectStatusLabel } from "@/lib/ui-labels";

type UnifiedWorkspaceProps = {
  title: string;
  projectId?: string | null;
  projectStatus?: string;
  messages: ConversationMessage[];
  onNewMessage?: (message: ConversationMessage) => void;
  isGenerating?: boolean;
  chatDisabled?: boolean;
  showRightPanel?: boolean;
  onRunStatus?: (event: RunStatusEvent) => void;
  onPipelineDone?: () => void;
  onPipelineError?: () => void;
  onRefineRequest?: (prompt: string) => void;
  headerExtra?: ReactNode;
  variant?: "light" | "dark";
  /** Footer for pre-build conversation chat (ChatInput, etc.) */
  leftPanelFooter?: ReactNode;
  onBuild?: () => void;
  building?: boolean;
  sending?: boolean;
  showHeader?: boolean;
};

export function UnifiedWorkspace({
  title,
  projectId,
  projectStatus = "pending",
  messages,
  onNewMessage,
  isGenerating,
  chatDisabled,
  showRightPanel = true,
  onRunStatus,
  onPipelineDone,
  onPipelineError,
  onRefineRequest,
  headerExtra,
  variant = "light",
  leftPanelFooter,
  onBuild,
  building,
  sending,
  showHeader,
}: UnifiedWorkspaceProps) {
  const isDark = variant === "dark";
  const hasProject = !!projectId;
  const shouldShowHeader = showHeader ?? hasProject;

  return (
    <div className={`flex flex-col h-full min-h-0 ${isDark ? "text-white" : "text-zinc-900"}`}>
      {shouldShowHeader && (
        <div
          className={`px-4 py-3 border-b flex items-center gap-3 shrink-0 ${
            isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white"
          }`}
        >
          <h1 className="font-semibold truncate flex-1">{title}</h1>
          {hasProject && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                projectStatus === "ready"
                  ? "bg-emerald-600/20 text-emerald-400"
                  : projectStatus === "generating"
                    ? "bg-indigo-600/20 text-indigo-400"
                    : projectStatus === "failed"
                      ? "bg-red-600/20 text-red-400"
                      : isDark
                        ? "bg-zinc-700 text-zinc-400"
                        : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {projectStatusLabel(projectStatus)}
            </span>
          )}
          {headerExtra}
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <div
          className={`w-[min(480px,48%)] shrink-0 border-r flex flex-col min-h-0 ${
            isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white"
          }`}
        >
          {hasProject ? (
            <StreamingChatPanel
              projectId={projectId!}
              messages={messages}
              onNewMessage={onNewMessage!}
              disabled={chatDisabled}
              isGenerating={isGenerating}
              onRunStatus={onRunStatus}
              onPipelineDone={onPipelineDone}
              onPipelineError={onPipelineError}
              variant={variant}
            />
          ) : (
            <div className="flex flex-col h-full min-h-0">
              <ChatMessageList
                messages={messages}
                onBuild={onBuild}
                building={building}
                sending={sending}
                variant={variant}
                emptyTitle="继续对话"
                emptyDescription="描述你的想法，或点击「构建」让智能体团队为你生成应用。"
              />
              {leftPanelFooter}
            </div>
          )}
        </div>

        {showRightPanel && (
          <div className={`flex-1 flex flex-col min-w-0 min-h-0 p-3 sm:p-4 ${isDark ? "" : "bg-[#f8f8f8]"}`}>
            {hasProject ? (
              <ProjectWorkspace
                projectId={projectId!}
                projectName={title}
                status={projectStatus}
                onRefineRequest={onRefineRequest}
              />
            ) : (
              <WorkspacePlaceholder variant={variant} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
