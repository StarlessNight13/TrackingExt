export type WriteConflictReason =
  | "stale_revision"
  | "ownership"
  | "deleted"
  | "archived"
  | "missing";

export type WriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: WriteConflictReason; current: T | null };
