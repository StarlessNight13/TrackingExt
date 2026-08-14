import type { PopupSnapshot } from "./messaging";

export type LocalDashboardTab = "tabs" | "groups" | "devices" | "lan" | "database" | "settings";

export function openLocalDashboard(tab: LocalDashboardTab = "tabs") {
  const hash = tab === "tabs" ? "" : `#${tab}`;
  void browser.tabs.create({ url: browser.runtime.getURL(`/dashboard.html${hash}`) });
}

export function openDashboard(_snapshot: PopupSnapshot, tab: LocalDashboardTab = "tabs") {
  openLocalDashboard(tab);
}

export function parseLocalDashboardTab(hash: string): LocalDashboardTab {
  const value = hash.replace(/^#/, "");
  if (["tabs", "groups", "devices", "lan", "database", "settings"].includes(value)) {
    return value as LocalDashboardTab;
  }
  return "tabs";
}
