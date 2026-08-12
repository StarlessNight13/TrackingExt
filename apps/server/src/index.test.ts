import { describe, expect, it } from "vitest";

import app from "./index";

describe("server app", () => {
  it("responds OK on health route", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  it("rejects unauthenticated tracked tab listing", async () => {
    const res = await app.request("/rpc/trackedTabs/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: {} }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = (await res.json()) as { json?: { code?: string } };
    expect(body.json?.code ?? (body as { code?: string }).code).toBe("UNAUTHORIZED");
  });

  it("allows auth sign-up from an extension origin", async () => {
    const email = `vitest-${Date.now()}@example.com`;
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "chrome-extension://abcdefghijklmnopqrstuvwxyz123456",
      },
      body: JSON.stringify({
        name: "Vitest User",
        email,
        password: "test-password-123456",
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get("set-auth-token")).toBeTruthy();
    const body = (await res.json()) as { user?: { email?: string } };
    expect(body.user?.email).toBe(email);
  });
});
