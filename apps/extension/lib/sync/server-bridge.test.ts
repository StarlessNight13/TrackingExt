import { describe, expect, it } from "vitest";

import type { TrackedTab } from "../types";
import { isLocalTrackedTabId, mergeTabsByRecency } from "./server-bridge";

function tab(id: string, lastUpdatedAt: string, name = id): TrackedTab {
  return {
    id,
    name,
    emoji: null,
    tags: [],
    currentUrl: `https://example.com/${id}`,
    currentTitle: name,
    activeDeviceId: "dev-1",
    lastUpdatedDeviceId: "dev-1",
    lastUpdatedAt,
    createdAt: lastUpdatedAt,
    archivedAt: null,
    activeDevice: { id: "dev-1", name: "Device", browser: "Chrome" },
    lastUpdatedDevice: { id: "dev-1", name: "Device", browser: "Chrome" },
  };
}

describe("mergeTabsByRecency", () => {
  it("keeps server and local-only tabs", () => {
    const merged = mergeTabsByRecency(
      [tab("server-1", "2026-01-02T00:00:00.000Z")],
      [tab("local_tab_a", "2026-01-01T00:00:00.000Z")],
    );
    expect(merged.map((t) => t.id).sort()).toEqual(["local_tab_a", "server-1"]);
  });

  it("prefers the newer copy when ids match", () => {
    const merged = mergeTabsByRecency(
      [tab("shared", "2026-01-01T00:00:00.000Z", "server copy")],
      [tab("shared", "2026-01-03T00:00:00.000Z", "local copy")],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("local copy");
  });

  it("sorts by lastUpdatedAt descending", () => {
    const merged = mergeTabsByRecency(
      [tab("older", "2026-01-01T00:00:00.000Z"), tab("newer", "2026-01-05T00:00:00.000Z")],
      [],
    );
    expect(merged[0]?.id).toBe("newer");
  });
});

describe("isLocalTrackedTabId", () => {
  it("detects local tab ids", () => {
    expect(isLocalTrackedTabId("local_tab_abc")).toBe(true);
    expect(isLocalTrackedTabId("tab_abc")).toBe(false);
  });
});
