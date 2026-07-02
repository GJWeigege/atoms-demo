import { describe, expect, it } from "vitest";
import { getAgentOutputPreview, getMarkdownTitle } from "./message-preview";

describe("message-preview", () => {
  it("extracts markdown title", () => {
    expect(getMarkdownTitle("# 需求 Intake 分析\n\n正文")).toBe("需求 Intake 分析");
  });

  it("returns preview from title when available", () => {
    expect(getAgentOutputPreview("# 产品需求文档\n\n很长正文")).toBe("产品需求文档");
  });

  it("truncates plain text preview", () => {
    const preview = getAgentOutputPreview("a".repeat(80));
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThan(80);
  });
});
