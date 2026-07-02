"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/client-api";
import { Header } from "@/components/Header";
import { HomeSidebar, type ConversationSummary } from "@/components/HomeSidebar";
import { UnifiedWorkspace } from "@/components/UnifiedWorkspace";
import { AppConfigProvider } from "@/components/AppConfigProvider";
import type { AppConfig } from "@/lib/config/types";
import {
  mergeConversationMessage,
  mergeProjectChatMessages,
  normalizeProjectMessages,
  type ConversationMessage,
} from "@/lib/conversation-types";
import type { RunStatusEvent } from "@/hooks/useProjectStream";

type Project = {
  id: string;
  name: string;
  prompt: string;
  status: string;
  conversationId?: string | null;
  agentRuns: Array<{
    id: string;
    agentRole: string;
    agentName: string;
    agentId?: string | null;
    stepId?: string | null;
    stepNameZh?: string | null;
    status: string;
    output: string | null;
    order: number;
  }>;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
};

type SidebarProject = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
};

export type ProjectPageClientProps = {
  user: { name: string; email: string };
  project: Project;
  projects: SidebarProject[];
  conversations: ConversationSummary[];
  appConfig: AppConfig;
  initialMessages: ConversationMessage[];
  conversationId: string | null;
};

export function ProjectPageClient({
  user,
  project: initialProject,
  projects,
  conversations,
  appConfig,
  initialMessages,
  conversationId: initialConversationId,
}: ProjectPageClientProps) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [messages, setMessages] = useState(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [conversationList, setConversationList] = useState(conversations);
  const [projectList, setProjectList] = useState(projects);

  const projectId = project.id;
  const isGenerating = project.status === "generating";

  const fetchProject = useCallback(async () => {
    const res = await clientFetch(`/api/projects/${projectId}`);
    if (res.status === 401) {
      router.push("/login");
      return null;
    }
    if (res.status === 404) {
      router.push("/dashboard");
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    const loadedProject = data.project as Project;
    setProject(loadedProject);
    if (loadedProject.conversationId) {
      setConversationId(loadedProject.conversationId);
    }
    return loadedProject;
  }, [projectId, router]);

  const handleRunStatus = useCallback((event: RunStatusEvent) => {
    setProject((prev) => ({
      ...prev,
      agentRuns: prev.agentRuns.map((run) =>
        run.id === event.runId ? { ...run, status: event.status } : run,
      ),
    }));
  }, []);

  const handlePipelineDone = useCallback(async () => {
    const loadedProject = await fetchProject();
    if (!loadedProject) return;

    const convId = loadedProject.conversationId ?? conversationId ?? null;
    const projectMsgs = normalizeProjectMessages(loadedProject.messages);
    if (convId) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const res = await clientFetch(`/api/conversations/${convId}`);
        if (res.ok) {
          const data = await res.json();
          const convMessages = (data.conversation?.messages ?? []) as ConversationMessage[];
          setMessages(mergeProjectChatMessages(convMessages, projectMsgs));
          return;
        }
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }
    setMessages(projectMsgs);
  }, [conversationId, fetchProject]);

  const handlePipelineError = useCallback(async () => {
    await fetchProject();
  }, [fetchProject]);

  function handleNewMessage(msg: ConversationMessage) {
    setMessages((prev) => mergeConversationMessage(prev, msg));
  }

  function handleRefineFromDesign(prompt: string) {
    window.dispatchEvent(new CustomEvent("workspace-refine", { detail: prompt }));
  }

  async function handleDeleteConversation(convId: string): Promise<boolean> {
    const res = await clientFetch(`/api/conversations/${convId}`, { method: "DELETE" });
    if (!res.ok) return false;

    const data = (await res.json()) as { deletedProjectId?: string | null };
    const deletedProjectId = data.deletedProjectId ?? null;

    setConversationList((prev) => prev.filter((c) => c.id !== convId));
    if (deletedProjectId) {
      setProjectList((prev) => prev.filter((p) => p.id !== deletedProjectId));
    }

    if (convId === conversationId || deletedProjectId === projectId) {
      router.push("/dashboard");
      router.refresh();
      return true;
    }

    router.refresh();
    return true;
  }

  const backHref = conversationId
    ? `/dashboard?conversation=${conversationId}`
    : "/dashboard";

  return (
    <AppConfigProvider config={appConfig}>
      <div className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 h-screen">
        <Header user={user} variant="light" />
        <div className="flex flex-1 min-h-0">
          <HomeSidebar
            userName={user.name}
            projects={projectList}
            conversations={conversationList}
            onSelectConversation={(id) => router.push(`/dashboard?conversation=${id}`)}
            onNewConversation={() => router.push("/dashboard")}
            onDeleteConversation={handleDeleteConversation}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <UnifiedWorkspace
              title={project.name}
              projectId={projectId}
              projectStatus={project.status}
              messages={messages}
              onNewMessage={handleNewMessage}
              isGenerating={isGenerating}
              chatDisabled={project.status === "generating"}
              onRunStatus={handleRunStatus}
              onPipelineDone={handlePipelineDone}
              onPipelineError={handlePipelineError}
              onRefineRequest={handleRefineFromDesign}
              variant="light"
              headerExtra={
                <>
                  <Link
                    href={backHref}
                    className="text-xs px-2.5 py-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200 rounded transition-colors"
                  >
                    ← 返回
                  </Link>
                  <button
                    type="button"
                    disabled
                    title="演示功能 — 即将推出"
                    className="text-xs px-2.5 py-1 text-zinc-400 border border-zinc-200 rounded cursor-not-allowed"
                  >
                    分享
                  </button>
                  <button
                    type="button"
                    disabled
                    title="演示功能 — 即将推出"
                    className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-400 rounded cursor-not-allowed"
                  >
                    发布
                  </button>
                </>
              }
            />
          </div>
        </div>
      </div>
    </AppConfigProvider>
  );
}
