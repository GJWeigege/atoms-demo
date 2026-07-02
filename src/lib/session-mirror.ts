/** Mirror backend session JWT onto the Next.js origin for RSC backendFetch. */
export async function mirrorSessionToken(token: string): Promise<void> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error("Failed to mirror session token");
  }
}

export async function clearMirroredSession(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
}
