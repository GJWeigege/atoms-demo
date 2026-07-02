import { describe, expect, it } from "vitest";
import { parseAppConfig, AppConfigError } from "./config-api";

const minimalAgent = {
  id: "mike",
  name: "Mike",
  nameZh: "Mike",
  role: "team_leader",
  roleZh: "负责人",
  color: "#6366f1",
  bgColor: "#eef2ff",
  emoji: "🎯",
  description: "desc",
  descriptionZh: "描述",
};

describe("parseAppConfig", () => {
  it("parses a valid config payload", () => {
    const config = parseAppConfig({
      agents: [minimalAgent],
      templates: [],
      categories: [],
      discoverProjects: [],
    });
    expect(config.agents).toHaveLength(1);
    expect(config.discoverProjects).toEqual([]);
  });

  it("rejects missing discoverProjects", () => {
    expect(() =>
      parseAppConfig({
        agents: [minimalAgent],
        templates: [],
        categories: [],
      }),
    ).toThrow(AppConfigError);
  });
});
