import { getApiClient } from "./api";
import { ensureDeviceRegistered } from "./device";
import { displayHostPath, isExcludedHost, isTrackableUrl, sanitizeUrl } from "./privacy";
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

export async function refreshCachedTabs() {
  const api = await getApiClient();
  const tabs = await api.trackedTabs.list();
  await setLocalState({ cachedTabs: tabs });
  return tabs;
}

export async function syncSettings() {
  const api = await getApiClient();
  const settings = await api.settings.get();
  await setLocalState({ settings });
  return settings;
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

export async function trackCurrentTab(tabId: number, name?: string, emoji?: string) {
  const tab = await browser.tabs.get(tabId);
  if (!isTrackableUrl(tab.url)) {
    throw new Error("This page cannot be tracked");
  }

  const state = await getLocalState();
  const url = sanitizeUrl(tab.url!, state.settings);
  if (isExcludedHost(url, state.settings.excludedHosts)) {
    throw new Error("This website is excluded from tracking");
  }

  const device = await ensureDeviceRegistered();
  const api = await getApiClient();
  const created = await api.trackedTabs.create({
    deviceId: device.id,
    name: name?.trim() || tab.title?.trim() || displayHostPath(url),
    emoji,
    url,
    title: tab.title ?? null,
  });

  await setBinding(tabId, created.id);
  await refreshCachedTabs();
  await applyTrackedTitleBadge(tabId, created.emoji);
  return created;
}

export async function stopTracking(trackedTabId: string) {
  const state = await getLocalState();
  await Promise.all(getBoundTabIds(state.bindings, trackedTabId).map(clearTrackedTitleBadge));
  const api = await getApiClient();
  await api.trackedTabs.delete({ id: trackedTabId });
  await clearBindingsForTrackedTab(trackedTabId);
  await refreshCachedTabs();
}

export async function renameTrackedTab(id: string, name: string, emoji?: string | null) {
  const api = await getApiClient();
  const updated = await api.trackedTabs.rename({ id, name, emoji });
  await refreshCachedTabs();
  const state = await getLocalState();
  await Promise.all(getBoundTabIds(state.bindings, id).map((tabId) => applyTrackedTitleBadge(tabId, updated.emoji)));
  return updated;
}

export async function takeOver(trackedTabId: string, browserTabId?: number) {
  const device = await ensureDeviceRegistered();
  const api = await getApiClient();
  const updated = await api.trackedTabs.takeOver({
    id: trackedTabId,
    deviceId: device.id,
  });
  if (browserTabId !== undefined) {
    await setBinding(browserTabId, trackedTabId);
    await applyTrackedTitleBadge(browserTabId, updated.emoji);
  }
  await refreshCachedTabs();
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

  if (!state.sessionToken || !state.deviceId || !url) return;
  if (!isTrackableUrl(url)) return;

  const sanitized = sanitizeUrl(url, state.settings);
  if (isExcludedHost(sanitized, state.settings.excludedHosts)) return;
  const cleanTitle = stripTrackedTabBadge(title ?? null, tracked?.emoji) ?? null;

  if (
    tracked &&
    tracked.currentUrl === sanitized &&
    (tracked.currentTitle ?? null) === cleanTitle &&
    tracked.activeDeviceId === state.deviceId
  ) {
    return;
  }

  try {
    const api = await getApiClient();
    const result = await api.trackedTabs.updateLocation({
      id: trackedTabId,
      deviceId: state.deviceId,
      url: sanitized,
      title: cleanTitle,
    });
    if (!result.skipped) {
      await setLocalState({
        cachedTabs: state.cachedTabs.map((t) => (t.id === result.tab.id ? result.tab : t)),
      });
    }
  } catch (error) {
    // Ownership conflict — leave binding but don't push.
    console.warn("Failed to sync tracked tab location", error);
  }
}

export async function handleTabRemoved(tabId: number) {
  const state = await getLocalState();
  const trackedTabId = state.bindings[bindingKey(tabId)];
  if (!trackedTabId) return;

  await clearTrackedTitleBadge(tabId);
  await clearBinding(tabId);

  // Release active ownership if this device held it and no other local tab is bound.
  if (state.deviceId) {
    const stillBound = Object.values(
      (await getLocalState()).bindings,
    ).includes(trackedTabId);
    if (!stillBound) {
      try {
        const api = await getApiClient();
        await api.trackedTabs.release({ id: trackedTabId, deviceId: state.deviceId });
        await refreshCachedTabs();
      } catch (error) {
        console.warn("Failed to release tracked tab", error);
      }
    }
  }
}

/**
 * After a browser restart, try to reattach restored tabs to tracked items
 * last updated by this device. Ambiguous matches become reconnect prompts.
 */
export async function reconcileRestoredTabs() {
  const state = await getLocalState();
  if (!state.sessionToken || !state.deviceId) {
    await setLocalState({ pendingReconnect: [], bindings: {} });
    return;
  }

  let remoteTabs: TrackedTab[];
  try {
    remoteTabs = await refreshCachedTabs();
  } catch {
    return;
  }

  const owned = remoteTabs.filter((t) => t.lastUpdatedDeviceId === state.deviceId);
  const browserTabs = await browser.tabs.query({});
  const trackable = browserTabs.filter((t) => t.id !== undefined && isTrackableUrl(t.url));

  const newBindings: Record<string, string> = {};
  const pending: ReconnectCandidate[] = [];
  const claimedTracked = new Set<string>();
  const claimedBrowser = new Set<number>();

  // Exact unique URL matches first
  for (const tracked of owned) {
    const matches = trackable.filter((t) => {
      if (t.id === undefined || claimedBrowser.has(t.id)) return false;
      try {
        return sanitizeUrl(t.url!, state.settings) === tracked.currentUrl;
      } catch {
        return false;
      }
    });

    if (matches.length === 1 && matches[0]?.id !== undefined) {
      newBindings[bindingKey(matches[0].id)] = tracked.id;
      claimedTracked.add(tracked.id);
      claimedBrowser.add(matches[0].id);
    }
  }

  // Remaining owned tabs that still look open → ask user
  for (const tracked of owned) {
    if (claimedTracked.has(tracked.id)) continue;
    const matches = trackable.filter((t) => {
      if (t.id === undefined || claimedBrowser.has(t.id)) return false;
      try {
        return sanitizeUrl(t.url!, state.settings) === tracked.currentUrl;
      } catch {
        return false;
      }
    });
    for (const match of matches) {
      if (match.id === undefined) continue;
      pending.push({
        trackedTabId: tracked.id,
        trackedTabName: tracked.name,
        url: tracked.currentUrl,
        title: tracked.currentTitle,
        browserTabId: match.id,
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
        !(
          p.trackedTabId === candidate.trackedTabId &&
          p.browserTabId === candidate.browserTabId
        ),
    ),
  });
}

export async function dismissReconnect(candidate: ReconnectCandidate) {
  const state = await getLocalState();
  await setLocalState({
    pendingReconnect: state.pendingReconnect.filter(
      (p) =>
        !(
          p.trackedTabId === candidate.trackedTabId &&
          p.browserTabId === candidate.browserTabId
        ),
    ),
  });
}
