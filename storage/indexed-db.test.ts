import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import type { TrackedTabRecord } from "../core/entities";
import {
  cacheTabAndEnqueue,
  listCachedTabs,
  listDatabaseLogs,
  listPendingOperations,
  type OutboxOperation,
} from "./indexed-db";

const tab: TrackedTabRecord = {
  id: "tab_1",
  workspaceId: "ws_1",
  groupId: null,
  name: "One",
  emoji: null,
  tags: "[]",
  currentUrl: "https://example.com/1",
  currentTitle: null,
  activeDeviceId: "dev_1",
  lastUpdatedDeviceId: "dev_1",
  isPrivate: 0,
  archivedAt: null,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};

function operation(
  operationId: string,
  kind: OutboxOperation["kind"],
  createdAt: number,
): OutboxOperation {
  return {
    version: 1,
    operationId,
    entityType: "tab",
    entityId: tab.id,
    kind,
    baseRevision: 1,
    payload: {},
    createdAt,
    attempts: 0,
    nextAttemptAt: createdAt,
    lastError: null,
  };
}

describe("IndexedDB cache and outbox", () => {
  it("writes optimistically and coalesces only location updates", async () => {
    await cacheTabAndEnqueue(tab, operation("rename", "rename", 1));
    await cacheTabAndEnqueue(
      { ...tab, currentUrl: "https://example.com/2", updatedAt: 2 },
      operation("location-1", "update_location", 2),
    );
    await cacheTabAndEnqueue(
      { ...tab, currentUrl: "https://example.com/3", updatedAt: 3 },
      operation("location-2", "update_location", 3),
    );

    expect((await listCachedTabs())[0]?.currentUrl).toBe("https://example.com/3");
    expect((await listPendingOperations(10)).map((item) => item.operationId)).toEqual([
      "rename",
      "location-2",
    ]);
    expect((await listDatabaseLogs()).map((item) => item.operation)).toEqual([
      "update_location",
      "update_location",
      "rename",
    ]);
  });
});
