import { describe, expect, it } from "vitest";
import { isSameSiteMirrorRequest } from "./verify-session-token";

describe("isSameSiteMirrorRequest", () => {
  it("allows requests without Origin header", () => {
    const request = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: { host: "localhost:3000" },
    });
    expect(isSameSiteMirrorRequest(request)).toBe(true);
  });

  it("allows matching origin and host", () => {
    const request = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    expect(isSameSiteMirrorRequest(request)).toBe(true);
  });

  it("rejects cross-site origin", () => {
    const request = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://evil.example",
      },
    });
    expect(isSameSiteMirrorRequest(request)).toBe(false);
  });
});
