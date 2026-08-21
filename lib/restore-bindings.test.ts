import { describe, expect, it } from "vitest";

import {
  claimSessionRestoredBindings,
  matchRestoredBindings,
  normalizeRestoreTitle,
  reconnectCandidateMatchesTab,
  restoreMatchKey,
  tabRestoreUrl,
  titleSimilarity,
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

  it("ignores archived activities for URL matching", () => {
    const result = matchRestoredBindings(
      [{ id: 3, url: "https://example.com/doc" }],
      [
        activity({
          id: "archived",
          currentUrl: "https://example.com/doc",
          archivedAt: "2026-01-02T00:00:00.000Z",
        }),
      ],
      DEFAULT_SETTINGS,
      ["dev_1"],
    );

    expect(result.bindings).toEqual({});
    expect(result.pending).toEqual([]);
  });

  it("disambiguates duplicate URLs using distinct titles from fingerprints", () => {
    const url = "https://example.com/doc";
    const result = matchRestoredBindings(
      [
        { id: 10, url, title: "Alpha Draft", index: 0, windowId: 1, pinned: false },
        { id: 11, url, title: "Beta Draft", index: 1, windowId: 1, pinned: false },
      ],
      [
        activity({ id: "a", currentUrl: url, currentTitle: "Alpha Draft", name: "Alpha" }),
        activity({ id: "b", currentUrl: url, currentTitle: "Beta Draft", name: "Beta" }),
      ],
      DEFAULT_SETTINGS,
      ["dev_1"],
      {
        a: {
          urlKey: "https://example.com/doc",
          title: "Alpha Draft",
          pinned: false,
          index: 0,
          windowOrdinal: 0,
          windowTabCount: 2,
          openerActivityId: null,
          lastAccessed: null,
          groupId: null,
          incognito: false,
          capturedAt: "2026-01-01T00:00:00.000Z",
          browserTabId: 1,
        },
        b: {
          urlKey: "https://example.com/doc",
          title: "Beta Draft",
          pinned: false,
          index: 1,
          windowOrdinal: 0,
          windowTabCount: 2,
          openerActivityId: null,
          lastAccessed: null,
          groupId: null,
          incognito: false,
          capturedAt: "2026-01-01T00:00:00.000Z",
          browserTabId: 2,
        },
      },
    );

    expect(result.bindings).toEqual({ "10": "a", "11": "b" });
    expect(result.pending).toEqual([]);
  });

  it("leaves identical duplicate URLs pending when scores are tied", () => {
    const url = "https://example.com/doc";
    const fingerprint = {
      urlKey: "https://example.com/doc",
      title: "Same Title",
      pinned: false,
      index: 0,
      windowOrdinal: 0,
      windowTabCount: 2,
      openerActivityId: null,
      lastAccessed: null,
      groupId: null,
      incognito: false,
      capturedAt: "2026-01-01T00:00:00.000Z",
      browserTabId: null as number | null,
    };
    const result = matchRestoredBindings(
      [
        { id: 10, url, title: "Same Title", index: 0, windowId: 1, pinned: false },
        { id: 11, url, title: "Same Title", index: 0, windowId: 1, pinned: false },
      ],
      [
        activity({ id: "a", currentUrl: url, currentTitle: "Same Title" }),
        activity({ id: "b", currentUrl: url, currentTitle: "Same Title" }),
      ],
      DEFAULT_SETTINGS,
      ["dev_1"],
      {
        a: { ...fingerprint, browserTabId: 1 },
        b: { ...fingerprint, browserTabId: 2 },
      },
    );

    expect(result.bindings).toEqual({});
    expect(result.pending.length).toBeGreaterThanOrEqual(2);
  });

  it("uses index and window ordinal when titles match", () => {
    const url = "https://example.com/doc";
    const result = matchRestoredBindings(
      [
        { id: 20, url, title: "Doc", index: 0, windowId: 100, pinned: true },
        { id: 21, url, title: "Doc", index: 3, windowId: 200, pinned: false },
      ],
      [
        activity({ id: "left", currentUrl: url, currentTitle: "Doc" }),
        activity({ id: "right", currentUrl: url, currentTitle: "Doc" }),
      ],
      DEFAULT_SETTINGS,
      ["dev_1"],
      {
        left: {
          urlKey: "https://example.com/doc",
          title: "Doc",
          pinned: true,
          index: 0,
          windowOrdinal: 0,
          windowTabCount: 1,
          openerActivityId: null,
          lastAccessed: null,
          groupId: null,
          incognito: false,
          capturedAt: "2026-01-01T00:00:00.000Z",
          browserTabId: 1,
        },
        right: {
          urlKey: "https://example.com/doc",
          title: "Doc",
          pinned: false,
          index: 3,
          windowOrdinal: 1,
          windowTabCount: 1,
          openerActivityId: null,
          lastAccessed: null,
          groupId: null,
          incognito: false,
          capturedAt: "2026-01-01T00:00:00.000Z",
          browserTabId: 2,
        },
      },
    );

    expect(result.bindings).toEqual({ "20": "left", "21": "right" });
  });

  it("rejects incognito mismatches", () => {
    const result = matchRestoredBindings(
      [{ id: 5, url: "https://example.com/doc", title: "Doc", incognito: true }],
      [activity({ id: "a", currentUrl: "https://example.com/doc", currentTitle: "Doc" })],
      DEFAULT_SETTINGS,
      ["dev_1"],
      {
        a: {
          urlKey: "https://example.com/doc",
          title: "Doc",
          pinned: false,
          index: 0,
          windowOrdinal: 0,
          windowTabCount: 1,
          openerActivityId: null,
          lastAccessed: null,
          groupId: null,
          incognito: false,
          capturedAt: "2026-01-01T00:00:00.000Z",
          browserTabId: 1,
        },
      },
    );

    expect(result.bindings).toEqual({});
    expect(result.pending).toEqual([]);
  });
});

describe("titleSimilarity", () => {
  it("scores exact and partial titles", () => {
    expect(titleSimilarity(normalizeRestoreTitle("Alpha Draft"), normalizeRestoreTitle("Alpha Draft"))).toBe(
      1,
    );
    expect(
      titleSimilarity(
        normalizeRestoreTitle("Chapter One Piece"),
        normalizeRestoreTitle("Chapter One Piece Final"),
      ),
    ).toBeGreaterThan(0.5);
  });
});

describe("claimSessionRestoredBindings", () => {
  it("binds directly from a valid session activity id", () => {
    const result = claimSessionRestoredBindings(
      [
        {
          id: 40,
          url: "https://example.com/a",
          sessionActivityId: "local_tab_1",
        },
      ],
      [activity({ id: "local_tab_1", currentUrl: "https://example.com/a" })],
      DEFAULT_SETTINGS,
      ["dev_1"],
    );

    expect(result.bindings).toEqual({ "40": "local_tab_1" });
    expect([...result.claimedActivityIds]).toEqual(["local_tab_1"]);
  });

  it("ignores missing, archived, deleted, and foreign-owned session ids", () => {
    const result = claimSessionRestoredBindings(
      [
        { id: 1, sessionActivityId: "gone" },
        {
          id: 2,
          sessionActivityId: "archived",
        },
        {
          id: 3,
          sessionActivityId: "deleted",
        },
        {
          id: 4,
          sessionActivityId: "foreign",
        },
      ],
      [
        activity({
          id: "archived",
          currentUrl: "https://example.com/a",
          archivedAt: "2026-01-02T00:00:00.000Z",
        }),
        activity({
          id: "deleted",
          currentUrl: "https://example.com/b",
          deletedAt: "2026-01-02T00:00:00.000Z",
        }),
        activity({
          id: "foreign",
          currentUrl: "https://example.com/c",
          lastUpdatedDeviceId: "other_device",
        }),
      ],
      DEFAULT_SETTINGS,
      ["dev_1"],
    );

    expect(result.bindings).toEqual({});
    expect(result.claimedActivityIds.size).toBe(0);
  });

  it("distinguishes duplicate URLs when session ids differ", () => {
    const result = claimSessionRestoredBindings(
      [
        { id: 10, url: "https://example.com/doc", sessionActivityId: "a" },
        { id: 11, url: "https://example.com/doc", sessionActivityId: "b" },
      ],
      [
        activity({ id: "a", currentUrl: "https://example.com/doc" }),
        activity({ id: "b", currentUrl: "https://example.com/doc" }),
      ],
      DEFAULT_SETTINGS,
      ["dev_1"],
    );

    expect(result.bindings).toEqual({ "10": "a", "11": "b" });
  });

  it("picks the URL-matching tab when two tabs claim the same activity id", () => {
    const result = claimSessionRestoredBindings(
      [
        { id: 1, url: "https://example.com/other", sessionActivityId: "shared" },
        { id: 2, url: "https://example.com/doc", sessionActivityId: "shared" },
      ],
      [activity({ id: "shared", currentUrl: "https://example.com/doc" })],
      DEFAULT_SETTINGS,
      ["dev_1"],
    );

    expect(result.bindings).toEqual({ "2": "shared" });
    expect(result.claimedActivityIds.size).toBe(1);
  });
});
