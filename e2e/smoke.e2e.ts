import { findTabId, tetherTab, waitForPopupReady } from "./helpers";
import { expect, test } from "./fixtures";

test.describe("TabTether Chromium smoke", () => {
  test("loads the extension service worker", async ({ extensionId, serviceWorker }) => {
    expect(extensionId.length).toBeGreaterThan(0);
    expect(serviceWorker.url()).toContain(`chrome-extension://${extensionId}/`);
  });

  test("tethers example.com and opens the dashboard", async ({
    context,
    openPopup,
    openDashboard,
    serviceWorker,
  }) => {
    const site = await context.newPage();
    await site.goto("https://example.com/");
    await expect(site.getByRole("heading", { name: "Example Domain" })).toBeVisible();

    const popup = await openPopup();
    await expect(popup).toHaveTitle(/TabTether/);
    await waitForPopupReady(popup);

    const tabId = await findTabId(serviceWorker, "https://example.com");
    await tetherTab(popup, tabId, "Example activity");

    const dashboard = await openDashboard();
    await expect(dashboard.getByRole("heading", { name: "TabTether" }).first()).toBeVisible();
    await expect(dashboard.getByText("Example activity")).toBeVisible();
  });
});
