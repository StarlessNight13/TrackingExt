import { describe, expect, it } from "vitest";

import {
  displayHostPath,
  isExcludedHost,
  isTrackableUrl,
  sanitizeUrl,
} from "./privacy";
import { DEFAULT_SETTINGS, type PrivacySettings } from "./types";

const baseSettings: PrivacySettings = DEFAULT_SETTINGS;

describe("isTrackableUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isTrackableUrl("https://example.com/chapter/1")).toBe(true);
    expect(isTrackableUrl("http://localhost:3000/")).toBe(true);
  });

  it("rejects browser-internal and invalid URLs", () => {
    expect(isTrackableUrl("chrome://settings")).toBe(false);
    expect(isTrackableUrl("about:blank")).toBe(false);
    expect(isTrackableUrl("file:///tmp/x.html")).toBe(false);
    expect(isTrackableUrl("")).toBe(false);
    expect(isTrackableUrl(null)).toBe(false);
    expect(isTrackableUrl(undefined)).toBe(false);
    expect(isTrackableUrl("not a url")).toBe(false);
  });
});

describe("isExcludedHost", () => {
  it("matches exact hosts and subdomains", () => {
    expect(isExcludedHost("https://mail.google.com/inbox", ["mail.google.com"])).toBe(true);
    expect(isExcludedHost("https://a.mail.google.com/x", ["mail.google.com"])).toBe(true);
    expect(isExcludedHost("https://google.com/", ["mail.google.com"])).toBe(false);
  });

  it("is case-insensitive and ignores blank entries", () => {
    expect(isExcludedHost("https://Bank.Example/login", ["bank.example", "  "])).toBe(true);
  });
});

describe("sanitizeUrl", () => {
  it("always strips sensitive query params", () => {
    const url = sanitizeUrl(
      "https://example.com/path?page=2&token=secret&keep=yes&api_key=abc",
      baseSettings,
    );
    expect(url).toBe("https://example.com/path?page=2&keep=yes");
  });

  it("strips all query params when configured", () => {
    const url = sanitizeUrl("https://example.com/path?page=2&keep=yes#section", {
      ...baseSettings,
      stripQueryParams: true,
      stripFragments: true,
    });
    expect(url).toBe("https://example.com/path");
  });

  it("preserves fragments when stripFragments is false", () => {
    const url = sanitizeUrl("https://example.com/path#chapter-3", {
      ...baseSettings,
      stripFragments: false,
    });
    expect(url).toBe("https://example.com/path#chapter-3");
  });

  it("does not double the query question mark", () => {
    const url = sanitizeUrl("https://example.com/path?page=2", baseSettings);
    expect(url).toBe("https://example.com/path?page=2");
    expect(url).not.toContain("??");
  });
});

describe("displayHostPath", () => {
  it("formats host + path for display", () => {
    expect(displayHostPath("https://example.com/chapter/183")).toBe("example.com/chapter/183");
  });

  it("returns the original string for invalid URLs", () => {
    expect(displayHostPath("not-a-url")).toBe("not-a-url");
  });
});
