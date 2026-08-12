import { describe, expect, it } from "vitest";

import { parseExcludedHosts } from "./settings";

describe("parseExcludedHosts", () => {
  it("parses a valid JSON string array", () => {
    expect(parseExcludedHosts('["mail.google.com","bank.example"]')).toEqual([
      "mail.google.com",
      "bank.example",
    ]);
  });

  it("filters non-string values", () => {
    expect(parseExcludedHosts('["ok",1,null,true,{"x":1}]')).toEqual(["ok"]);
  });

  it("returns an empty array for invalid JSON or non-arrays", () => {
    expect(parseExcludedHosts("not-json")).toEqual([]);
    expect(parseExcludedHosts('{"host":"x"}')).toEqual([]);
    expect(parseExcludedHosts("null")).toEqual([]);
  });
});
