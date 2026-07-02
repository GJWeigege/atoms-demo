import "server-only";

import { cookies } from "next/headers";
import { getBackendUrl } from "@/lib/backend-url";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export { getBackendUrl } from "@/lib/backend-url";
export { SESSION_COOKIE } from "@/lib/session-cookie";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/** Server Component fetch to Python backend with session cookie forwarded. */
export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Cookie", `${SESSION_COOKIE}=${token}`);
  }
  return fetch(`${getBackendUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
