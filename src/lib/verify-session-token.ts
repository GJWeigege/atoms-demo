import { SESSION_COOKIE } from "@/lib/session-cookie";

/** Verify a JWT against the Python backend before mirroring it onto the Next.js origin. */
export async function verifyBackendSessionToken(
  token: string,
  backendUrl: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE}=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { user?: unknown };
    return data.user != null;
  } catch {
    return false;
  }
}

/** Reject cross-site POST attempts to the session mirror endpoint. */
export function isSameSiteMirrorRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host.split(",")[0]?.trim();
  } catch {
    return false;
  }
}
