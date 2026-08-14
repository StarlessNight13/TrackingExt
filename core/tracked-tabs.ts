import { createId } from "./ids";
import { normalizeTags, requiredText } from "./validation";

export function hasSameHostname(firstUrl: string, secondUrl: string) {
  try {
    return (
      new URL(firstUrl).hostname.toLocaleLowerCase() ===
      new URL(secondUrl).hostname.toLocaleLowerCase()
    );
  } catch {
    return false;
  }
}

export function newTrackedTab(input: {
  name: string;
  url: string;
  emoji?: string;
  tags?: string[];
}) {
  const url = new URL(input.url).toString();
  if (input.emoji && input.emoji.length > 8) throw new Error("Emoji must be at most 8 characters");
  return {
    id: createId("tab"),
    name: requiredText(input.name, "Activity name", 120),
    url,
    emoji: input.emoji ?? null,
    tags: normalizeTags(input.tags ?? []),
  };
}
