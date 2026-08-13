import { describe, expect, it } from "vitest";

import app from "./index";

async function signUp() {
  const email = `flow-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const res = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "chrome-extension://abcdefghijklmnopqrstuvwxyz123456",
    },
    body: JSON.stringify({
      name: "Flow User",
      email,
      password: "test-password-123456",
    }),
  });
  const token = res.headers.get("set-auth-token");
  if (!token) {
    throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  }
  return token;
}

async function rpc<T>(
  token: string,
  path: string,
  body: unknown,
): Promise<{ status: number; json: T }> {
  const res = await app.request(`/rpc/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ json: body }),
  });
  return { status: res.status, json: (await res.json()) as T };
}

describe("tracked tabs API flow", () => {
  it("registers a device, tracks a tab, updates URL, and records history", async () => {
    const token = await signUp();

    const deviceRes = await rpc<{
      json: { id: string; name: string };
    }>(token, "devices/register", {
      name: "Home PC · Firefox",
      browser: "Firefox",
    });
    expect(deviceRes.status).toBe(200);
    const deviceId = deviceRes.json.json.id;

    const createRes = await rpc<{
      json: { id: string; currentUrl: string };
    }>(token, "trackedTabs/create", {
      deviceId,
      name: "Novel",
      emoji: "📖",
      url: "https://example.com/chapter/183",
      title: "Chapter 183",
    });
    expect(createRes.status).toBe(200);
    const tabId = createRes.json.json.id;
    expect(createRes.json.json.currentUrl).toBe("https://example.com/chapter/183");

    const updateRes = await rpc<{
      json: { skipped: boolean; tab: { currentUrl: string; currentTitle: string | null } };
    }>(token, "trackedTabs/updateLocation", {
      id: tabId,
      deviceId,
      url: "https://example.com/chapter/184",
      title: "Chapter 184",
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.json.json.skipped).toBe(false);
    expect(updateRes.json.json.tab.currentUrl).toBe("https://example.com/chapter/184");

    const historyRes = await rpc<{
      json: Array<{ url: string; title: string | null }>;
    }>(token, "trackedTabs/history", { id: tabId });
    expect(historyRes.status).toBe(200);
    expect(historyRes.json.json.map((h) => h.url)).toEqual([
      "https://example.com/chapter/184",
      "https://example.com/chapter/183",
    ]);
  });

  it("blocks location updates from a non-owner device until takeOver", async () => {
    const token = await signUp();

    const home = await rpc<{ json: { id: string } }>(token, "devices/register", {
      name: "Home PC · Firefox",
      browser: "Firefox",
    });
    const laptop = await rpc<{ json: { id: string } }>(token, "devices/register", {
      name: "Laptop · Chrome",
      browser: "Chrome",
    });
    const homeId = home.json.json.id;
    const laptopId = laptop.json.json.id;

    const created = await rpc<{ json: { id: string } }>(token, "trackedTabs/create", {
      deviceId: homeId,
      name: "Research",
      url: "https://example.com/docs",
      title: "Docs",
    });
    const tabId = created.json.json.id;

    const conflict = await rpc<{ json: { code?: string } }>(token, "trackedTabs/updateLocation", {
      id: tabId,
      deviceId: laptopId,
      url: "https://example.com/docs/2",
      title: "Docs 2",
    });
    expect(conflict.status).toBe(409);
    expect(conflict.json.json.code).toBe("CONFLICT");

    const takeOver = await rpc<{ json: { activeDeviceId: string } }>(
      token,
      "trackedTabs/takeOver",
      {
        id: tabId,
        deviceId: laptopId,
      },
    );
    expect(takeOver.status).toBe(200);
    expect(takeOver.json.json.activeDeviceId).toBe(laptopId);

    const update = await rpc<{ json: { skipped: boolean; tab: { currentUrl: string } } }>(
      token,
      "trackedTabs/updateLocation",
      {
        id: tabId,
        deviceId: laptopId,
        url: "https://example.com/docs/2",
        title: "Docs 2",
      },
    );
    expect(update.status).toBe(200);
    expect(update.json.json.tab.currentUrl).toBe("https://example.com/docs/2");
  });

  it("stores tags and moves archived activities out of the active list", async () => {
    const token = await signUp();
    const device = await rpc<{ json: { id: string } }>(token, "devices/register", {
      name: "Home PC · Firefox",
      browser: "Firefox",
    });

    const created = await rpc<{ json: { id: string; tags: string[] } }>(
      token,
      "trackedTabs/create",
      {
        deviceId: device.json.json.id,
        name: "Release notes",
        tags: ["Work", "research", "work"],
        url: "https://example.com/releases",
      },
    );
    expect(created.json.json.tags).toEqual(["work", "research"]);

    const archived = await rpc<{ json: { archivedAt: string | null } }>(
      token,
      "trackedTabs/archive",
      { id: created.json.json.id },
    );
    expect(archived.json.json.archivedAt).not.toBeNull();

    const active = await rpc<{ json: Array<{ id: string }> }>(token, "trackedTabs/list", {});
    expect(active.json.json.some((tab) => tab.id === created.json.json.id)).toBe(false);

    const archivedList = await rpc<{ json: Array<{ id: string }> }>(token, "trackedTabs/list", {
      archived: "archived",
    });
    expect(archivedList.json.json.map((tab) => tab.id)).toContain(created.json.json.id);
  });

  it("applies bulk tags and archives only the caller's selected activities", async () => {
    const token = await signUp();
    const device = await rpc<{ json: { id: string } }>(token, "devices/register", {
      name: "Home PC · Firefox",
      browser: "Firefox",
    });
    const create = (name: string) =>
      rpc<{ json: { id: string } }>(token, "trackedTabs/create", {
        deviceId: device.json.json.id,
        name,
        url: `https://example.com/${name}`,
      });
    const [first, second] = await Promise.all([create("first"), create("second")]);
    const ids = [first.json.json.id, second.json.json.id];

    const tagged = await rpc<{ json: { ok: boolean } }>(token, "trackedTabs/bulkTag", {
      ids,
      tags: ["reading"],
      mode: "add",
    });
    expect(tagged.json.json.ok).toBe(true);

    const all = await rpc<{ json: Array<{ id: string; tags: string[] }> }>(
      token,
      "trackedTabs/list",
      { archived: "all" },
    );
    expect(
      all.json.json
        .filter((tab) => ids.includes(tab.id))
        .every((tab) => tab.tags.includes("reading")),
    ).toBe(true);

    const archived = await rpc<{ json: { ok: boolean } }>(token, "trackedTabs/bulkArchive", {
      ids,
    });
    expect(archived.json.json.ok).toBe(true);
  });
});
