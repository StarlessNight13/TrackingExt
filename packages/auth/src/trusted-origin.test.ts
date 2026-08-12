import { describe, expect, it } from "vitest";

import { isTrustedOrigin } from "./index";

describe("isTrustedOrigin", () => {
  it("allows the configured web origin", () => {
    expect(isTrustedOrigin("http://localhost:3001")).toBe(true);
  });

  it("allows Chromium and Firefox extension origins", () => {
    expect(isTrustedOrigin("chrome-extension://abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
    expect(isTrustedOrigin("moz-extension://12345678-1234-1234-1234-123456789abc")).toBe(true);
  });

  it("rejects unrelated origins", () => {
    expect(isTrustedOrigin("https://evil.example")).toBe(false);
    expect(isTrustedOrigin(null)).toBe(false);
    expect(isTrustedOrigin(undefined)).toBe(false);
    expect(isTrustedOrigin("")).toBe(false);
  });
});
