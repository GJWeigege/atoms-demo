import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Header } from "@/components/Header";
import { getSessionUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-full flex flex-col bg-zinc-950">
      <Header />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-xl">
          <h1 className="text-2xl font-bold text-white mb-2">欢迎回来</h1>
          <p className="text-zinc-400 mb-8">登录以继续与智能体协作构建</p>
          <AuthForm mode="login" />
          <p className="text-center text-sm text-zinc-500 mt-6">
            还没有账号？{" "}
            <Link
              href="/register"
              className="text-indigo-400 hover:text-indigo-300 underline-offset-4 hover:underline transition-colors"
            >
              立即注册
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
