import Link from "next/link";
import { Header } from "@/components/Header";
import { getSessionUser } from "@/lib/auth";
import { tryFetchAppConfig } from "@/lib/config-api";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const { config, error: configError } = await tryFetchAppConfig();
  const agents = config?.agents ?? [];

  return (
    <div className="min-h-full flex flex-col bg-zinc-950 text-white">
      <Header user={user} />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-zinc-950 to-purple-950/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
          <div className="relative max-w-5xl mx-auto px-6 py-24 sm:py-32 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm mb-6">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
              多智能体 AI 平台演示
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
              用
              <span className="block bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                AI 智能体团队
              </span>
              构建应用
            </h1>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              受{" "}
              <a
                href="https://atoms.dev"
                className="text-indigo-400 hover:text-indigo-300 underline-offset-4 hover:underline transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Atoms
              </a>
              启发。描述你的想法，观看专业智能体协作，即时预览生成的应用。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="interactive-scale focus-ring px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25"
              >
                免费开始构建
              </Link>
              <Link
                href="/login"
                className="interactive-scale focus-ring px-8 py-3.5 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50 text-zinc-300 font-medium rounded-xl"
              >
                登录
              </Link>
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-center mb-12">你的 AI 团队</h2>
          {configError ? (
            <p className="text-center text-sm text-amber-400/90 max-w-lg mx-auto">
              智能体列表暂时无法加载。请启动后端服务后刷新页面。
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-indigo-500/30 hover:bg-zinc-900/80 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200"
                >
                  <span className="text-2xl">{agent.emoji}</span>
                  <h3 className="font-semibold mt-3">{agent.name}</h3>
                  <p className="text-sm text-indigo-400">{agent.roleZh}</p>
                  <p className="text-sm text-zinc-500 mt-2">{agent.descriptionZh}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-zinc-800 bg-zinc-900/30">
          <div className="max-w-5xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-8 text-center">
            {[
              { title: "描述", desc: "用自然语言告诉智能体你想构建什么" },
              { title: "生成", desc: "观看智能体流水线规划、架构并编写代码" },
              { title: "优化", desc: "通过对话迭代，导出完成的应用" },
            ].map((step, i) => (
              <div key={step.title} className="group">
                <div className="w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-600/30 group-hover:scale-110 transition-all duration-200">
                  {i + 1}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-zinc-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-zinc-800 py-6 text-center text-sm text-zinc-600">
        Atoms Demo — 仅供演示，与 atoms.dev 无关联。
      </footer>
    </div>
  );
}
