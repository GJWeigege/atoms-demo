import "server-only";

import type { SessionUser } from "./server-api";
import { backendFetch } from "./server-api";

export type { SessionUser };

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const res = await backendFetch("/api/auth/me");
    if (!res.ok) return null;

    const data = (await res.json()) as { user: SessionUser | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
