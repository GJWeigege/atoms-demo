/** Browser-side API base URL — requests go directly to the Python backend (no Next.js rewrite). */
export function getClientBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
}

/** Origin of preview iframe documents (served by the Python backend). */
export function getPreviewOrigin(): string {
  return new URL(getClientBackendUrl()).origin;
}

export function clientApiUrl(path: string): string {
  const base = getClientBackendUrl().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/** Authenticated fetch to the Python backend (session cookie is set on the backend origin). */
export function clientFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(clientApiUrl(path), {
    credentials: "include",
    ...init,
  });
}
