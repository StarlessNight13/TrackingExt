import { describe, expect, it } from "bun:test";

import {
  activityExportToJson,
  activityExportToLinks,
  activityExportToMarkdown,
  buildActivityExport,
  buildActivityExportFile,
  slugifyFilename,
} from "./activity-export";
import type { TrackedTab } from "./types";

const tab: TrackedTab = {
  id: "tab_1",
  name: "Research Notes",
  emoji: "📚",
  tags: ["reading"],
  groupId: null,
  group: null,
  currentUrl: "https://example.com/page",
  currentTitle: "Example page",
  activeDeviceId: "dev_1",
  lastUpdatedDeviceId: "dev_1",
  lastUpdatedAt: "2026-08-20T10:00:00.000Z",
  createdAt: "2026-08-01T10:00:00.000Z",
  archivedAt: null,
  isPrivate: false,
  activeDevice: { id: "dev_1", name: "Laptop", browser: "Chrome" },
  lastUpdatedDevice: { id: "dev_1", name: "Laptop", browser: "Chrome" },
};

describe("activity export", () => {
  it("builds markdown and links exports", () => {
    const payload = buildActivityExport(tab, [
      {
        id: "h1",
        url: "https://example.com/previous",
        title: "Previous",
        visitedAt: "2026-08-19T10:00:00.000Z",
      },
    ]);

    expect(activityExportToMarkdown(payload)).toContain("# 📚 Research Notes");
    expect(activityExportToLinks(payload)).toContain("https://example.com/page");
    expect(activityExportToJson(payload)).toContain('"name": "Research Notes"');
  });

  it("creates filenames from activity names", () => {
    const payload = buildActivityExport(tab, []);
    expect(buildActivityExportFile(payload, "json").filename).toBe("research-notes.json");
    expect(slugifyFilename("!!!")).toBe("activity");
  });
});
