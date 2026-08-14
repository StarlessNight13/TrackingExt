import type { PrivacySettings } from "../lib/types";
import { exportIndexedDb, importIndexedDb, type IndexedDbExport } from "./indexed-db";

export type TrackingExtExport = {
  format: "trackingext-extension";
  version: 1;
  exportedAt: string;
  settings: PrivacySettings;
  data: IndexedDbExport;
  recordCounts: { tabs: number; outbox: number; conflicts: number };
  checksum: string;
};

async function checksum(data: IndexedDbExport) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createExport(settings: PrivacySettings): Promise<TrackingExtExport> {
  const data = await exportIndexedDb();
  return {
    format: "trackingext-extension",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    data,
    recordCounts: {
      tabs: data.tabs.length,
      outbox: data.outbox.length,
      conflicts: data.conflicts.length,
    },
    checksum: await checksum(data),
  };
}

export async function restoreExport(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Invalid TabTether export");
  const data = value as Partial<TrackingExtExport>;
  if (
    data.format !== "trackingext-extension" ||
    data.version !== 1 ||
    !data.data ||
    !data.settings ||
    !data.recordCounts ||
    !data.checksum
  ) {
    throw new Error("Unsupported TabTether export version");
  }
  if (
    data.recordCounts.tabs !== data.data.tabs.length ||
    data.recordCounts.outbox !== data.data.outbox.length ||
    data.recordCounts.conflicts !== data.data.conflicts.length ||
    data.checksum !== (await checksum(data.data))
  ) {
    throw new Error("TabTether export verification failed");
  }
  await importIndexedDb(data.data);
  return data.settings;
}
