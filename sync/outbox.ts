import type { TrackedTabRecord } from "../core/entities";
import { createId } from "../core/ids";
import { cacheTabAndEnqueue, type OutboxKind, type OutboxOperation } from "../storage/indexed-db";

export function createOperation(input: {
  kind: OutboxKind;
  tab: TrackedTabRecord;
  baseRevision: number | null;
  payload: Record<string, unknown>;
  now?: number;
}): OutboxOperation {
  const now = input.now ?? Date.now();
  return {
    version: 1,
    operationId: createId("op"),
    entityType: "tab",
    entityId: input.tab.id,
    kind: input.kind,
    baseRevision: input.baseRevision,
    payload: input.payload,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
    lastError: null,
  };
}

export async function enqueueOptimisticTab(
  tab: TrackedTabRecord,
  kind: OutboxKind,
  payload: Record<string, unknown>,
) {
  const operation = createOperation({ kind, tab, baseRevision: tab.revision, payload });
  await cacheTabAndEnqueue(tab, operation);
  return operation;
}
