"use client";

import Link from "next/link";
import { clientFetch } from "@/lib/client-api";
import { clearMirroredSession } from "@/lib/session-mirror";
import { useRouter } from "next/navigation";

type HeaderProps = {
  user?: { name: string; email: string } | null;
  variant?: "dark" | "light";
};

export function Header({ user, variant = "dark" }: HeaderProps) {
  const router = useRouter();
  const isLight = variant === "light";

  async function handleLogout() {
    await Promise.all([
      clientFetch("/api/auth/logout", { method: "POST" }),
      clearMirroredSession(),
    ]);
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className={`border-b sticky top-0 z-50 ${
        isLight
          ? "border-zinc-200 bg-white/90 backdrop-blur-sm"
          : "border-zinc-800 bg-zinc-950/80 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link
          href={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-opacity hover:opacity-80 focus-ring"
        >
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            ✦ Atoms Demo
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-4">
          {user ? (
            <>
              <span
                className={`text-sm hidden sm:inline truncate max-w-[120px] ${
                  isLight ? "text-zinc-500" : "text-zinc-400"
                }`}
              >
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className={`text-sm px-2 py-1 rounded-lg transition-colors duration-200 focus-ring ${
                  isLight
                    ? "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                退出登录
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`text-sm px-2 py-1 rounded-lg transition-colors duration-200 focus-ring ${
                  isLight
                    ? "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                登录
              </Link>
              <Link
                href="/register"
                className="interactive-scale focus-ring text-sm px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
              >
                立即开始
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
