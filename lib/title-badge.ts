export const DEFAULT_TRACKED_TAB_EMOJI = "📌";

export function getTrackedTabBadge(emoji?: string | null) {
  const trimmed = emoji?.trim();
  return trimmed ? trimmed : DEFAULT_TRACKED_TAB_EMOJI;
}

export function stripTrackedTabBadge(title?: string | null, emoji?: string | null) {
  if (!title) return title ?? "";

  const badges = new Set([getTrackedTabBadge(emoji), DEFAULT_TRACKED_TAB_EMOJI]);
  for (const badge of badges) {
    if (title === badge) {
      return "";
    }
    const prefix = `${badge} `;
    if (title.startsWith(prefix)) {
      return title.slice(prefix.length).trimStart();
    }
  }

  return title;
}

export function addTrackedTabBadge(title?: string | null, emoji?: string | null) {
  const badge = getTrackedTabBadge(emoji);
  const cleanTitle = stripTrackedTabBadge(title, emoji)?.trim();
  return cleanTitle ? `${badge} ${cleanTitle}` : badge;
}
