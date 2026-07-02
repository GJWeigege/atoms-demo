import { describe, expect, it } from "vitest";
import { sanitizeLinkHref } from "./markdown";

describe("sanitizeLinkHref", () => {
  it("allows http and https links", () => {
    expect(sanitizeLinkHref("https://example.com")).toBe("https://example.com");
    expect(sanitizeLinkHref("http://example.com/path")).toBe("http://example.com/path");
  });

  it("allows mailto and relative links", () => {
    expect(sanitizeLinkHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(sanitizeLinkHref("/docs")).toBe("/docs");
    expect(sanitizeLinkHref("#section")).toBe("#section");
  });

  it("blocks javascript and data URLs", () => {
    expect(sanitizeLinkHref("javascript:alert(1)")).toBe("#");
    expect(sanitizeLinkHref("data:text/html,hello")).toBe("#");
  });
});
