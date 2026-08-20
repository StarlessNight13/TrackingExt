import { describe, expect, it } from "vitest";

import { DEFAULT_CLOUD_SYNC_POLICY, migrateCloudSyncPolicy } from "./database-service";

describe("migrateCloudSyncPolicy", () => {
  it("returns the default policy when no value is stored", () => {
    expect(migrateCloudSyncPolicy(undefined)).toEqual(DEFAULT_CLOUD_SYNC_POLICY);
  });

  it("keeps the new policy shape unchanged", () => {
    const policy = {
      activitySync: false,
      scheduledSync: true,
      scheduledSyncIntervalMinutes: 15,
    } as const;

    expect(migrateCloudSyncPolicy(policy)).toEqual(policy);
  });

  it("maps legacy automatic sync off to both sync modes off", () => {
    expect(
      migrateCloudSyncPolicy({ automaticSync: false, syncIntervalMinutes: 30 }),
    ).toEqual({
      activitySync: false,
      scheduledSync: false,
      scheduledSyncIntervalMinutes: 30,
    });
  });

  it("maps legacy automatic sync on to both sync modes on", () => {
    expect(
      migrateCloudSyncPolicy({ automaticSync: true, syncIntervalMinutes: 5 }),
    ).toEqual({
      activitySync: true,
      scheduledSync: true,
      scheduledSyncIntervalMinutes: 5,
    });
  });
});
