import { describe, expect, it } from "vitest";

import { getUrlPatternParts, hasSameHostname } from "./url-pattern";

describe("hasSameHostname", () => {
  it("matches hosts case-insensitively and rejects redirect hosts", () => {
    expect(hasSameHostname("https://Example.com/chapter/1", "http://example.com/chapter/2")).toBe(
      true,
    );
    expect(hasSameHostname("https://example.com/chapter/1", "https://ads.example.net/click")).toBe(
      false,
    );
  });
});

describe("getUrlPatternParts", () => {
  it("keeps shared path text normal and returns chapter identifiers as changing", () => {
    const urls = ["example.com/chapters/183", "example.com/chapters/184"];

    expect(getUrlPatternParts(urls[1]!, urls)).toEqual({
      fixedStart: "example.com/chapters/",
      changing: "184",
      fixedEnd: "",
    });
  });

  it("does not imply a changing part when there is only one URL", () => {
    expect(getUrlPatternParts("example.com/chapters/183", ["example.com/chapters/183"])).toEqual({
      fixedStart: "example.com/chapters/183",
      changing: "",
      fixedEnd: "",
    });
  });
});
