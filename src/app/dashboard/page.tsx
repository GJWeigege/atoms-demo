import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { HomepageChat } from "@/components/HomepageChat";
import { AppConfigProvider } from "@/components/AppConfigProvider";
import { ConfigUnavailable } from "@/components/ConfigUnavailable";
import {
  mergeProjectChatMessages,
  normalizeProjectMessages,
} from "@/lib/conversation-types";
import type { ChatMessageItem } from "@/components/ChatMessageList";
import { getSessionUser } from "@/lib/auth";
import { tryFetchAppConfig } from "@/lib/config-api";
import { backendFetch } from "@/lib/server-api";

type ConversationSummary = {
  id: string;
  title: string | null;
  theme?: string | null;
  updatedAt: string;
  projectId: string | null;
  messageCount?: number;
  projectName?: string | null;
  projectStatus?: string | null;
  _count?: { messages: number };
  project?: { name: string; status: string };
};

type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string; project?: string; tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const queryConversationId = params.conversation ?? null;
  const queryProjectId = params.project ?? null;
  const queryTab = params.tab ?? "discover";
  const initialTab =
    queryTab === "projects" || queryTab === "templates" ? queryTab : "discover";

  const [projectsRes, conversationsRes, configResult] = await Promise.all([
    backendFetch("/api/projects"),
    backendFetch("/api/conversations"),
    tryFetchAppConfig(),
  ]);

  if (!projectsRes.ok || !conversationsRes.ok) {
    redirect("/login");
  }

  const { config: appConfig, error: configError } = configResult;

  const projectsData = (await projectsRes.json()) as { projects: ProjectSummary[] };
  const conversationsData = (await conversationsRes.json()) as {
    conversations: ConversationSummary[];
  };

  const serializedProjects = projectsData.projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    updatedAt: p.updatedAt,
  }));

  const serializedConversations = conversationsData.conversations.map((c) => ({
    id: c.id,
    title: c.title,
    theme: c.theme,
    updatedAt: c.updatedAt,
    projectId: c.projectId,
    messageCount: c._count?.messages ?? 0,
    projectName: c.project?.name ?? null,
    projectStatus: c.project?.status ?? null,
  }));

  const initialConversationId =
    queryConversationId && serializedConversations.some((c) => c.id === queryConversationId)
      ? queryConversationId
      : initialTab === "discover" && !queryConversationId
        ? (serializedConversations[0]?.id ?? null)
        : null;

  let initialMessages: ChatMessageItem[] = [];
  let initialProjectId: string | null = queryProjectId;
  if (initialConversationId) {
    const convRes = await backendFetch(`/api/conversations/${initialConversationId}`);
    if (convRes.ok) {
      const convData = (await convRes.json()) as {
        conversation: { messages?: ChatMessageItem[]; projectId?: string | null };
      };
      if (!initialProjectId && convData.conversation.projectId) {
        initialProjectId = convData.conversation.projectId;
      }
      let convMessages = convData.conversation.messages ?? [];
      if (initialProjectId) {
        const projectRes = await backendFetch(`/api/projects/${initialProjectId}`);
        if (projectRes.ok) {
          const projectData = (await projectRes.json()) as {
            project: {
              messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
            };
          };
          convMessages = mergeProjectChatMessages(
            convMessages,
            normalizeProjectMessages(projectData.project.messages),
          );
        }
      }
      initialMessages = convMessages;
    }
  }

  return (
    <div className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 h-screen">
      <Header user={user} variant="light" />
      <div className="flex flex-1 min-h-0">
        {!appConfig ? (
          <ConfigUnavailable
            message={configError ?? "无法加载应用配置，请稍后重试。"}
          />
        ) : (
          <AppConfigProvider config={appConfig}>
            <HomepageChat
              key={`${initialTab}-${initialConversationId ?? "none"}`}
              user={user}
              initialConversations={serializedConversations}
              initialMessages={initialMessages}
              initialConversationId={initialConversationId}
              initialProjectId={initialProjectId}
              initialTab={initialTab}
              projects={serializedProjects}
              templates={appConfig.templates}
            />
          </AppConfigProvider>
        )}
      </div>
    </div>
  );
}
