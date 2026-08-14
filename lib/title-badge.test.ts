import { describe, expect, it } from "vitest";

import { DEFAULT_TRACKED_TAB_EMOJI, addTrackedTabBadge, stripTrackedTabBadge } from "./title-badge";

describe("title badge helpers", () => {
  it("adds the default badge when no emoji is provided", () => {
    expect(addTrackedTabBadge("Chapter 183")).toBe(`${DEFAULT_TRACKED_TAB_EMOJI} Chapter 183`);
  });

  it("replaces an existing tracked badge instead of duplicating it", () => {
    expect(addTrackedTabBadge("📖 Chapter 183", "📖")).toBe("📖 Chapter 183");
    expect(addTrackedTabBadge("📌 Chapter 183", "📖")).toBe("📖 Chapter 183");
  });

  it("strips only the tracked badge prefix", () => {
    expect(stripTrackedTabBadge("📖 Chapter 183", "📖")).toBe("Chapter 183");
    expect(stripTrackedTabBadge("📌 Chapter 183")).toBe("Chapter 183");
    expect(stripTrackedTabBadge("Plain title", "📖")).toBe("Plain title");
  });
});
