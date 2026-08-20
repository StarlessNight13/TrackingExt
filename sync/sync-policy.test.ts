import { describe, expect, it } from "vitest";

import { shouldRunCloudSync } from "./cloud-sync";
import { cloudSyncTriggerForKind } from "./sync-triggers";

const policy = {
  activitySync: true,
  scheduledSync: false,
  scheduledSyncIntervalMinutes: 15,
} as const;

describe("cloud sync policy", () => {
  it("always allows manual sync", () => {
    expect(shouldRunCloudSync("manual", policy)).toBe(true);
  });

  it("allows activity sync only when enabled", () => {
    expect(shouldRunCloudSync("activity", policy)).toBe(true);
    expect(
      shouldRunCloudSync("activity", { ...policy, activitySync: false }),
    ).toBe(false);
  });

  it("allows scheduled sync only when enabled", () => {
    expect(shouldRunCloudSync("scheduled", policy)).toBe(false);
    expect(
      shouldRunCloudSync("scheduled", { ...policy, scheduledSync: true }),
    ).toBe(true);
  });
});

describe("cloudSyncTriggerForKind", () => {
  it("routes explicit mutations through activity sync", () => {
    expect(cloudSyncTriggerForKind("create")).toBe("activity");
    expect(cloudSyncTriggerForKind("rename")).toBe("activity");
    expect(cloudSyncTriggerForKind("archive")).toBe("activity");
  });

  it("routes navigation updates through scheduled sync", () => {
    expect(cloudSyncTriggerForKind("update_location")).toBe("scheduled");
  });
});
