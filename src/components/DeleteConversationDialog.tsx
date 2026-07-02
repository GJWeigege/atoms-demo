"use client";

import { projectStatusLabel } from "@/lib/ui-labels";

export type DeleteConversationTarget = {
  id: string;
  title: string | null;
  messageCount?: number;
  projectId?: string | null;
  projectName?: string | null;
  projectStatus?: string | null;
};

type DeleteConversationDialogProps = {
  conversation: DeleteConversationTarget;
  onConfirm: () => void;
  onCancel: () => void;
  deleting?: boolean;
};

export function DeleteConversationDialog({
  conversation,
  onConfirm,
  onCancel,
  deleting = false,
}: DeleteConversationDialogProps) {
  const title = conversation.title?.trim() || "新对话";
  const messageCount = conversation.messageCount ?? 0;
  const hasProject = !!conversation.projectId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white border border-zinc-200 rounded-xl w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="delete-conversation-title"
        aria-modal="true"
      >
        <div className="p-5 border-b border-zinc-100">
          <h2 id="delete-conversation-title" className="text-lg font-semibold text-zinc-900">
            删除对话
          </h2>
          <p className="mt-1 text-sm text-zinc-500">此操作不可撤销，请确认以下信息。</p>
        </div>

        <div className="p-5 space-y-3 text-sm">
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2.5">
            <p className="text-xs text-zinc-400 mb-0.5">对话标题</p>
            <p className="font-medium text-zinc-800 truncate">{title}</p>
          </div>

          <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2.5">
            <p className="text-xs text-zinc-400 mb-0.5">消息数量</p>
            <p className="text-zinc-700">{messageCount} 条消息将被删除</p>
          </div>

          {hasProject && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
              <p className="text-xs text-amber-600 mb-0.5">关联项目</p>
              <p className="font-medium text-amber-900 truncate">
                {conversation.projectName ?? "未命名项目"}
              </p>
              {conversation.projectStatus && (
                <p className="text-xs text-amber-700 mt-0.5">
                  状态：{projectStatusLabel(conversation.projectStatus)}
                </p>
              )}
              <p className="text-xs text-amber-700 mt-1.5">
                该对话下的项目及其生成内容也将一并删除。
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-zinc-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {deleting && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {deleting ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
