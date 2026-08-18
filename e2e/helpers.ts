import type { Page, Worker } from "@playwright/test";

import { expect } from "./fixtures";

/** Wait for the popup UI to finish loading. */
export async function waitForPopupReady(popup: Page) {
  await expect(popup.getByRole("heading", { name: "TabTether" })).toBeVisible();
  await expect(popup.getByRole("heading", { name: "Current page" })).toBeVisible();
}

/**
 * Opening popup.html as a normal tab makes that tab "active", so the UI cannot
 * see example.com. TRACK_TAB accepts an explicit tabId for this case.
 */
export async function tetherTab(
  popup: Page,
  tabId: number,
  name = "Example activity",
) {
  const response = await popup.evaluate(
    async ({ tabId: id, name: activityName }) => {
      return await chrome.runtime.sendMessage({
        type: "TRACK_TAB",
        tabId: id,
        name: activityName,
      });
    },
    { tabId, name },
  );

  if (!response?.ok) {
    throw new Error(response?.error ?? "TRACK_TAB failed");
  }

  await popup.reload();
  await expect(popup.getByRole("heading", { name: "Tethered tabs" })).toBeVisible();
  await expect(popup.getByText(name)).toBeVisible();
}

export async function findTabId(serviceWorker: Worker, urlPrefix: string) {
  const tabId = await serviceWorker.evaluate(async (prefix) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url?.startsWith(prefix))?.id ?? null;
  }, urlPrefix);

  if (tabId === null) {
    throw new Error(`No tab found for ${urlPrefix}`);
  }

  return tabId;
}
