import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { tryFetchAppConfig } from "@/lib/config-api";
import { backendFetch } from "@/lib/server-api";
import {
  mergeProjectChatMessages,
  normalizeProjectMessages,
  type ConversationMessage,
} from "@/lib/conversation-types";
import { ProjectPageClient } from "./ProjectPageClient";

type ProjectRecord = {
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

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversation?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: projectId } = await params;
  const { conversation: queryConversationId } = await searchParams;

  const [projectsRes, conversationsRes, configResult, projectRes] = await Promise.all([
    backendFetch("/api/projects"),
    backendFetch("/api/conversations"),
    tryFetchAppConfig(),
    backendFetch(`/api/projects/${projectId}`),
  ]);

  if (projectsRes.status === 401 || projectRes.status === 401) {
    redirect("/login");
  }
  if (projectRes.status === 404) {
    redirect("/dashboard");
  }
  if (!projectsRes.ok || !projectRes.ok) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 bg-zinc-50">
        <p className="text-sm text-zinc-500">加载项目失败，请稍后重试</p>
        <Link href="/dashboard" className="text-sm text-indigo-600 hover:text-indigo-500">
          返回首页
        </Link>
      </div>
    );
  }

  const { config: appConfig, error: configError } = configResult;
  if (!appConfig) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 bg-zinc-50">
        <p className="text-sm text-zinc-500">{configError ?? "无法加载应用配置"}</p>
        <Link href="/dashboard" className="text-sm text-indigo-600 hover:text-indigo-500">
          返回首页
        </Link>
      </div>
    );
  }

  const projectsData = (await projectsRes.json()) as {
    projects: Array<{ id: string; name: string; status: string; updatedAt: string }>;
  };
  const conversationsData = conversationsRes.ok
    ? ((await conversationsRes.json()) as {
        conversations: Array<{
          id: string;
          title: string | null;
          updatedAt: string;
          projectId: string | null;
          _count?: { messages: number };
          project?: { name: string; status: string };
        }>;
      })
    : { conversations: [] };
  const serializedConversations = conversationsData.conversations.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    projectId: c.projectId,
    messageCount: c._count?.messages ?? 0,
    projectName: c.project?.name ?? null,
    projectStatus: c.project?.status ?? null,
  }));
  const projectData = (await projectRes.json()) as { project: ProjectRecord };
  const project = projectData.project;

  const conversationId =
    (queryConversationId && queryConversationId.length > 0
      ? queryConversationId
      : project.conversationId) ?? null;

  let initialMessages: ConversationMessage[] = [];
  if (conversationId) {
    const convRes = await backendFetch(`/api/conversations/${conversationId}`);
    if (convRes.ok) {
      const convData = (await convRes.json()) as {
        conversation: { messages?: ConversationMessage[] };
      };
      initialMessages = mergeProjectChatMessages(
        convData.conversation.messages ?? [],
        normalizeProjectMessages(project.messages),
      );
    }
  } else {
    initialMessages = normalizeProjectMessages(project.messages);
  }

  return (
    <ProjectPageClient
      user={{ name: user.name, email: user.email }}
      project={project}
      projects={projectsData.projects}
      conversations={serializedConversations}
      appConfig={appConfig}
      initialMessages={initialMessages}
      conversationId={conversationId}
    />
  );
}
