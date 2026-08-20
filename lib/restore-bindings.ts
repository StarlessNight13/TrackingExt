import { isTrackableUrl, sanitizeUrl } from "./privacy";
import type { PrivacySettings, ReconnectCandidate, TrackedTab } from "./types";

export type RestorableBrowserTab = {
  id?: number;
  url?: string;
  pendingUrl?: string;
};

export function tabRestoreUrl(tab: RestorableBrowserTab): string | undefined {
  if (tab.url && isTrackableUrl(tab.url)) return tab.url;
  if (tab.pendingUrl && isTrackableUrl(tab.pendingUrl)) return tab.pendingUrl;
  return tab.url || tab.pendingUrl || undefined;
}

export function restoreMatchKey(url: string, settings: PrivacySettings): string | null {
  if (!isTrackableUrl(url)) return null;
  try {
    const parsed = new URL(sanitizeUrl(url, settings));
    parsed.hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    if (parsed.port === "80" || parsed.port === "443") parsed.port = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function reconnectCandidateMatchesTab(
  candidate: ReconnectCandidate,
  tab: RestorableBrowserTab,
  settings: PrivacySettings,
) {
  const tabUrl = tabRestoreUrl(tab);
  if (!tabUrl) return false;

  const candidateKey = restoreMatchKey(candidate.url, settings);
  const tabKey = restoreMatchKey(tabUrl, settings);
  return candidateKey !== null && candidateKey === tabKey;
}

export function matchRestoredBindings(
  browserTabs: RestorableBrowserTab[],
  activities: TrackedTab[],
  settings: PrivacySettings,
  deviceIds: Iterable<string>,
): { bindings: Record<string, string>; pending: ReconnectCandidate[] } {
  const ownedIds = new Set(deviceIds);
  const owned = activities.filter(
    (tab) => !tab.lastUpdatedDeviceId || ownedIds.has(tab.lastUpdatedDeviceId),
  );

  const trackedByUrl = new Map<string, TrackedTab[]>();
  for (const tracked of owned) {
    const key = restoreMatchKey(tracked.currentUrl, settings);
    if (!key) continue;
    const matches = trackedByUrl.get(key);
    if (matches) matches.push(tracked);
    else trackedByUrl.set(key, [tracked]);
  }

  const bindings: Record<string, string> = {};
  const pending: ReconnectCandidate[] = [];

  for (const tab of browserTabs) {
    if (tab.id === undefined) continue;
    const rawUrl = tabRestoreUrl(tab);
    if (!rawUrl) continue;
    const key = restoreMatchKey(rawUrl, settings);
    if (!key) continue;

    const matches = trackedByUrl.get(key) ?? [];
    if (matches.length === 1) {
      bindings[String(tab.id)] = matches[0]!.id;
      continue;
    }

    for (const tracked of matches) {
      pending.push({
        trackedTabId: tracked.id,
        trackedTabName: tracked.name,
        url: tracked.currentUrl,
        title: tracked.currentTitle,
        browserTabId: tab.id,
      });
    }
  }

  return { bindings, pending };
}
