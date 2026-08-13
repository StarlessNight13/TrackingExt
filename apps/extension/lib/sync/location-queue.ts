import { getApiClient } from "../api";
import { isServerSyncActive } from "../sync-modes";
import { getLocalState, setLocalState } from "../storage";
import type { QueuedLocationUpdate, TrackedTab } from "../types";

export async function queueLocationUpdate(update: Omit<QueuedLocationUpdate, "queuedAt">) {
  const state = await getLocalState();
  await setLocalState({
    queuedLocationUpdates: {
      ...state.queuedLocationUpdates,
      [update.tabId]: { ...update, queuedAt: new Date().toISOString() },
    },
  });
}

/** Replays the latest write for each tab. Failed entries remain durable for the next sync. */
export async function flushQueuedLocationUpdates(): Promise<TrackedTab[]> {
  const state = await getLocalState();
  if (
    !isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken) ||
    !state.deviceId
  ) {
    return [];
  }

  const queue = Object.values(state.queuedLocationUpdates).toSorted((a, b) =>
    a.queuedAt.localeCompare(b.queuedAt),
  );
  if (queue.length === 0) return [];

  const api = await getApiClient();
  const remaining = { ...state.queuedLocationUpdates };
  const updatedTabs: TrackedTab[] = [];

  for (const update of queue) {
    try {
      const result = await api.trackedTabs.updateLocation({
        id: update.tabId,
        deviceId: state.deviceId,
        url: update.url,
        title: update.title,
      });
      delete remaining[update.tabId];
      if (!result.skipped) updatedTabs.push(result.tab);
    } catch {
      // Keep it for the next scheduled/manual refresh.
    }
  }

  await setLocalState({ queuedLocationUpdates: remaining });
  return updatedTabs;
}
