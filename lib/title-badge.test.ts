import { describe, expect, it } from "vitest";

import { addTrackedTabBadge, stripTrackedTabBadge } from "./title-badge";

describe("title badge helpers", () => {
  it("wraps the title with tildes", () => {
    expect(addTrackedTabBadge("Chapter 183")).toBe("~ Chapter 183 ~");
  });

  it("replaces an existing wrap or emoji prefix instead of duplicating it", () => {
    expect(addTrackedTabBadge("~ Chapter 183 ~")).toBe("~ Chapter 183 ~");
    expect(addTrackedTabBadge("📖 Chapter 183", "📖")).toBe("~ Chapter 183 ~");
    expect(addTrackedTabBadge("📌 Chapter 183")).toBe("~ Chapter 183 ~");
  });

  it("strips the tilde wrap and leftover tracked emoji prefixes", () => {
    expect(stripTrackedTabBadge("~ Chapter 183 ~")).toBe("Chapter 183");
    expect(stripTrackedTabBadge("📖 Chapter 183", "📖")).toBe("Chapter 183");
    expect(stripTrackedTabBadge("📌 Chapter 183")).toBe("Chapter 183");
    expect(stripTrackedTabBadge("Plain title")).toBe("Plain title");
  });

  it("keeps a tilde wrap even when the original title is empty", () => {
    expect(addTrackedTabBadge("")).toBe("~  ~");
    expect(stripTrackedTabBadge("~  ~")).toBe("");
  });
});
