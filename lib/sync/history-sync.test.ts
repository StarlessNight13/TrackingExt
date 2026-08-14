import { describe, expect, it } from "vitest";

import { mergeHistoryEntries } from "./history-sync";

describe("mergeHistoryEntries", () => {
  it("deduplicates by url and visitedAt", () => {
    const merged = mergeHistoryEntries(
      [{ id: "1", url: "https://a.com/1", title: "A", visitedAt: "2026-01-01T00:00:00.000Z" }],
      [
        {
          id: "2",
          url: "https://a.com/1",
          title: "A duplicate",
          visitedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    );
    expect(merged).toHaveLength(1);
  });

  it("sorts newest first and caps at 200", () => {
    const existing = Array.from({ length: 150 }, (_, index) => ({
      id: `e-${index}`,
      url: `https://example.com/${index}`,
      title: null,
      visitedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    }));
    const incoming = Array.from({ length: 100 }, (_, index) => ({
      id: `i-${index}`,
      url: `https://example.com/new-${index}`,
      title: null,
      visitedAt: new Date(Date.UTC(2026, 0, 2, 0, 0, index)).toISOString(),
    }));

    const merged = mergeHistoryEntries(existing, incoming);
    expect(merged.length).toBeLessThanOrEqual(200);
    expect(merged[0]?.url).toBe("https://example.com/new-99");
  });
});
