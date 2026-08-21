import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearTabActivityId,
  readTabActivityId,
  supportsTabSessionBindings,
  TABTETHER_ACTIVITY_SESSION_KEY,
  writeTabActivityId,
} from "./tab-session-binding";

type SessionsMock = {
  setTabValue: ReturnType<typeof vi.fn>;
  getTabValue: ReturnType<typeof vi.fn>;
  removeTabValue: ReturnType<typeof vi.fn>;
};

function installSessions(partial?: Partial<SessionsMock> | null) {
  const sessions =
    partial === null
      ? undefined
      : {
          setTabValue: vi.fn(async () => undefined),
          getTabValue: vi.fn(async () => undefined),
          removeTabValue: vi.fn(async () => undefined),
          ...partial,
        };
  vi.stubGlobal("browser", { sessions });
  return sessions;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("supportsTabSessionBindings", () => {
  it("is false when sessions API is missing", () => {
    installSessions(null);
    expect(supportsTabSessionBindings()).toBe(false);
  });

  it("is false when setTabValue is missing (Chromium-shaped sessions)", () => {
    vi.stubGlobal("browser", {
      sessions: {
        getRecentlyClosed: vi.fn(),
      },
    });
    expect(supportsTabSessionBindings()).toBe(false);
  });

  it("is true when Firefox tab value methods exist", () => {
    installSessions();
    expect(supportsTabSessionBindings()).toBe(true);
  });
});

describe("writeTabActivityId / readTabActivityId / clearTabActivityId", () => {
  it("writes and reads the activity id key", async () => {
    const sessions = installSessions({
      getTabValue: vi.fn(async () => "local_tab_1"),
    });

    await writeTabActivityId(12, "local_tab_1");
    expect(sessions?.setTabValue).toHaveBeenCalledWith(
      12,
      TABTETHER_ACTIVITY_SESSION_KEY,
      "local_tab_1",
    );

    await expect(readTabActivityId(12)).resolves.toBe("local_tab_1");
    expect(sessions?.getTabValue).toHaveBeenCalledWith(12, TABTETHER_ACTIVITY_SESSION_KEY);
  });

  it("returns null for missing, empty, or non-string values", async () => {
    installSessions({
      getTabValue: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce("")
        .mockResolvedValueOnce({ id: "x" }),
    });

    await expect(readTabActivityId(1)).resolves.toBeNull();
    await expect(readTabActivityId(1)).resolves.toBeNull();
    await expect(readTabActivityId(1)).resolves.toBeNull();
  });

  it("clears the session key", async () => {
    const sessions = installSessions();
    await clearTabActivityId(9);
    expect(sessions?.removeTabValue).toHaveBeenCalledWith(9, TABTETHER_ACTIVITY_SESSION_KEY);
  });

  it("no-ops when unsupported", async () => {
    installSessions(null);
    await expect(writeTabActivityId(1, "a")).resolves.toBeUndefined();
    await expect(readTabActivityId(1)).resolves.toBeNull();
    await expect(clearTabActivityId(1)).resolves.toBeUndefined();
  });

  it("swallows API errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installSessions({
      setTabValue: vi.fn(async () => {
        throw new Error("boom");
      }),
      getTabValue: vi.fn(async () => {
        throw new Error("boom");
      }),
      removeTabValue: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    await expect(writeTabActivityId(1, "a")).resolves.toBeUndefined();
    await expect(readTabActivityId(1)).resolves.toBeNull();
    await expect(clearTabActivityId(1)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
