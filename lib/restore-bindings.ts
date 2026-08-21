import { isTrackableUrl, sanitizeUrl } from "./privacy";
import { stripTrackedTabBadge } from "./title-badge";
import type {
  PrivacySettings,
  ReconnectCandidate,
  RestoreFingerprint,
  TrackedTab,
} from "./types";

/** Absolute minimum score to auto-bind when URL is not a unique 1:1 shortcut. */
export const RESTORE_SCORE_MIN = 70;
/** Best pair must beat the next claimant for the same browser tab by this margin. */
export const RESTORE_SCORE_MARGIN = 12;

const SCORE_URL = 55;
const SCORE_TITLE_EXACT = 18;
const SCORE_TITLE_HIGH = 14;
const SCORE_TITLE_MID = 8;
const SCORE_PINNED = 8;
const SCORE_PINNED_MISMATCH = -10;
const SCORE_INDEX_MAX = 6;
const SCORE_WINDOW_ORDINAL = 5;
const SCORE_WINDOW_COUNT = 2;
const SCORE_LAST_ACCESSED_MAX = 4;
const SCORE_OPENER = 6;
const SCORE_GROUP = 2;

export type RestorableBrowserTab = {
  id?: number;
  url?: string;
  pendingUrl?: string;
  title?: string;
  pinned?: boolean;
  index?: number;
  windowId?: number;
  openerTabId?: number;
  lastAccessed?: number;
  groupId?: number;
  incognito?: boolean;
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

export type SessionRestorableBrowserTab = RestorableBrowserTab & {
  /** Activity id from browser.sessions.getTabValue, when available. */
  sessionActivityId?: string | null;
};

function isRestorableActivity(tab: TrackedTab, ownedIds: Set<string>) {
  if (tab.deletedAt) return false;
  if (tab.archivedAt) return false;
  if (tab.lastUpdatedDeviceId && !ownedIds.has(tab.lastUpdatedDeviceId)) return false;
  return true;
}

/**
 * Prefer session-store activity ids over URL heuristics.
 * When multiple restored tabs claim the same activity, prefer the tab whose
 * URL matches the activity, otherwise the first claimant wins.
 */
export function claimSessionRestoredBindings(
  browserTabs: SessionRestorableBrowserTab[],
  activities: TrackedTab[],
  settings: PrivacySettings,
  deviceIds: Iterable<string>,
): { bindings: Record<string, string>; claimedActivityIds: Set<string> } {
  const ownedIds = new Set(deviceIds);
  const byId = new Map(
    activities.filter((tab) => isRestorableActivity(tab, ownedIds)).map((tab) => [tab.id, tab]),
  );

  const candidatesByActivity = new Map<string, SessionRestorableBrowserTab[]>();
  for (const tab of browserTabs) {
    if (tab.id === undefined) continue;
    const activityId = tab.sessionActivityId;
    if (typeof activityId !== "string" || activityId.length === 0) continue;
    if (!byId.has(activityId)) continue;
    const list = candidatesByActivity.get(activityId);
    if (list) list.push(tab);
    else candidatesByActivity.set(activityId, [tab]);
  }

  const bindings: Record<string, string> = {};
  const claimedActivityIds = new Set<string>();

  for (const [activityId, candidates] of candidatesByActivity) {
    const activity = byId.get(activityId);
    if (!activity) continue;

    let winner = candidates[0]!;
    if (candidates.length > 1) {
      const activityKey = restoreMatchKey(activity.currentUrl, settings);
      const urlMatch = candidates.find((tab) => {
        const raw = tabRestoreUrl(tab);
        if (!raw || !activityKey) return false;
        return restoreMatchKey(raw, settings) === activityKey;
      });
      if (urlMatch) winner = urlMatch;
    }

    if (winner.id === undefined) continue;
    bindings[String(winner.id)] = activityId;
    claimedActivityIds.add(activityId);
  }

  return { bindings, claimedActivityIds };
}

export function normalizeRestoreTitle(title?: string | null, emoji?: string | null): string {
  return stripTrackedTabBadge(title ?? null, emoji).trim().toLowerCase();
}

/** Token Jaccard similarity in [0, 1]. */
export function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) {
    // Fall back to character overlap for short titles without spaces.
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (longer.includes(shorter) && shorter.length >= 3) {
      return shorter.length / longer.length;
    }
    return 0;
  }
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function titleScore(activityTitle: string, tabTitle: string): number {
  const sim = titleSimilarity(activityTitle, tabTitle);
  if (sim >= 1) return SCORE_TITLE_EXACT;
  if (sim >= 0.85) return SCORE_TITLE_HIGH;
  if (sim >= 0.7) return SCORE_TITLE_MID;
  return 0;
}

export function windowOrdinals(tabs: RestorableBrowserTab[]): Map<number, number> {
  const ids = [
    ...new Set(
      tabs.flatMap((tab) => (typeof tab.windowId === "number" ? [tab.windowId] : [])),
    ),
  ].sort((a, b) => a - b);
  return new Map(ids.map((id, ordinal) => [id, ordinal]));
}

type ActivityFingerprint = {
  activity: TrackedTab;
  urlKey: string;
  title: string;
  pinned: boolean | null;
  index: number | null;
  windowOrdinal: number | null;
  windowTabCount: number | null;
  openerActivityId: string | null;
  lastAccessed: number | null;
  groupId: number | null;
  incognito: boolean | null;
};

function resolveActivityFingerprint(
  activity: TrackedTab,
  fingerprints: Record<string, RestoreFingerprint>,
  settings: PrivacySettings,
): ActivityFingerprint | null {
  const stored = fingerprints[activity.id];
  const urlKey =
    stored?.urlKey ?? restoreMatchKey(activity.currentUrl, settings) ?? null;
  if (!urlKey) return null;

  return {
    activity,
    urlKey,
    title: normalizeRestoreTitle(
      stored?.title ?? activity.currentTitle,
      activity.emoji,
    ),
    pinned: stored ? stored.pinned : null,
    index: stored ? stored.index : null,
    windowOrdinal: stored ? stored.windowOrdinal : null,
    windowTabCount: stored ? stored.windowTabCount : null,
    openerActivityId: stored?.openerActivityId ?? null,
    lastAccessed: stored?.lastAccessed ?? null,
    groupId: stored?.groupId ?? null,
    incognito: stored ? stored.incognito : null,
  };
}

type ScoredEdge = {
  tabId: number;
  activityId: string;
  urlKey: string;
  score: number;
  uniqueUrlShortcut: boolean;
};

function scorePair(input: {
  tab: RestorableBrowserTab;
  tabTitle: string;
  tabWindowOrdinal: number | null;
  windowTabCounts: Map<number, number>;
  fingerprint: ActivityFingerprint;
  openerBoundActivityId: string | null;
}): number {
  let score = SCORE_URL;

  score += titleScore(input.fingerprint.title, input.tabTitle);

  if (input.fingerprint.pinned !== null && typeof input.tab.pinned === "boolean") {
    score += input.fingerprint.pinned === input.tab.pinned ? SCORE_PINNED : SCORE_PINNED_MISMATCH;
  }

  if (
    input.fingerprint.index !== null &&
    typeof input.tab.index === "number" &&
    Number.isFinite(input.tab.index)
  ) {
    score += Math.max(0, SCORE_INDEX_MAX - Math.abs(input.fingerprint.index - input.tab.index));
  }

  if (
    input.fingerprint.windowOrdinal !== null &&
    input.tabWindowOrdinal !== null &&
    input.fingerprint.windowOrdinal === input.tabWindowOrdinal
  ) {
    score += SCORE_WINDOW_ORDINAL;
  }

  if (
    input.fingerprint.windowTabCount !== null &&
    typeof input.tab.windowId === "number"
  ) {
    const count = input.windowTabCounts.get(input.tab.windowId);
    if (count !== undefined && count === input.fingerprint.windowTabCount) {
      score += SCORE_WINDOW_COUNT;
    }
  }

  if (
    input.fingerprint.lastAccessed !== null &&
    typeof input.tab.lastAccessed === "number" &&
    Number.isFinite(input.tab.lastAccessed)
  ) {
    // Soft proximity in ms buckets; identical timestamps score full points.
    const delta = Math.abs(input.fingerprint.lastAccessed - input.tab.lastAccessed);
    if (delta === 0) score += SCORE_LAST_ACCESSED_MAX;
    else if (delta < 60_000) score += 3;
    else if (delta < 10 * 60_000) score += 2;
    else if (delta < 60 * 60_000) score += 1;
  }

  if (
    input.fingerprint.openerActivityId &&
    input.openerBoundActivityId &&
    input.fingerprint.openerActivityId === input.openerBoundActivityId
  ) {
    score += SCORE_OPENER;
  }

  if (
    input.fingerprint.groupId !== null &&
    typeof input.tab.groupId === "number" &&
    input.tab.groupId !== -1 &&
    input.fingerprint.groupId === input.tab.groupId
  ) {
    score += SCORE_GROUP;
  }

  return Math.max(0, Math.min(100, score));
}

function uniqueUrlHardConflict(fingerprint: ActivityFingerprint, tab: RestorableBrowserTab): boolean {
  if (fingerprint.pinned !== null && typeof tab.pinned === "boolean") {
    if (fingerprint.pinned !== tab.pinned) {
      const tabTitle = normalizeRestoreTitle(tab.title);
      const sim = titleSimilarity(fingerprint.title, tabTitle);
      if (sim < 0.5) return true;
    }
  }
  return false;
}

/**
 * Scored restore matcher. Exact normalized URL is required for auto-bind.
 * Auto-binds only when a pairing is a clear unique winner; otherwise pending.
 */
export function matchRestoredBindings(
  browserTabs: RestorableBrowserTab[],
  activities: TrackedTab[],
  settings: PrivacySettings,
  deviceIds: Iterable<string>,
  fingerprints: Record<string, RestoreFingerprint> = {},
  options?: {
    /** activityId already bound via session / prior pass — used for opener bonus. */
    priorBindings?: Record<string, string>;
  },
): { bindings: Record<string, string>; pending: ReconnectCandidate[] } {
  const ownedIds = new Set(deviceIds);
  const owned = activities.filter((tab) => isRestorableActivity(tab, ownedIds));

  const activityFingerprints = owned
    .map((activity) => resolveActivityFingerprint(activity, fingerprints, settings))
    .filter((fp): fp is ActivityFingerprint => fp !== null);

  const byUrl = new Map<string, ActivityFingerprint[]>();
  for (const fp of activityFingerprints) {
    const list = byUrl.get(fp.urlKey);
    if (list) list.push(fp);
    else byUrl.set(fp.urlKey, [fp]);
  }

  const ordinals = windowOrdinals(browserTabs);
  const windowTabCounts = new Map<number, number>();
  for (const tab of browserTabs) {
    if (typeof tab.windowId !== "number") continue;
    windowTabCounts.set(tab.windowId, (windowTabCounts.get(tab.windowId) ?? 0) + 1);
  }

  const priorByTabId = options?.priorBindings ?? {};
  const openerActivityByTabId = new Map<number, string>();
  for (const [tabId, activityId] of Object.entries(priorByTabId)) {
    openerActivityByTabId.set(Number(tabId), activityId);
  }

  const tabsByUrl = new Map<string, RestorableBrowserTab[]>();
  for (const tab of browserTabs) {
    if (tab.id === undefined) continue;
    const rawUrl = tabRestoreUrl(tab);
    if (!rawUrl) continue;
    const key = restoreMatchKey(rawUrl, settings);
    if (!key) continue;
    if (typeof tab.incognito === "boolean") {
      // Filtered per-pair below when fingerprint knows incognito.
    }
    const list = tabsByUrl.get(key);
    if (list) list.push(tab);
    else tabsByUrl.set(key, [tab]);
  }

  const edges: ScoredEdge[] = [];

  for (const [urlKey, urlTabs] of tabsByUrl) {
    const urlActivities = byUrl.get(urlKey) ?? [];
    if (urlActivities.length === 0) continue;

    const uniqueShortcut = urlTabs.length === 1 && urlActivities.length === 1;

    for (const tab of urlTabs) {
      if (tab.id === undefined) continue;
      const tabTitle = normalizeRestoreTitle(tab.title);
      const tabWindowOrdinal =
        typeof tab.windowId === "number" ? (ordinals.get(tab.windowId) ?? null) : null;
      const openerBound =
        typeof tab.openerTabId === "number"
          ? (openerActivityByTabId.get(tab.openerTabId) ?? null)
          : null;

      for (const fingerprint of urlActivities) {
        if (
          fingerprint.incognito !== null &&
          typeof tab.incognito === "boolean" &&
          fingerprint.incognito !== tab.incognito
        ) {
          continue;
        }

        const hardConflict = uniqueShortcut && uniqueUrlHardConflict(fingerprint, tab);
        const score = scorePair({
          tab,
          tabTitle,
          tabWindowOrdinal,
          windowTabCounts,
          fingerprint,
          openerBoundActivityId: openerBound,
        });

        edges.push({
          tabId: tab.id,
          activityId: fingerprint.activity.id,
          urlKey,
          score,
          // 1:1 URL still auto-binds unless layout/title strongly conflict.
          uniqueUrlShortcut: uniqueShortcut && !hardConflict,
        });
      }
    }
  }

  edges.sort((a, b) => b.score - a.score || a.tabId - b.tabId || a.activityId.localeCompare(b.activityId));

  const edgesByTab = new Map<number, ScoredEdge[]>();
  const edgesByActivity = new Map<string, ScoredEdge[]>();
  for (const edge of edges) {
    const tabList = edgesByTab.get(edge.tabId);
    if (tabList) tabList.push(edge);
    else edgesByTab.set(edge.tabId, [edge]);
    const activityList = edgesByActivity.get(edge.activityId);
    if (activityList) activityList.push(edge);
    else edgesByActivity.set(edge.activityId, [edge]);
  }

  const bindings: Record<string, string> = {};
  const usedTabs = new Set<number>();
  const usedActivities = new Set<string>();

  function canAutoBind(edge: ScoredEdge): boolean {
    if (edge.uniqueUrlShortcut) return true;
    if (edge.score < RESTORE_SCORE_MIN) return false;

    const tabEdges = (edgesByTab.get(edge.tabId) ?? []).filter(
      (e) => !usedActivities.has(e.activityId) || e.activityId === edge.activityId,
    );
    const activityEdges = (edgesByActivity.get(edge.activityId) ?? []).filter(
      (e) => !usedTabs.has(e.tabId) || e.tabId === edge.tabId,
    );

    const tabBest = tabEdges[0];
    const tabSecond = tabEdges.find((e) => e.activityId !== edge.activityId);
    if (!tabBest || tabBest.activityId !== edge.activityId) return false;
    if (tabSecond && edge.score - tabSecond.score < RESTORE_SCORE_MARGIN) return false;

    const activityBest = activityEdges[0];
    const activitySecond = activityEdges.find((e) => e.tabId !== edge.tabId);
    if (!activityBest || activityBest.tabId !== edge.tabId) return false;
    if (activitySecond && edge.score - activitySecond.score < RESTORE_SCORE_MARGIN) {
      return false;
    }

    return true;
  }

  for (const edge of edges) {
    if (usedTabs.has(edge.tabId) || usedActivities.has(edge.activityId)) continue;
    if (!canAutoBind(edge)) continue;
    bindings[String(edge.tabId)] = edge.activityId;
    usedTabs.add(edge.tabId);
    usedActivities.add(edge.activityId);
  }

  const pending: ReconnectCandidate[] = [];
  const pendingSeen = new Set<string>();
  const activityById = new Map(owned.map((tab) => [tab.id, tab]));

  for (const edge of edges) {
    if (bindings[String(edge.tabId)] === edge.activityId) continue;
    if (usedTabs.has(edge.tabId) && bindings[String(edge.tabId)]) continue;
    if (usedActivities.has(edge.activityId) && !bindings[String(edge.tabId)]) {
      // Activity already bound to another tab — still offer pending for unbound tabs
      // only when this tab itself is unbound.
    }
    if (bindings[String(edge.tabId)]) continue;
    if (usedActivities.has(edge.activityId)) continue;

    const key = `${edge.activityId}:${edge.tabId}`;
    if (pendingSeen.has(key)) continue;
    pendingSeen.add(key);
    const tracked = activityById.get(edge.activityId);
    if (!tracked) continue;
    pending.push({
      trackedTabId: tracked.id,
      trackedTabName: tracked.name,
      url: tracked.currentUrl,
      title: tracked.currentTitle,
      browserTabId: edge.tabId,
    });
  }

  return { bindings, pending };
}
