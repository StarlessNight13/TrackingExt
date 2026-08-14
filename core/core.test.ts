import { describe, expect, it } from "vitest";

import { historyCutoff } from "./history";
import { isExcludedUrl, sanitizeUrl, shouldRecordHistory } from "./privacy";
import { newTrackedTab } from "./tracked-tabs";
import { normalizeRetentionDays } from "./validation";

describe("extension domain core", () => {
  it("normalizes tracked tab input", () => {
    const tab = newTrackedTab({
      name: "  Research ",
      url: "https://example.com/a",
      tags: ["Work", "work"],
    });
    expect(tab.name).toBe("Research");
    expect(tab.tags).toEqual(["work"]);
  });

  it("applies privacy and retention rules", () => {
    const rules = {
      recordHistory: true,
      stripQueryParams: true,
      stripFragments: true,
      excludedHosts: ["example.com"],
    };
    expect(sanitizeUrl("https://site.test/a?q=1#x", rules)).toBe("https://site.test/a");
    expect(isExcludedUrl("https://sub.example.com/a", rules.excludedHosts)).toBe(true);
    expect(shouldRecordHistory(rules, true)).toBe(false);
    expect(historyCutoff(normalizeRetentionDays(7), 10 * 24 * 60 * 60 * 1000)).toBe(
      3 * 24 * 60 * 60 * 1000,
    );
  });
});
