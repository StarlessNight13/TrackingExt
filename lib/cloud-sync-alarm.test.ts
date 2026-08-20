import { describe, expect, it, vi } from "vitest";

import { CLOUD_SYNC_ALARM, scheduleCloudSyncAlarm } from "./cloud-sync-alarm";

function alarms() {
  return {
    clear: vi.fn(async () => true),
    create: vi.fn(),
  };
}

describe("scheduleCloudSyncAlarm", () => {
  it("replaces an existing alarm when automatic sync is enabled", async () => {
    const api = alarms();

    await scheduleCloudSyncAlarm(api, { automaticSync: true, syncIntervalMinutes: 15 });

    expect(api.clear).toHaveBeenCalledWith(CLOUD_SYNC_ALARM);
    expect(api.create).toHaveBeenCalledWith(CLOUD_SYNC_ALARM, { periodInMinutes: 15 });
  });

  it("clears an existing alarm when sync is disabled or disconnected", async () => {
    const api = alarms();

    await scheduleCloudSyncAlarm(api, { automaticSync: false, syncIntervalMinutes: 2 });
    await scheduleCloudSyncAlarm(api, undefined);

    expect(api.clear).toHaveBeenCalledTimes(2);
    expect(api.create).not.toHaveBeenCalled();
  });
});
