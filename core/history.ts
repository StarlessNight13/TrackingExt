export function historyCutoff(retentionDays: 7 | 30 | 90 | null, now = Date.now()) {
  return retentionDays === null ? null : now - retentionDays * 24 * 60 * 60 * 1000;
}
