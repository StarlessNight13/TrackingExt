import { describe, expect, it } from "vitest";

import { normalizeCloudDatabaseUrl } from "./spike";

describe("normalizeCloudDatabaseUrl", () => {
  it("accepts secure remote and local development endpoints", () => {
    expect(normalizeCloudDatabaseUrl("https://example.turso.io/")).toBe("https://example.turso.io");
    expect(normalizeCloudDatabaseUrl("libsql://example.turso.io")).toBe(
      "libsql://example.turso.io",
    );
    expect(normalizeCloudDatabaseUrl("http://127.0.0.1:8080/")).toBe("http://127.0.0.1:8080");
  });

  it("rejects insecure remote endpoints and embedded credentials", () => {
    expect(() => normalizeCloudDatabaseUrl("http://example.com")).toThrow("HTTPS");
    expect(normalizeCloudDatabaseUrl("https://user:secret@example.com")).toBe(
      "https://example.com",
    );
  });
});
