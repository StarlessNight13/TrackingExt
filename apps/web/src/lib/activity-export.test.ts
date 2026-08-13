import { describe, expect, it } from "vitest";

import {
  activityExportToJson,
  activityExportToLinks,
  activityExportToMarkdown,
  buildActivityExport,
  slugifyFilename,
} from "./activity-export";

const activity = {
  id: "tab_1",
  name: "Chapter notes",
  emoji: "📚",
  tags: ["reading"],
  currentUrl: "https://example.com/ch-2",
  currentTitle: "Chapter 2",
  lastUpdatedAt: "2026-08-13T04:00:00.000Z",
  createdAt: "2026-08-12T04:00:00.000Z",
  archivedAt: null,
  activeDevice: { name: "Laptop" },
  lastUpdatedDevice: { name: "Laptop" },
};

const history = [
  {
    url: "https://example.com/ch-2",
    title: "Chapter 2",
    visitedAt: "2026-08-13T04:00:00.000Z",
  },
  {
    url: "https://example.com/ch-1",
    title: "Chapter 1",
    visitedAt: "2026-08-12T05:00:00.000Z",
  },
];

describe("activity export", () => {
  it("builds a stable export payload", () => {
    const payload = buildActivityExport(activity, history);
    expect(payload.activity.name).toBe("Chapter notes");
    expect(payload.history).toHaveLength(2);
    expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("renders JSON, Markdown, and link lists", () => {
    const payload = buildActivityExport(activity, history);
    const json = activityExportToJson(payload);
    const markdown = activityExportToMarkdown(payload);
    const links = activityExportToLinks(payload);

    expect(JSON.parse(json).activity.currentUrl).toBe("https://example.com/ch-2");
    expect(markdown).toContain("# 📚 Chapter notes");
    expect(markdown).toContain("[Chapter 1](https://example.com/ch-1)");
    expect(links).toBe("https://example.com/ch-2\nhttps://example.com/ch-1\n");
  });

  it("slugifies filenames", () => {
    expect(slugifyFilename("Chapter notes")).toBe("chapter-notes");
    expect(slugifyFilename("!!!")).toBe("activity");
  });
});
