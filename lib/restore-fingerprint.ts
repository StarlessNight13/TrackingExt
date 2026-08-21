import { isTrackableUrl } from "./privacy";
import { restoreMatchKey, windowOrdinals, type RestorableBrowserTab } from "./restore-bindings";
import { stripTrackedTabBadge } from "./title-badge";
import type { PrivacySettings, RestoreFingerprint } from "./types";

export type FingerprintBrowserTab = RestorableBrowserTab & {
  id?: number;
};

/**
 * Build a local restore fingerprint from a live browser tab and current bindings
 * (for opener activity resolution).
 */
export function buildRestoreFingerprint(input: {
  tab: FingerprintBrowserTab;
  allTabs: FingerprintBrowserTab[];
  settings: PrivacySettings;
  bindings: Record<string, string>;
  emoji?: string | null;
  urlOverride?: string;
  titleOverride?: string | null;
}): RestoreFingerprint | null {
  const { tab, allTabs, settings, bindings } = input;
  const urlFromTab =
    (input.urlOverride && isTrackableUrl(input.urlOverride) ? input.urlOverride : undefined) ??
    (tab.url && isTrackableUrl(tab.url) ? tab.url : undefined) ??
    (tab.pendingUrl && isTrackableUrl(tab.pendingUrl) ? tab.pendingUrl : undefined);
  if (!urlFromTab) return null;
  const urlKey = restoreMatchKey(urlFromTab, settings);
  if (!urlKey) return null;

  const ordinals = windowOrdinals(allTabs);
  const windowOrdinal =
    typeof tab.windowId === "number" ? (ordinals.get(tab.windowId) ?? 0) : 0;
  const windowTabCount =
    typeof tab.windowId === "number"
      ? allTabs.filter((entry) => entry.windowId === tab.windowId).length
      : 1;

  let openerActivityId: string | null = null;
  if (typeof tab.openerTabId === "number") {
    openerActivityId = bindings[String(tab.openerTabId)] ?? null;
  }

  const titleSource = input.titleOverride ?? tab.title ?? null;
  const title = titleSource
    ? stripTrackedTabBadge(titleSource, input.emoji).trim() || null
    : null;

  return {
    urlKey,
    title,
    pinned: Boolean(tab.pinned),
    index: typeof tab.index === "number" ? tab.index : 0,
    windowOrdinal,
    windowTabCount,
    openerActivityId,
    lastAccessed:
      typeof tab.lastAccessed === "number" && Number.isFinite(tab.lastAccessed)
        ? tab.lastAccessed
        : null,
    groupId: typeof tab.groupId === "number" && tab.groupId !== -1 ? tab.groupId : null,
    incognito: Boolean(tab.incognito),
    capturedAt: new Date().toISOString(),
    browserTabId: typeof tab.id === "number" ? tab.id : null,
  };
}
