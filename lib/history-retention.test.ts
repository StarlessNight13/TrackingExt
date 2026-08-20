import { describe, expect, it } from "bun:test";

import {
  filterHistoryByRetention,
  purgeHistoryRecord,
} from "./history-retention";

describe("filterHistoryByRetention", () => {
  const now = Date.parse("2026-08-20T12:00:00.000Z");

  it("keeps all entries when retention is forever", () => {
    const entries = [
      { id: "1", url: "https://a.test", title: null, visitedAt: "2020-01-01T00:00:00.000Z" },
    ];
    expect(filterHistoryByRetention(entries, null, now)).toEqual(entries);
  });

  it("drops entries older than the retention window", () => {
    const entries = [
      { id: "1", url: "https://old.test", title: null, visitedAt: "2026-08-01T00:00:00.000Z" },
      { id: "2", url: "https://new.test", title: null, visitedAt: "2026-08-19T00:00:00.000Z" },
    ];
    const filtered = filterHistoryByRetention(entries, 7, now);
    expect(filtered.map((entry) => entry.id)).toEqual(["2"]);
  });
});

describe("purgeHistoryRecord", () => {
  it("removes expired entries from a history record", () => {
    const { localHistory, deleted } = purgeHistoryRecord(
      {
        tab_1: [
          { id: "1", url: "https://old.test", title: null, visitedAt: "2020-01-01T00:00:00.000Z" },
          { id: "2", url: "https://new.test", title: null, visitedAt: "2026-08-19T00:00:00.000Z" },
        ],
      },
      7,
      Date.parse("2026-08-20T12:00:00.000Z"),
    );

    expect(deleted).toBe(1);
    expect(localHistory.tab_1).toHaveLength(1);
    expect(localHistory.tab_1[0]?.id).toBe("2");
  });
});
