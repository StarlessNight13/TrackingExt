export const DEFAULT_TRACKED_TAB_EMOJI = "📌";

function unwrapTildeTitle(title: string) {
  const trimmed = title.trim();
  if (trimmed.startsWith("~ ") && trimmed.endsWith(" ~") && trimmed.length >= 4) {
    return trimmed.slice(2, -2).trim();
  }
  return title;
}

function stripEmojiPrefix(title: string, emoji?: string | null) {
  const badges = new Set(
    [emoji?.trim(), DEFAULT_TRACKED_TAB_EMOJI].filter((value): value is string => Boolean(value)),
  );

  for (const badge of badges) {
    if (title === badge) return "";
    const prefix = `${badge} `;
    if (title.startsWith(prefix)) {
      return title.slice(prefix.length).trimStart();
    }
  }

  return title;
}

export function stripTrackedTabBadge(title?: string | null, emoji?: string | null) {
  if (!title) return title ?? "";
  return stripEmojiPrefix(unwrapTildeTitle(title), emoji);
}

export function addTrackedTabBadge(title?: string | null, emoji?: string | null) {
  const cleanTitle = stripTrackedTabBadge(title, emoji)?.trim();
  return cleanTitle ? `~ ${cleanTitle} ~` : "~  ~";
}
