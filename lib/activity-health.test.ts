import { describe, expect, it } from "bun:test";

import {
  activityHealthRecoveryHint,
  computeActivityHealth,
  describeActivityHealthIssue,
  hasActivityHealthIssues,
} from "./activity-health";
import type { TrackedTab } from "./types";

const NOW = Date.parse("2026-08-20T12:00:00.000Z");

function tab(overrides: Partial<TrackedTab> = {}): TrackedTab {
  return {
    id: "tab_1",
    name: "Example",
    emoji: null,
    tags: [],
    groupId: null,
    group: null,
    currentUrl: "https://example.com",
    currentTitle: "Example",
    activeDeviceId: "dev_1",
    lastUpdatedDeviceId: "dev_1",
    lastUpdatedAt: new Date(NOW - 60_000).toISOString(),
    createdAt: new Date(NOW - 86_400_000).toISOString(),
    archivedAt: null,
    isPrivate: false,
    activeDevice: {
      id: "dev_1",
      name: "Laptop",
      browser: "Chrome",
      lastSeenAt: new Date(NOW - 60_000).toISOString(),
    },
    lastUpdatedDevice: {
      id: "dev_1",
      name: "Laptop",
      browser: "Chrome",
      lastSeenAt: new Date(NOW - 60_000).toISOString(),
    },
    ...overrides,
  };
}

describe("computeActivityHealth", () => {
  it("reports a healthy active activity", () => {
    const health = computeActivityHealth(tab(), { now: NOW });
    expect(health).toEqual({
      stale: false,
      ownerOffline: false,
      ownershipConflict: false,
      syncPending: false,
      issues: [],
    });
    expect(hasActivityHealthIssues(health)).toBe(false);
  });

  it("flags stale activities after seven days", () => {
    const health = computeActivityHealth(
      tab({ lastUpdatedAt: new Date(NOW - 8 * 24 * 60 * 60 * 1000).toISOString() }),
      { now: NOW },
    );
    expect(health.stale).toBe(true);
    expect(health.issues).toContain("stale");
  });

  it("does not flag archived activities as stale", () => {
    const health = computeActivityHealth(
      tab({
        archivedAt: new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastUpdatedAt: new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      { now: NOW },
    );
    expect(health.stale).toBe(false);
  });

  it("flags offline owners and ownership conflicts", () => {
    const health = computeActivityHealth(
      tab({
        activeDevice: {
          id: "dev_1",
          name: "Laptop",
          browser: "Chrome",
          lastSeenAt: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      }),
      { now: NOW },
    );
    expect(health.ownerOffline).toBe(true);
    expect(health.ownershipConflict).toBe(true);
    expect(health.issues).toEqual(["owner_offline", "ownership_conflict"]);
  });

  it("includes sync pending when requested", () => {
    const health = computeActivityHealth(tab(), { now: NOW, syncPending: true });
    expect(health.syncPending).toBe(true);
    expect(health.issues).toEqual(["sync_pending"]);
  });
});

describe("activity health helpers", () => {
  it("describes issues for UI labels", () => {
    expect(describeActivityHealthIssue("sync_pending")).toBe("Sync pending");
  });

  it("prioritizes ownership recovery hints", () => {
    const health = computeActivityHealth(
      tab({
        activeDevice: {
          id: "dev_1",
          name: "Laptop",
          browser: "Chrome",
          lastSeenAt: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        lastUpdatedAt: new Date(NOW - 8 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      { now: NOW, syncPending: true },
    );
    expect(activityHealthRecoveryHint(health)).toMatch(/take over/i);
  });
});
