import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../lib/types";
import { createExport, restoreExport } from "./export";

describe("versioned export", () => {
  it("verifies counts and checksum before import", async () => {
    const exported = await createExport(DEFAULT_SETTINGS);
    expect(exported).toMatchObject({ format: "trackingext-extension", version: 1 });
    expect(exported.checksum).toMatch(/^[0-9a-f]{64}$/);
    await expect(restoreExport(exported)).resolves.toEqual(DEFAULT_SETTINGS);
    await expect(restoreExport({ ...exported, checksum: "0".repeat(64) })).rejects.toThrow(
      "verification failed",
    );
  });
});
