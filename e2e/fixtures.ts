import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const extensionPath = path.join(rootDir, ".output", "chrome-mv3");

type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  openPopup: () => Promise<Page>;
  openDashboard: (hash?: string) => Promise<Page>;
};

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    if (!fs.existsSync(path.join(extensionPath, "manifest.json"))) {
      throw new Error(
        `Missing Chrome build at ${extensionPath}. Run \`bun run build\` first.`,
      );
    }

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tabtether-e2e-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      // Bundled Chromium + channel allows extension loading in headless.
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  serviceWorker: async ({ context }, use) => {
    let worker = context.serviceWorkers()[0];
    if (!worker) {
      worker = await context.waitForEvent("serviceworker");
    }
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    const extensionId = serviceWorker.url().split("/")[2];
    if (!extensionId) {
      throw new Error(`Could not derive extension id from ${serviceWorker.url()}`);
    }
    await use(extensionId);
  },

  openPopup: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      return page;
    });
  },

  openDashboard: async ({ context, extensionId }, use) => {
    await use(async (hash = "") => {
      const page = await context.newPage();
      const suffix = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
      await page.goto(`chrome-extension://${extensionId}/dashboard.html${suffix}`);
      return page;
    });
  },
});

export { expect };
