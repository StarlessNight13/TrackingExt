import { describe, expect, it } from "vitest";

import { describeSyncModes, isValidSyncModes } from "./sync-modes";

describe("sync modes", () => {
  it("supports online as an independent mode", () => {
    expect(isValidSyncModes({ offline: false, lan: false, online: true })).toBe(true);
    expect(describeSyncModes({ offline: true, lan: false, online: true })).toBe("Offline + Online");
  });
});
