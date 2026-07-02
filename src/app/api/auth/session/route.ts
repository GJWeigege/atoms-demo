import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";
import { SESSION_COOKIE } from "@/lib/server-api";
import {
  isSameSiteMirrorRequest,
  verifyBackendSessionToken,
} from "@/lib/verify-session-token";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  if (!isSameSiteMirrorRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { token?: string };
  if (!body.token || typeof body.token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const valid = await verifyBackendSessionToken(body.token, getBackendUrl());
  if (!valid) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, body.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
