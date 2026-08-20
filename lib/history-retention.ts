import { historyCutoff } from "../core/history";
import type { HistoryEntry, PrivacySettings } from "./types";
import { getLocalState, setLocalState } from "./storage";

export function filterHistoryByRetention(
  entries: HistoryEntry[],
  retentionDays: PrivacySettings["historyRetentionDays"],
  now = Date.now(),
): HistoryEntry[] {
  const cutoff = historyCutoff(retentionDays, now);
  if (cutoff === null) return entries;
  return entries.filter((entry) => new Date(entry.visitedAt).getTime() >= cutoff);
}

export function purgeHistoryRecord(
  localHistory: Record<string, HistoryEntry[]>,
  retentionDays: PrivacySettings["historyRetentionDays"],
  now = Date.now(),
) {
  const cutoff = historyCutoff(retentionDays, now);
  if (cutoff === null) return { localHistory, deleted: 0 };

  let deleted = 0;
  const nextHistory: Record<string, HistoryEntry[]> = {};

  for (const [tabId, entries] of Object.entries(localHistory)) {
    const kept = entries.filter((entry) => {
      const keep = new Date(entry.visitedAt).getTime() >= cutoff;
      if (!keep) deleted += 1;
      return keep;
    });
    if (kept.length > 0) nextHistory[tabId] = kept;
  }

  return { localHistory: nextHistory, deleted };
}

export async function purgeLocalHistoryByRetention(
  retentionDays: PrivacySettings["historyRetentionDays"],
  now = Date.now(),
) {
  const state = await getLocalState();
  const { localHistory, deleted } = purgeHistoryRecord(state.localHistory, retentionDays, now);

  if (deleted > 0) {
    await setLocalState({ localHistory });
  }

  return deleted;
}
