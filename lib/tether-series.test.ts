import { describe, expect, it } from "vitest";

import {
  applyManualSeriesPatterns,
  createInitialSeriesPattern,
  evaluateSeriesTether,
  learnSeriesPattern,
  matchesSeriesPattern,
  observationFromPage,
  recordSeriesNavigation,
} from "./tether-series";

describe("tether-series", () => {
  it("learns a numeric chapter pattern from repeated URL changes", () => {
    const urls = [
      "https://reader.test/series/one-piece/chapter-1001",
      "https://reader.test/series/one-piece/chapter-1002",
      "https://reader.test/series/one-piece/chapter-1003",
      "https://reader.test/series/one-piece/chapter-1004",
    ];
    const observations = urls.map((url) => observationFromPage(url, `One Piece ${url.split("-").at(-1)}`));
    const learned = learnSeriesPattern(observations);

    expect(learned.urlPattern).toContain("one-piece/chapter-");
    expect(learned.stableTokens.some((token) => token.includes("one-piece"))).toBe(true);

    const pattern = {
      status: "ready" as const,
      anchorHostname: "reader.test",
      observations,
      navigationCount: 3,
      stableTokens: learned.stableTokens,
      changingHints: learned.changingHints,
      urlPattern: learned.urlPattern,
      titlePattern: learned.titlePattern,
    };

    expect(
      matchesSeriesPattern(pattern, "https://reader.test/series/one-piece/chapter-1005", "One Piece 1005"),
    ).toBe(true);
    expect(
      matchesSeriesPattern(
        pattern,
        "https://reader.test/series/naruto/chapter-1",
        "Naruto 1",
      ),
    ).toBe(false);
  });

  it("records three navigations before marking the pattern ready", () => {
    let pattern = createInitialSeriesPattern(
      "https://example.com/show/ep-1",
      "Show - Episode 1",
    );

    pattern = recordSeriesNavigation(pattern, "https://example.com/show/ep-2", "Show - Episode 2");
    expect(pattern.status).toBe("learning");
    expect(pattern.navigationCount).toBe(1);

    pattern = recordSeriesNavigation(pattern, "https://example.com/show/ep-3", "Show - Episode 3");
    pattern = recordSeriesNavigation(pattern, "https://example.com/show/ep-4", "Show - Episode 4");
    expect(pattern.status).toBe("ready");
    expect(pattern.urlPattern).toBeTruthy();
  });

  it("ignores off-series pages once the pattern is ready", () => {
    let pattern = createInitialSeriesPattern(
      "https://example.com/show/my-series/ep-1",
      "My Series 1",
    );
    pattern = recordSeriesNavigation(pattern, "https://example.com/show/my-series/ep-2", "My Series 2");
    pattern = recordSeriesNavigation(pattern, "https://example.com/show/my-series/ep-3", "My Series 3");
    pattern = recordSeriesNavigation(pattern, "https://example.com/show/my-series/ep-4", "My Series 4");

    const inSeries = evaluateSeriesTether({
      pattern,
      url: "https://example.com/show/my-series/ep-5",
      title: "My Series 5",
      previousUrl: "https://example.com/show/my-series/ep-4",
    });
    expect(inSeries.shouldSync).toBe(true);

    const offSeries = evaluateSeriesTether({
      pattern,
      url: "https://example.com/show/other-series/ep-1",
      title: "Other Series 1",
      previousUrl: "https://example.com/show/my-series/ep-5",
    });
    expect(offSeries.shouldSync).toBe(false);
  });

  it("validates and applies manual series patterns", () => {
    const pattern = createInitialSeriesPattern(
      "https://example.com/show/ep-1",
      "Show - Episode 1",
    );
    const updated = applyManualSeriesPatterns({
      pattern,
      urlPattern: "^/show/my-series/ep-\\d+$",
      titlePattern: "^Show - Episode \\d+$",
    });
    expect(updated.status).toBe("ready");
    expect(
      matchesSeriesPattern(updated, "https://example.com/show/my-series/ep-9", "Show - Episode 9"),
    ).toBe(true);
  });
});
