/** Firefox session-store key for the tethered activity id (extension-private). */
export const TABTETHER_ACTIVITY_SESSION_KEY = "tabtether.activityId";

type TabSessionsApi = {
  setTabValue: (tabId: number, key: string, value: string) => Promise<void>;
  getTabValue: (tabId: number, key: string) => Promise<unknown>;
  removeTabValue: (tabId: number, key: string) => Promise<void>;
};

function tabSessionsApi(): TabSessionsApi | null {
  const sessions = (browser as { sessions?: Partial<TabSessionsApi> }).sessions;
  if (
    typeof sessions?.setTabValue !== "function" ||
    typeof sessions?.getTabValue !== "function" ||
    typeof sessions?.removeTabValue !== "function"
  ) {
    return null;
  }
  return sessions as TabSessionsApi;
}

/** True when Firefox-style per-tab session values are available. */
export function supportsTabSessionBindings(): boolean {
  return tabSessionsApi() !== null;
}

export async function writeTabActivityId(tabId: number, activityId: string): Promise<void> {
  const sessions = tabSessionsApi();
  if (!sessions) return;
  try {
    await sessions.setTabValue(tabId, TABTETHER_ACTIVITY_SESSION_KEY, activityId);
  } catch (error) {
    console.warn("Failed to store tab session activity id", error);
  }
}

export async function readTabActivityId(tabId: number): Promise<string | null> {
  const sessions = tabSessionsApi();
  if (!sessions) return null;
  try {
    const value = await sessions.getTabValue(tabId, TABTETHER_ACTIVITY_SESSION_KEY);
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch (error) {
    console.warn("Failed to read tab session activity id", error);
    return null;
  }
}

export async function clearTabActivityId(tabId: number): Promise<void> {
  const sessions = tabSessionsApi();
  if (!sessions) return;
  try {
    await sessions.removeTabValue(tabId, TABTETHER_ACTIVITY_SESSION_KEY);
  } catch (error) {
    console.warn("Failed to clear tab session activity id", error);
  }
}
