import { hasSameHostname } from "./url-pattern";
import { createInitialSeriesPattern, defaultTetherMode, evaluateSeriesTether, applyManualSeriesPatterns } from "./tether-series";
import type { SeriesTetherPattern, TetherMode } from "./tether-series";
import { ensureLocalDeviceId, getEffectiveDeviceId } from "./local-device";
import { displayHostPath, isExcludedHost, isTrackableUrl, sanitizeUrl } from "./privacy";
import { releaseOfflineTab } from "./sync/offline-store";
import {
  syncCreateTab,
  syncDeleteTab,
  syncRenameTab,
  syncTakeOver,
  syncUpdateTabLocation,
  syncUpdateTabSeriesPattern,
  syncUpdateTabTether,
} from "./sync/router";
import { getLocalState, setLocalState } from "./storage";
import { stripTrackedTabBadge } from "./title-badge";
import type { ReconnectCandidate, TrackedTab } from "./types";

type TitleBadgeMessage =
  | { type: "SET_TRACKED_TITLE_BADGE"; emoji?: string | null }
  | { type: "CLEAR_TRACKED_TITLE_BADGE" };

function bindingKey(tabId: number) {
  return String(tabId);
}

async function sendTitleBadgeMessage(tabId: number, message: TitleBadgeMessage) {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch {
    // Content script may not be ready yet or page may reject injection.
  }
}

async function applyTrackedTitleBadge(tabId: number, emoji?: string | null) {
  await sendTitleBadgeMessage(tabId, { type: "SET_TRACKED_TITLE_BADGE", emoji });
}

async function clearTrackedTitleBadge(tabId: number) {
  await sendTitleBadgeMessage(tabId, { type: "CLEAR_TRACKED_TITLE_BADGE" });
}

function getBoundTabIds(bindings: Record<string, string>, trackedTabId: string) {
  return Object.entries(bindings)
    .filter(([, id]) => id === trackedTabId)
    .map(([tabId]) => Number(tabId))
    .filter((tabId) => Number.isInteger(tabId));
}

export async function canUseTrackingFeatures() {
  const state = await getLocalState();
  if (state.syncModes.offline || state.syncModes.lan) return true;
  return false;
}

export async function refreshCachedTabs() {
  const state = await getLocalState();
  return state.cachedTabs;
}

export async function syncSettings() {
  const state = await getLocalState();
  return state.settings;
}

export async function getBindingForTab(tabId: number) {
  const state = await getLocalState();
  return state.bindings[bindingKey(tabId)] ?? null;
}

export async function setBinding(tabId: number, trackedTabId: string) {
  const state = await getLocalState();
  await setLocalState({
    bindings: { ...state.bindings, [bindingKey(tabId)]: trackedTabId },
  });
}

export async function clearBinding(tabId: number) {
  const state = await getLocalState();
  const next = { ...state.bindings };
  delete next[bindingKey(tabId)];
  await setLocalState({ bindings: next });
}

export async function clearBindingsForTrackedTab(trackedTabId: string) {
  const state = await getLocalState();
  const next: Record<string, string> = {};
  for (const [tabId, id] of Object.entries(state.bindings)) {
    if (id !== trackedTabId) next[tabId] = id;
  }
  await setLocalState({ bindings: next });
}

export async function trackCurrentTab(
  tabId: number,
  name?: string,
  emoji?: string,
  tetherMode: TetherMode = defaultTetherMode(),
  existingTrackedTabId?: string,
) {
  if (existingTrackedTabId) {
    return bindTabToActivity(tabId, existingTrackedTabId);
  }

  const tab = await browser.tabs.get(tabId);
  if (!isTrackableUrl(tab.url)) {
    throw new Error("This page cannot be tethered");
  }

  const state = await getLocalState();
  if (!(await canUseTrackingFeatures())) {
    throw new Error("Enable local tab tethering in settings");
  }

  const url = sanitizeUrl(tab.url!, state.settings);
  if (isExcludedHost(url, state.settings.excludedHosts)) {
    throw new Error("This website is excluded from tab tethering");
  }

  await ensureLocalDeviceId();

  const created = await syncCreateTab({
    name: name?.trim() || tab.title?.trim() || displayHostPath(url),
    emoji,
    url,
    title: tab.title ?? null,
    tetherMode,
    seriesPattern:
      tetherMode === "series" ? createInitialSeriesPattern(url, tab.title ?? null) : undefined,
  });

  await setBinding(tabId, created.id);
  await applyTrackedTitleBadge(tabId, created.emoji);
  return created;
}

export async function bindTabToActivity(tabId: number, trackedTabId: string) {
  const tab = await browser.tabs.get(tabId);
  if (!isTrackableUrl(tab.url)) {
    throw new Error("This page cannot be tethered");
  }

  if (!(await canUseTrackingFeatures())) {
    throw new Error("Enable local tab tethering in settings");
  }

  const state = await getLocalState();
  const tracked = state.cachedTabs.find((entry) => entry.id === trackedTabId);
  if (!tracked) throw new Error("Tethered activity not found");

  const existingBinding = state.bindings[bindingKey(tabId)];
  if (existingBinding === trackedTabId) return tracked;

  await setBinding(tabId, trackedTabId);
  await applyTrackedTitleBadge(tabId, tracked.emoji);
  return tracked;
}

export async function unbindTab(tabId: number) {
  const state = await getLocalState();
  const trackedTabId = state.bindings[bindingKey(tabId)];
  if (!trackedTabId) return null;

  await clearTrackedTitleBadge(tabId);
  await clearBinding(tabId);

  const stillBound = Object.values((await getLocalState()).bindings).includes(trackedTabId);
  if (!stillBound) {
    const deviceId = await getEffectiveDeviceId();
    try {
      if (trackedTabId.startsWith("local_")) {
        await releaseOfflineTab(trackedTabId, deviceId);
      }
    } catch (error) {
      console.warn("Failed to release tracked tab", error);
    }
  }

  return state.cachedTabs.find((entry) => entry.id === trackedTabId) ?? null;
}

export async function stopTracking(trackedTabId: string) {
  const state = await getLocalState();
  await Promise.all(getBoundTabIds(state.bindings, trackedTabId).map(clearTrackedTitleBadge));
  await syncDeleteTab(trackedTabId);
  await clearBindingsForTrackedTab(trackedTabId);
}

export async function renameTrackedTab(id: string, name: string, emoji?: string | null) {
  const updated = await syncRenameTab(id, name, emoji);
  if (!updated) throw new Error("Tethered tab not found");
  const state = await getLocalState();
  await Promise.all(
    getBoundTabIds(state.bindings, id).map((tabId) => applyTrackedTitleBadge(tabId, updated.emoji)),
  );
  return updated;
}

export async function takeOver(trackedTabId: string, browserTabId?: number) {
  await ensureLocalDeviceId();

  const updated = await syncTakeOver(trackedTabId);
  if (!updated) throw new Error("Tethered tab not found");

  if (browserTabId !== undefined) {
    await setBinding(browserTabId, trackedTabId);
    await applyTrackedTitleBadge(browserTabId, updated.emoji);
  }
  return updated;
}

export async function updateSeriesTether(input: {
  trackedTabId: string;
  tetherMode?: TetherMode;
  urlPattern?: string;
  titlePattern?: string;
  resetLearning?: boolean;
}) {
  const state = await getLocalState();
  const tab = state.cachedTabs.find((t) => t.id === input.trackedTabId);
  if (!tab) throw new Error("Tethered tab not found");

  let tetherMode = input.tetherMode ?? tab.tetherMode ?? defaultTetherMode();
  let seriesPattern = tab.seriesPattern;

  if (input.tetherMode === "loose") {
    seriesPattern = undefined;
  } else if (input.resetLearning) {
    tetherMode = "series";
    seriesPattern = createInitialSeriesPattern(tab.currentUrl, tab.currentTitle);
  } else if (input.urlPattern !== undefined || input.titlePattern !== undefined) {
    if (!seriesPattern) {
      seriesPattern = createInitialSeriesPattern(tab.currentUrl, tab.currentTitle);
    }
    seriesPattern = applyManualSeriesPatterns({
      pattern: seriesPattern,
      urlPattern: input.urlPattern,
      titlePattern: input.titlePattern,
    });
    tetherMode = "series";
  } else if (input.tetherMode === "series" && !seriesPattern) {
    tetherMode = "series";
    seriesPattern = createInitialSeriesPattern(tab.currentUrl, tab.currentTitle);
  }

  const updated = await syncUpdateTabTether({
    tabId: input.trackedTabId,
    tetherMode,
    seriesPattern,
  });
  if (!updated) throw new Error("Tethered tab not found");
  return updated;
}

export async function openTrackedTab(tracked: TrackedTab, takeOverOwnership = false) {
  const created = await browser.tabs.create({ url: tracked.currentUrl, active: true });
  if (created.id === undefined) return tracked;

  if (takeOverOwnership) {
    await takeOver(tracked.id, created.id);
  } else {
    await setBinding(created.id, tracked.id);
  }
  return tracked;
}

export async function handleTabUpdate(tabId: number, url?: string, title?: string) {
  const state = await getLocalState();
  const trackedTabId = state.bindings[bindingKey(tabId)];
  if (!trackedTabId) return;
  const tracked = state.cachedTabs.find((tab) => tab.id === trackedTabId);

  await applyTrackedTitleBadge(tabId, tracked?.emoji);

  if (!url || !isTrackableUrl(url)) return;
  if (!(await canUseTrackingFeatures())) return;

  const sanitized = sanitizeUrl(url, state.settings);
  if (isExcludedHost(sanitized, state.settings.excludedHosts)) return;

  const cleanTitle = stripTrackedTabBadge(title ?? null, tracked?.emoji) ?? null;
  const deviceId = await getEffectiveDeviceId();
  const tetherMode = tracked?.tetherMode ?? defaultTetherMode();
  let seriesPattern: SeriesTetherPattern | undefined = tracked?.seriesPattern;

  if (tetherMode === "loose") {
    // A tracked activity is intentionally confined to the site where it started.
    // This ignores ad hops and off-site redirects without stopping the binding.
    if (tracked && !hasSameHostname(tracked.currentUrl, sanitized)) return;
  } else if (tracked) {
    const decision = evaluateSeriesTether({
      pattern: tracked.seriesPattern ?? createInitialSeriesPattern(tracked.currentUrl, tracked.currentTitle),
      url: sanitized,
      title: cleanTitle,
      previousUrl: tracked.currentUrl,
    });
    if (!decision.shouldSync) return;
    seriesPattern = decision.pattern;
  }

  if (
    tracked &&
    tracked.currentUrl === sanitized &&
    (tracked.currentTitle ?? null) === cleanTitle &&
    tracked.activeDeviceId === deviceId &&
    seriesPattern === tracked.seriesPattern
  ) {
    return;
  }

  try {
    if (seriesPattern && seriesPattern !== tracked?.seriesPattern) {
      await syncUpdateTabSeriesPattern({ tabId: trackedTabId, seriesPattern });
    }
    await syncUpdateTabLocation({
      tabId: trackedTabId,
      url: sanitized,
      title: cleanTitle,
    });
  } catch (error) {
    console.warn("Failed to sync tracked tab location", error);
  }
}

export async function handleTabRemoved(tabId: number) {
  const state = await getLocalState();
  const trackedTabId = state.bindings[bindingKey(tabId)];
  if (!trackedTabId) return;

  await clearTrackedTitleBadge(tabId);
  await clearBinding(tabId);

  const deviceId = await getEffectiveDeviceId();
  const stillBound = Object.values((await getLocalState()).bindings).includes(trackedTabId);
  if (!stillBound) {
    try {
      if (trackedTabId.startsWith("local_")) {
        await releaseOfflineTab(trackedTabId, deviceId);
      }
    } catch (error) {
      console.warn("Failed to release tracked tab", error);
    }
  }
}

export async function reconcileRestoredTabs() {
  const state = await getLocalState();
  const deviceId = state.deviceId ?? state.localDeviceId;
  if (!deviceId) {
    await setLocalState({ pendingReconnect: [], bindings: {} });
    return;
  }

  let remoteTabs: TrackedTab[];
  try {
    remoteTabs = await refreshCachedTabs();
  } catch {
    remoteTabs = state.cachedTabs;
  }

  const owned = remoteTabs.filter((t) => t.lastUpdatedDeviceId === deviceId);
  const browserTabs = await browser.tabs.query({});
  const trackable = browserTabs.filter((t) => t.id !== undefined && isTrackableUrl(t.url));

  const newBindings: Record<string, string> = {};
  const pending: ReconnectCandidate[] = [];
  const trackedByUrl = new Map<string, TrackedTab[]>();
  for (const tracked of owned) {
    const matches = trackedByUrl.get(tracked.currentUrl);
    if (matches) {
      matches.push(tracked);
    } else {
      trackedByUrl.set(tracked.currentUrl, [tracked]);
    }
  }

  for (const tab of trackable) {
    if (tab.id === undefined) continue;

    let sanitized: string;
    try {
      sanitized = sanitizeUrl(tab.url!, state.settings);
    } catch {
      continue;
    }

    const matches = trackedByUrl.get(sanitized) ?? [];
    if (matches.length === 1) {
      newBindings[bindingKey(tab.id)] = matches[0]!.id;
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

  await setLocalState({
    bindings: newBindings,
    pendingReconnect: pending,
  });
  await Promise.all(
    Object.entries(newBindings).map(([tabId, trackedId]) => {
      const tracked = remoteTabs.find((tab) => tab.id === trackedId);
      return applyTrackedTitleBadge(Number(tabId), tracked?.emoji);
    }),
  );
}

export async function confirmReconnect(candidate: ReconnectCandidate, takeOverOwnership = true) {
  await setBinding(candidate.browserTabId, candidate.trackedTabId);
  if (takeOverOwnership) {
    await takeOver(candidate.trackedTabId, candidate.browserTabId);
  }
  const state = await getLocalState();
  await setLocalState({
    pendingReconnect: state.pendingReconnect.filter(
      (p) =>
        !(p.trackedTabId === candidate.trackedTabId && p.browserTabId === candidate.browserTabId),
    ),
  });
}

export async function dismissReconnect(candidate: ReconnectCandidate) {
  const state = await getLocalState();
  await setLocalState({
    pendingReconnect: state.pendingReconnect.filter(
      (p) =>
        !(p.trackedTabId === candidate.trackedTabId && p.browserTabId === candidate.browserTabId),
    ),
  });
}
