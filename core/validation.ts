const RETENTION_DAYS = new Set([7, 30, 90]);

export function requiredText(value: string, name: string, max: number) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} is required`);
  if (normalized.length > max) throw new Error(`${name} must be at most ${max} characters`);
  return normalized;
}

export function normalizeTags(tags: string[]) {
  if (tags.length > 20) throw new Error("Use at most 20 tags");
  return [...new Set(tags.map((tag) => requiredText(tag, "Tag", 40).toLocaleLowerCase()))];
}

export function normalizeRetentionDays(value: number | null) {
  if (value === null || RETENTION_DAYS.has(value)) return value as 7 | 30 | 90 | null;
  throw new Error("History retention must be 7, 30, 90, or null");
}
