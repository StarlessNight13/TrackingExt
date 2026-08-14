import { describe, expect, it } from "vitest";

import type { TrackedTabRecord } from "../core/entities";
import { retryDelay } from "../storage/indexed-db";
import { createOperation } from "./outbox";

const tab: TrackedTabRecord = {
  id: "tab_1",
  workspaceId: "ws_1",
  groupId: null,
  name: "One",
  emoji: null,
  tags: "[]",
  currentUrl: "https://example.com",
  currentTitle: null,
  activeDeviceId: "dev_1",
  lastUpdatedDeviceId: "dev_1",
  isPrivate: 0,
  archivedAt: null,
  revision: 2,
  createdAt: 1,
  updatedAt: 2,
  deletedAt: null,
};

describe("outbox", () => {
  it("creates a versioned immediately eligible operation", () => {
    const operation = createOperation({
      kind: "rename",
      tab,
      baseRevision: tab.revision,
      payload: { name: "Two" },
      now: 100,
    });
    expect(operation).toMatchObject({
      version: 1,
      entityId: "tab_1",
      baseRevision: 2,
      createdAt: 100,
      nextAttemptAt: 100,
      attempts: 0,
    });
  });

  it("caps exponential retry delay at one hour", () => {
    expect(retryDelay(1)).toBe(2_000);
    expect(retryDelay(20)).toBe(3_600_000);
  });
});
