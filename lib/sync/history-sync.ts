import type { HistoryEntry } from "../types";
import { getLocalState, setLocalState } from "../storage";

const HISTORY_LIMIT = 200;

export function mergeHistoryEntries(
  existing: HistoryEntry[],
  incoming: HistoryEntry[],
): HistoryEntry[] {
  const byKey = new Map<string, HistoryEntry>();

  for (const entry of [...existing, ...incoming]) {
    byKey.set(`${entry.url}:${entry.visitedAt}`, entry);
  }

  return [...byKey.values()]
    .toSorted((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime())
    .slice(0, HISTORY_LIMIT);
}

export async function mergePeerHistory(incoming: Record<string, HistoryEntry[]>) {
  const state = await getLocalState();
  const localHistory = { ...state.localHistory };

  for (const [tabId, entries] of Object.entries(incoming)) {
    if (entries.length === 0) continue;
    localHistory[tabId] = mergeHistoryEntries(localHistory[tabId] ?? [], entries);
  }

  await setLocalState({ localHistory });
}

export function pickHistoryForTabs(
  localHistory: Record<string, HistoryEntry[]>,
  tabIds: string[],
): Record<string, HistoryEntry[]> {
  const picked: Record<string, HistoryEntry[]> = {};
  for (const tabId of tabIds) {
    const entries = localHistory[tabId];
    if (entries?.length) {
      picked[tabId] = entries;
    }
  }
  return picked;
}
