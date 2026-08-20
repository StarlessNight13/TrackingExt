import { describe, expect, it } from "vitest";

import {
  matchRestoredBindings,
  reconnectCandidateMatchesTab,
  restoreMatchKey,
  tabRestoreUrl,
} from "./restore-bindings";
import { DEFAULT_SETTINGS, type TrackedTab } from "./types";

function activity(
  overrides: Partial<TrackedTab> & Pick<TrackedTab, "id" | "currentUrl">,
): TrackedTab {
  return {
    name: overrides.name ?? overrides.id,
    emoji: null,
    tags: [],
    groupId: null,
    group: null,
    currentTitle: null,
    activeDeviceId: "dev_1",
    lastUpdatedDeviceId: "dev_1",
    lastUpdatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    isPrivate: false,
    activeDevice: null,
    lastUpdatedDevice: null,
    ...overrides,
  };
}

describe("restoreMatchKey", () => {
  it("treats trailing slashes and www as the same page", () => {
    const a = restoreMatchKey("https://www.example.com/chapter/1/", DEFAULT_SETTINGS);
    const b = restoreMatchKey("https://example.com/chapter/1", DEFAULT_SETTINGS);
    expect(a).toBe(b);
  });
});

describe("tabRestoreUrl", () => {
  it("prefers the loaded url and falls back to pendingUrl during session restore", () => {
    expect(tabRestoreUrl({ id: 1, url: "https://example.com/a" })).toBe("https://example.com/a");
    expect(tabRestoreUrl({ id: 1, pendingUrl: "https://example.com/b" })).toBe(
      "https://example.com/b",
    );
    expect(tabRestoreUrl({ id: 1, url: "about:blank", pendingUrl: "https://example.com/c" })).toBe(
      "https://example.com/c",
    );
  });

  describe("reconnectCandidateMatchesTab", () => {
    const candidate = {
      trackedTabId: "tracked_1",
      trackedTabName: "Example",
      url: "https://www.example.com/article/",
      title: null,
      browserTabId: 5,
    };

    it("keeps a candidate while a restored tab has an equivalent pending URL", () => {
      expect(
        reconnectCandidateMatchesTab(
          candidate,
          { id: 5, url: "about:blank", pendingUrl: "https://example.com/article" },
          DEFAULT_SETTINGS,
        ),
      ).toBe(true);
    });

    it("rejects a candidate after its restored tab navigates elsewhere", () => {
      expect(
        reconnectCandidateMatchesTab(
          candidate,
          { id: 5, url: "https://example.com/other" },
          DEFAULT_SETTINGS,
        ),
      ).toBe(false);
    });
  });
});

describe("matchRestoredBindings", () => {
  it("rebinds a unique restored URL to the owned activity", () => {
    const result = matchRestoredBindings(
      [
        { id: 12, pendingUrl: "https://reader.test/series/one/chapter-4" },
        { id: 13, url: "about:blank" },
      ],
      [
        activity({
          id: "local_tab_1",
          name: "One Piece",
          currentUrl: "https://reader.test/series/one/chapter-4",
        }),
      ],
      DEFAULT_SETTINGS,
      ["dev_1"],
    );

    expect(result.bindings).toEqual({ "12": "local_tab_1" });
    expect(result.pending).toEqual([]);
  });

  it("queues reconnect when two activities share the restored URL", () => {
    const result = matchRestoredBindings(
      [{ id: 8, url: "https://example.com/doc" }],
      [
        activity({ id: "a", currentUrl: "https://example.com/doc" }),
        activity({ id: "b", currentUrl: "https://example.com/doc" }),
      ],
      DEFAULT_SETTINGS,
      ["dev_1"],
    );

    expect(result.bindings).toEqual({});
    expect(result.pending).toHaveLength(2);
  });
});
