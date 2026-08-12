import type { PopupSnapshot } from "./messaging";

export type LocalDashboardTab = "tabs" | "lan" | "settings";

export function usesWebDashboard(snapshot: PopupSnapshot) {
  return snapshot.syncModes.server && Boolean(snapshot.serverUrl) && snapshot.authenticated;
}

export function openWebDashboard(serverUrl: string, path = "/dashboard") {
  void browser.tabs.create({ url: new URL(path, `${serverUrl}/`).toString() });
}

export function openLocalDashboard(tab: LocalDashboardTab = "tabs") {
  const hash = tab === "tabs" ? "" : `#${tab}`;
  void browser.tabs.create({ url: browser.runtime.getURL(`/dashboard.html${hash}`) });
}

export function openDashboard(snapshot: PopupSnapshot, tab: LocalDashboardTab = "tabs") {
  if (usesWebDashboard(snapshot)) {
    openWebDashboard(snapshot.serverUrl!);
    return;
  }
  openLocalDashboard(tab);
}

export function parseLocalDashboardTab(hash: string): LocalDashboardTab {
  const value = hash.replace(/^#/, "");
  if (value === "lan" || value === "settings" || value === "tabs") return value;
  return "tabs";
}
