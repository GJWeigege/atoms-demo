"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentAvatarRow } from "./AgentAvatarRow";
import { ChatInput } from "./ChatInput";
import { DashboardLayout } from "./DashboardLayout";
import { DiscoverPanel } from "./DiscoverPanel";
import { ProjectsPanel } from "./ProjectsPanel";
import { TemplatesPanel } from "./TemplatesPanel";
import { IntegrationBar } from "./IntegrationBar";
import { UnifiedWorkspace } from "./UnifiedWorkspace";
import type { AgentConfig, ProjectTemplate } from "@/lib/config/types";
import type { ThemeId } from "@/lib/themes";
import {
  mergeConversationMessage,
  mergeProjectChatMessages,
  normalizeProjectMessages,
  type ConversationMessage,
} from "@/lib/conversation-types";
import { clientFetch } from "@/lib/client-api";
import type { ConversationSummary } from "@/components/HomeSidebar";

type HomepageChatProps = {
  user: { name: string; email: string };
  initialConversations: ConversationSummary[];
  initialMessages: ConversationMessage[];
  initialConversationId: string | null;
  initialProjectId?: string | null;
  initialTab?: "discover" | "projects" | "templates";
  projects: Array<{ id: string; name: string; status: string; updatedAt?: string }>;
  templates: ProjectTemplate[];
};

export function HomepageChat({
  user,
  initialConversations,
  initialMessages,
  initialConversationId,
  initialProjectId,
  initialTab = "discover",
  projects,
  templates,
}: HomepageChatProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [projectList, setProjectList] = useState(projects);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(
    initialProjectId ??
      initialConversations.find((c) => c.id === initialConversationId)?.projectId ??
      null,
  );
  const [projectStatus, setProjectStatus] = useState(() => {
    const pid =
      initialProjectId ??
      initialConversations.find((c) => c.id === initialConversationId)?.projectId;
    return projects.find((p) => p.id === pid)?.status ?? "pending";
  });
  const [input, setInput] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeId>(
    (initialConversations.find((c) => c.id === initialConversationId)?.theme as ThemeId) ??
      "modern",
  );
  const [sending, setSending] = useState(false);
  const [building, setBuilding] = useState(false);
  const [activeTab, setActiveTab] = useState<"discover" | "projects" | "templates">(initialTab);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [cloningTemplate, setCloningTemplate] = useState(false);
  const fetchInFlight = useRef(false);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const conversationTitle = activeConversation?.title?.trim() || "新对话";

  const updateUrl = useCallback(
    (convId: string | null, projectId: string | null) => {
      if (!convId) return;
      const params = new URLSearchParams();
      params.set("conversation", convId);
      if (projectId) params.set("project", projectId);
      router.replace(`/dashboard?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const handleTabChange = useCallback(
    (tab: "discover" | "projects" | "templates") => {
      setActiveTab(tab);
      if (tab === "discover") {
        router.replace("/dashboard", { scroll: false });
        return;
      }
      setActiveConversationId(null);
      setMessages([]);
      setLinkedProjectId(null);
      setProjectStatus("pending");
      setSendError(null);
      router.replace(`/dashboard?tab=${tab}`, { scroll: false });
    },
    [router],
  );

  const loadProject = useCallback(async (projectId: string) => {
    const res = await clientFetch(`/api/projects/${projectId}`);
    if (!res.ok) return null;
    const data = await res.json();
    setProjectStatus(data.project.status);
    return data.project as {
      id: string;
      name: string;
      status: string;
      messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
    };
  }, []);

  const loadConversationMessages = useCallback(
    async (convId: string, projectMessages?: ConversationMessage[]) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const res = await clientFetch(`/api/conversations/${convId}`);
        if (res.ok) {
          const data = await res.json();
          const convMessages = (data.conversation.messages ?? []) as ConversationMessage[];
          setMessages(
            projectMessages
              ? mergeProjectChatMessages(convMessages, projectMessages)
              : convMessages,
          );
          if (data.conversation.theme) {
            setTheme(data.conversation.theme as ThemeId);
          }
          return data.conversation as {
            projectId: string | null;
            project?: { id: string; name: string; status: string };
          };
        }
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
      if (projectMessages) {
        setMessages(projectMessages);
      }
      return null;
    },
    [],
  );

  const saveTheme = useCallback(async (convId: string, newTheme: ThemeId) => {
    await clientFetch(`/api/conversations/${convId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {});
  }, []);

  const handleThemeChange = useCallback(
    (newTheme: ThemeId) => {
      setTheme(newTheme);
      if (activeConversationId) {
        saveTheme(activeConversationId, newTheme);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, theme: newTheme } : c)),
        );
      }
    },
    [activeConversationId, saveTheme],
  );

  const handleSelectConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id);
      setSendError(null);
      setLoadingMessages(true);
      const conv = conversations.find((c) => c.id === id);
      if (conv?.theme) setTheme(conv.theme as ThemeId);
      try {
        const pid = conv?.projectId ?? null;
        let projectMsgs: ConversationMessage[] | undefined;
        if (pid) {
          const loadedProject = await loadProject(pid);
          projectMsgs = loadedProject
            ? normalizeProjectMessages(loadedProject.messages)
            : undefined;
          setLinkedProjectId(pid);
        } else {
          setLinkedProjectId(null);
          setProjectStatus("pending");
        }
        await loadConversationMessages(id, projectMsgs);
        updateUrl(id, pid);
      } finally {
        setLoadingMessages(false);
      }
    },
    [conversations, loadConversationMessages, loadProject, updateUrl],
  );

  async function handleNewConversation() {
    const res = await clientFetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const conv = data.conversation;
    setConversations((prev) => [
      { id: conv.id, title: null, theme: conv.theme, updatedAt: conv.updatedAt, projectId: null },
      ...prev,
    ]);
    setActiveConversationId(conv.id);
    setMessages([]);
    setLinkedProjectId(null);
    setProjectStatus("pending");
    setInput("");
    setSelectedAgentId(null);
    setSendError(null);
    updateUrl(conv.id, null);
  }

  async function ensureConversation(): Promise<string | null> {
    if (activeConversationId) return activeConversationId;

    const res = await clientFetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const conv = data.conversation;
    setConversations((prev) => [
      { id: conv.id, title: null, theme: conv.theme, updatedAt: conv.updatedAt, projectId: null },
      ...prev,
    ]);
    setActiveConversationId(conv.id);
    updateUrl(conv.id, null);
    return conv.id;
  }

  async function handleSend() {
    if (!input.trim() || sending) return;

    const convId = await ensureConversation();
    if (!convId) return;

    const userContent = input.trim();
    setInput("");
    setSending(true);
    setSendError(null);

    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        role: "user",
        content: userContent,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const res = await clientFetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userContent,
          agentId: selectedAgentId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev.filter((m) => !m.id.startsWith("temp-")),
          data.userMessage,
          data.assistantMessage,
        ]);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  title: c.title ?? userContent.slice(0, 30),
                  updatedAt: new Date().toISOString(),
                }
              : c,
          ),
        );
        if (data.assistantMessage?.agentId) {
          setSelectedAgentId(data.assistantMessage.agentId);
        }
      } else {
        setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
        const data = await res.json().catch(() => ({}));
        setSendError(data.error ?? "发送失败，请重试");
      }
    } catch {
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
      setSendError("发送失败，请重试");
    } finally {
      setSending(false);
    }
  }

  async function handleBuild() {
    const convId = activeConversationId ?? (await ensureConversation());
    if (!convId) return;

    if (messages.length === 0 && input.trim()) {
      await handleSend();
    }

    setBuilding(true);
    setSendError(null);
    try {
      const res = await clientFetch(`/api/conversations/${convId}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json();
      if (res.ok && data.projectId) {
        setLinkedProjectId(data.projectId);
        setProjectStatus("generating");
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, projectId: data.projectId } : c,
          ),
        );
        updateUrl(convId, data.projectId);
        await loadProject(data.projectId);
      } else if (!res.ok) {
        setSendError(data.error ?? "构建失败，请重试");
      }
    } finally {
      setBuilding(false);
    }
  }

  const fetchProject = useCallback(async () => {
    if (!linkedProjectId || fetchInFlight.current) return null;
    fetchInFlight.current = true;
    try {
      return await loadProject(linkedProjectId);
    } finally {
      fetchInFlight.current = false;
    }
  }, [linkedProjectId, loadProject]);

  const handleRunStatus = useCallback(() => {
    // Agent run status is reflected via SSE stream in chat panel
  }, []);

  const handlePipelineDone = useCallback(async () => {
    const pid = linkedProjectId;
    const loadedProject = pid ? await loadProject(pid) : null;
    if (activeConversationId) {
      const projectMsgs = loadedProject
        ? normalizeProjectMessages(loadedProject.messages)
        : undefined;
      await loadConversationMessages(activeConversationId, projectMsgs);
    }
  }, [activeConversationId, linkedProjectId, loadConversationMessages, loadProject]);

  const handlePipelineError = useCallback(async () => {
    await fetchProject();
  }, [fetchProject]);

  function handleNewMessage(msg: ConversationMessage) {
    setMessages((prev) => mergeConversationMessage(prev, msg));
  }

  function handleRefineFromDesign(prompt: string) {
    window.dispatchEvent(new CustomEvent("workspace-refine", { detail: prompt }));
  }

  function handleSelectAgent(agent: AgentConfig) {
    setSelectedAgentId(agent.id);
    setInput((prev) => {
      if (prev.includes(`@${agent.name}`)) return prev;
      return prev ? `${prev} @${agent.name} ` : `@${agent.name} `;
    });
  }

  function handleRemixPrompt(prompt: string) {
    setInput(prompt);
    setActiveTab("discover");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCloneTemplate(template: ProjectTemplate) {
    setCloningTemplate(true);
    setSendError(null);
    try {
      const res = await clientFetch("/api/projects/clone-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      const data = await res.json();
      if (res.ok && data.projectId) {
        router.push(`/project/${data.projectId}`);
      } else {
        setSendError(data.error ?? "克隆模板失败");
      }
    } catch {
      setSendError("克隆模板失败，请重试");
    } finally {
      setCloningTemplate(false);
    }
  }

  function handleBuildFromTemplate() {
    handleTabChange("templates");
  }

  const handleDeleteConversation = useCallback(
    async (convId: string): Promise<boolean> => {
      const res = await clientFetch(`/api/conversations/${convId}`, { method: "DELETE" });
      if (!res.ok) return false;

      const data = (await res.json()) as { deletedProjectId?: string | null };
      const deletedProjectId = data.deletedProjectId ?? null;

      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);
      if (deletedProjectId) {
        setProjectList((prev) => prev.filter((p) => p.id !== deletedProjectId));
      }

      if (activeConversationId === convId) {
        if (remaining.length > 0) {
          void handleSelectConversation(remaining[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
          setLinkedProjectId(null);
          setProjectStatus("pending");
          router.replace("/dashboard", { scroll: false });
        }
      }

      router.refresh();
      return true;
    },
    [activeConversationId, conversations, handleSelectConversation, router],
  );

  const inConversation = messages.length > 0 || loadingMessages || sending || !!linkedProjectId;
  const isGenerating = projectStatus === "generating";

  const chatInputFooter = (
    <div className={`shrink-0 pt-3 pb-2 border-t overflow-visible ${"border-zinc-200/70 bg-[#f8f8f8]"}`}>
      {sendError && (
        <p className="mb-2 text-sm text-red-600 text-center px-3">{sendError}</p>
      )}
      <div className="px-3">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onBuild={handleBuild}
          onBuildFromTemplate={handleBuildFromTemplate}
          onNewProject={handleNewConversation}
          theme={theme}
          onThemeChange={handleThemeChange}
          sending={sending}
          building={building}
          compact
        />
      </div>
    </div>
  );

  const bottomPanel = (
    <>
      {activeTab === "discover" && (
        <DiscoverPanel onRemix={handleRemixPrompt} />
      )}
      {activeTab === "projects" && (
        <ProjectsPanel projects={projectList} onCreateNew={handleNewConversation} />
      )}
      {activeTab === "templates" && (
        <TemplatesPanel templates={templates} onClone={handleCloneTemplate} cloning={cloningTemplate} />
      )}
    </>
  );

  return (
    <DashboardLayout
      userName={user.name}
      projects={projectList}
      conversations={conversations}
      activeConversationId={activeConversationId}
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
      onDeleteConversation={handleDeleteConversation}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      inConversation={inConversation}
      wideLayout={inConversation}
      bottomPanel={bottomPanel}
    >
      {inConversation ? (
        <UnifiedWorkspace
          title={conversationTitle}
          projectId={linkedProjectId}
          projectStatus={projectStatus}
          messages={messages}
          onNewMessage={handleNewMessage}
          isGenerating={isGenerating}
          chatDisabled={isGenerating}
          showRightPanel
          onRunStatus={handleRunStatus}
          onPipelineDone={handlePipelineDone}
          onPipelineError={handlePipelineError}
          onRefineRequest={handleRefineFromDesign}
          variant="light"
          leftPanelFooter={chatInputFooter}
          onBuild={handleBuild}
          building={building}
          sending={sending || loadingMessages}
          showHeader={!!linkedProjectId}
        />
      ) : (
        <div className="flex flex-col flex-1 min-h-0 h-full">
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <div className="text-center mb-4">
                <p className="text-sm text-zinc-500 mb-1">你好，{user.name}</p>
                <h1 className="text-[2rem] font-bold text-zinc-900 tracking-tight">
                  想创造什么？
                </h1>
              </div>
              <AgentAvatarRow
                selectedAgentId={selectedAgentId}
                onSelectAgent={handleSelectAgent}
              />
            </div>
          </div>

          <div className="shrink-0 pt-3 pb-2 border-t border-zinc-200/70 bg-[#f8f8f8] overflow-visible">
            {sendError && (
              <p className="mb-2 text-sm text-red-600 text-center">{sendError}</p>
            )}
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onBuild={handleBuild}
              onBuildFromTemplate={handleBuildFromTemplate}
              onNewProject={handleNewConversation}
              theme={theme}
              onThemeChange={handleThemeChange}
              sending={sending}
              building={building}
              compact={false}
            />
            <IntegrationBar />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
