import { OFFLINE_DEVICE_MS, STALE_ACTIVITY_MS } from "./settings-constants";
import type { TrackedTab } from "./types";

export type ActivityHealthIssue =
  | "stale"
  | "owner_offline"
  | "ownership_conflict"
  | "sync_pending";

export type ActivityHealth = NonNullable<TrackedTab["health"]>;

export function computeActivityHealth(
  tab: TrackedTab,
  options: {
    now?: number;
    syncPending?: boolean;
  } = {},
): ActivityHealth {
  const now = options.now ?? Date.now();
  const lastUpdatedAtMs = new Date(tab.lastUpdatedAt).getTime();
  const activeLastSeenMs = tab.activeDevice?.lastSeenAt
    ? new Date(tab.activeDevice.lastSeenAt).getTime()
    : null;

  const stale = !tab.archivedAt && now - lastUpdatedAtMs > STALE_ACTIVITY_MS;
  const ownerOffline =
    Boolean(tab.activeDeviceId) &&
    activeLastSeenMs != null &&
    now - activeLastSeenMs > OFFLINE_DEVICE_MS;
  const ownershipConflict = ownerOffline;
  const syncPending = options.syncPending ?? false;

  const issues: ActivityHealthIssue[] = [
    ...(stale ? (["stale"] as const) : []),
    ...(ownerOffline ? (["owner_offline"] as const) : []),
    ...(ownershipConflict ? (["ownership_conflict"] as const) : []),
    ...(syncPending ? (["sync_pending"] as const) : []),
  ];

  return { stale, ownerOffline, ownershipConflict, syncPending, issues };
}

export function hasActivityHealthIssues(health: ActivityHealth) {
  return health.issues.length > 0;
}

export function describeActivityHealthIssue(issue: ActivityHealthIssue): string {
  switch (issue) {
    case "stale":
      return "Stale";
    case "owner_offline":
      return "Owner offline";
    case "ownership_conflict":
      return "Ownership stuck";
    case "sync_pending":
      return "Sync pending";
  }
}

export function activityHealthRecoveryHint(health: ActivityHealth): string | null {
  if (health.ownershipConflict) {
    return "Ownership is stuck on an offline device. Resume to take over on this device.";
  }
  if (health.syncPending) {
    return "A location update is waiting to sync. Retry sync from Settings or the sync banner.";
  }
  if (health.stale) {
    return "This activity has not been updated in over a week.";
  }
  return null;
}
