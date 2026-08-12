import { useEffect, useState, useTransition } from "react";

import { displayHostPath } from "@/lib/privacy";
import { DEFAULT_SERVER_URL, normalizeServerUrl } from "@/lib/server-url";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import type { HistoryEntry, PrivacySettings, TrackedTab } from "@/lib/types";

type View = "setup" | "main" | "settings" | "history";

function formatDevice(tab: TrackedTab) {
  const device = tab.lastUpdatedDevice;
  if (!device) return "Unknown device";
  return `${device.name}`;
}

function relativeTime(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.round(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

function openDashboard(serverUrl: string, path = "/dashboard") {
  void browser.tabs.create({ url: new URL(path, `${serverUrl}/`).toString() });
}

function SetupView({
  snapshot,
  onDone,
}: {
  snapshot: PopupSnapshot | null;
  onDone: (snapshot: PopupSnapshot) => void;
}) {
  const [serverUrl, setServerUrl] = useState(snapshot?.serverUrl ?? DEFAULT_SERVER_URL);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const normalized = normalizeServerUrl(serverUrl);
        const res = await sendMessage({ type: "SET_SERVER_URL", serverUrl: normalized });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (res.snapshot) onDone(res.snapshot);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid endpoint");
      }
    });
  };

  return (
    <div className="stack">
      <div className="brand">
        <h1>TrackingExt</h1>
        <span className="meta">Self-hosted setup</span>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Enter the base URL for your TrackingExt API server before signing in.
      </p>
      <div className="panel stack">
        <div className="field">
          <label htmlFor="server-url">API endpoint</label>
          <input
            id="server-url"
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder={DEFAULT_SERVER_URL}
            autoFocus
          />
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 11 }}>
          Example: `https://trackingext.example.com` or `http://localhost:3000`
        </p>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn block" disabled={pending || !serverUrl.trim()} onClick={submit}>
          {pending ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}

function AuthForm({
  snapshot,
  onDone,
}: {
  snapshot: PopupSnapshot;
  onDone: (snapshot: PopupSnapshot) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res =
        mode === "signin"
          ? await sendMessage({ type: "SIGN_IN", email, password })
          : await sendMessage({ type: "SIGN_UP", name, email, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.snapshot) onDone(res.snapshot);
    });
  };

  return (
    <div className="stack">
      <div className="brand">
        <h1>TrackingExt</h1>
        <span className="meta">Tracked tabs</span>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Sign in to sync activities across Firefox and Chromium.
      </p>
      <p className="muted" style={{ margin: 0, fontSize: 11 }}>
        Endpoint: {snapshot.serverUrl}
      </p>
      <div className="panel stack">
        {mode === "signup" ? (
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn block" disabled={pending || !email || !password} onClick={submit}>
          {pending ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() => openDashboard(snapshot.serverUrl!, mode === "signin" ? "/login" : "/")}
        >
          Open dashboard
        </button>
      </div>
    </div>
  );
}

function SettingsView({
  snapshot,
  onBack,
  onUpdate,
}: {
  snapshot: PopupSnapshot;
  onBack: () => void;
  onUpdate: (snapshot: PopupSnapshot) => void;
}) {
  const [deviceName, setDeviceName] = useState(snapshot.deviceName ?? "");
  const [serverUrl, setServerUrl] = useState(snapshot.serverUrl ?? DEFAULT_SERVER_URL);
  const [excluded, setExcluded] = useState(snapshot.settings.excludedHosts.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setServerUrl(snapshot.serverUrl ?? DEFAULT_SERVER_URL);
  }, [snapshot.serverUrl]);

  const patchSettings = (settings: Partial<PrivacySettings>) => {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage({ type: "UPDATE_SETTINGS", settings });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.snapshot) onUpdate(res.snapshot);
    });
  };

  const saveDevice = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage({ type: "RENAME_DEVICE", name: deviceName.trim() });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.snapshot) onUpdate(res.snapshot);
    });
  };

  const saveServerUrl = () => {
    setError(null);
    startTransition(async () => {
      try {
        const normalized = normalizeServerUrl(serverUrl);
        const res = await sendMessage({ type: "SET_SERVER_URL", serverUrl: normalized });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (res.snapshot) onUpdate(res.snapshot);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid endpoint");
      }
    });
  };

  const saveExcluded = () => {
    const hosts = excluded
      .split(/[\n,]/)
      .map((h) => h.trim())
      .filter(Boolean);
    patchSettings({ excludedHosts: hosts });
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <span className="section-title" style={{ margin: 0 }}>
          Privacy & device
        </span>
      </div>

      <div className="panel stack">
        <div className="field">
          <label htmlFor="server-endpoint">API endpoint</label>
          <input
            id="server-endpoint"
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
          />
        </div>
        <button className="btn secondary" disabled={pending || !serverUrl.trim()} onClick={saveServerUrl}>
          Save endpoint
        </button>
        {snapshot.serverUrl ? (
          <button className="btn ghost" disabled={pending} onClick={() => openDashboard(snapshot.serverUrl!)}>
            Open dashboard
          </button>
        ) : null}
      </div>

      <div className="panel stack">
        <div className="field">
          <label htmlFor="device">This device</label>
          <input id="device" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
        </div>
        <button className="btn secondary" disabled={pending} onClick={saveDevice}>
          Save device name
        </button>
      </div>

      <div className="panel stack">
        <label className="toggle">
          <span>Record navigation history</span>
          <input
            type="checkbox"
            checked={snapshot.settings.recordHistory}
            onChange={(e) => patchSettings({ recordHistory: e.target.checked })}
          />
        </label>
        <label className="toggle">
          <span>Store URL query parameters</span>
          <input
            type="checkbox"
            checked={!snapshot.settings.stripQueryParams}
            onChange={(e) => patchSettings({ stripQueryParams: !e.target.checked })}
          />
        </label>
        <p className="muted" style={{ margin: 0, fontSize: 11 }}>
          Auth-related query keys (token, session, api_key, …) are always removed.
        </p>
        <label className="toggle">
          <span>Store URL fragments (#…)</span>
          <input
            type="checkbox"
            checked={!snapshot.settings.stripFragments}
            onChange={(e) => patchSettings({ stripFragments: !e.target.checked })}
          />
        </label>
      </div>

      <div className="panel stack">
        <div className="field">
          <label htmlFor="excluded">Excluded websites (one host per line)</label>
          <textarea
            id="excluded"
            value={excluded}
            onChange={(e) => setExcluded(e.target.value)}
            rows={4}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "8px 10px",
              resize: "vertical",
              font: "inherit",
            }}
          />
        </div>
        <button className="btn secondary" disabled={pending} onClick={saveExcluded}>
          Save exclusions
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function HistoryView({
  tab,
  onBack,
  onUpdate,
}: {
  tab: TrackedTab;
  onBack: () => void;
  onUpdate: (snapshot: PopupSnapshot) => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const res = await sendMessage({ type: "GET_HISTORY", trackedTabId: tab.id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEntries((res.history as HistoryEntry[]) ?? []);
      if (res.snapshot) onUpdate(res.snapshot);
    });
  }, [tab.id, onUpdate]);

  const clear = () => {
    startTransition(async () => {
      const res = await sendMessage({ type: "CLEAR_HISTORY", trackedTabId: tab.id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEntries([]);
      if (res.snapshot) onUpdate(res.snapshot);
    });
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn danger" disabled={pending || entries.length === 0} onClick={clear}>
          Clear history
        </button>
      </div>
      <div className="panel">
        <p className="title" style={{ margin: 0 }}>
          {tab.emoji ? `${tab.emoji} ` : ""}
          {tab.name}
        </p>
        <p className="url">Current: {displayHostPath(tab.currentUrl)}</p>
      </div>
      <div className="section">
        <h2 className="section-title">History</h2>
        {entries.length === 0 ? (
          <div className="empty">No history yet for this activity.</div>
        ) : (
          <div className="list">
            {entries.map((entry) => (
              <button
                key={entry.id}
                className="list-item"
                onClick={() => void browser.tabs.create({ url: entry.url })}
              >
                <span className="name">{entry.title || displayHostPath(entry.url)}</span>
                <span className="sub">
                  {displayHostPath(entry.url)} · {relativeTime(entry.visitedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function MainView({
  snapshot,
  onUpdate,
  onOpenSettings,
  onOpenHistory,
}: {
  snapshot: PopupSnapshot;
  onUpdate: (snapshot: PopupSnapshot) => void;
  onOpenSettings: () => void;
  onOpenHistory: (tab: TrackedTab) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = snapshot.currentTab;
  const tracked = current?.tracked ?? null;
  const otherTabs = snapshot.trackedTabs.filter((t) => t.id !== tracked?.id).slice(0, 12);

  useEffect(() => {
    setName(tracked?.name ?? current?.title ?? "");
  }, [tracked?.id, tracked?.name, current?.title]);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  const canTrack = Boolean(current && !tracked);

  return (
    <div className="stack">
      <div className="brand">
        <h1>TrackingExt</h1>
        <button className="btn ghost" type="button" onClick={onOpenSettings} title="Settings">
          Settings
        </button>
      </div>

      {snapshot.pendingReconnect.length > 0 ? (
        <div className="section">
          <h2 className="section-title">Reconnect</h2>
          <div className="list">
            {snapshot.pendingReconnect.slice(0, 3).map((candidate) => (
              <div key={`${candidate.trackedTabId}:${candidate.browserTabId}`} className="panel">
                <p className="title" style={{ margin: 0 }}>
                  {candidate.trackedTabName}
                </p>
                <p className="url">{displayHostPath(candidate.url)}</p>
                <div className="row">
                  <button
                    className="btn"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const res = await sendMessage({
                          type: "CONFIRM_RECONNECT",
                          candidate,
                          takeOver: true,
                        });
                        if (!res.ok) throw new Error(res.error);
                        if (res.snapshot) onUpdate(res.snapshot);
                      })
                    }
                  >
                    Reconnect
                  </button>
                  <button
                    className="btn secondary"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const res = await sendMessage({
                          type: "DISMISS_RECONNECT",
                          candidate,
                        });
                        if (!res.ok) throw new Error(res.error);
                        if (res.snapshot) onUpdate(res.snapshot);
                      })
                    }
                  >
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="section">
        <h2 className="section-title">Current page</h2>
        {!current ? (
          <div className="panel">
            <p className="muted" style={{ margin: 0 }}>
              Open a normal web page to track it.
            </p>
          </div>
        ) : tracked ? (
          <div className="panel compact-track">
            <div className="status-row">
              <span className="status-dot" />
              Tracking
              {!current.isActiveOwner ? <span className="pill">owned elsewhere</span> : null}
            </div>
            <div className="field">
              <label htmlFor="tracked-name">Name</label>
              <input
                id="tracked-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <p className="url">{displayHostPath(tracked.currentUrl)}</p>
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>
              Last updated from {formatDevice(tracked)} · {relativeTime(tracked.lastUpdatedAt)}
            </p>
            <div className="row wrap">
              <button
                className="btn secondary"
                disabled={pending || !name.trim() || name.trim() === tracked.name}
                onClick={() =>
                  run(async () => {
                    const res = await sendMessage({
                      type: "RENAME_TAB",
                      trackedTabId: tracked.id,
                      name: name.trim(),
                    });
                    if (!res.ok) throw new Error(res.error);
                    if (res.snapshot) onUpdate(res.snapshot);
                  })
                }
              >
                Save name
              </button>
              {!current.isActiveOwner ? (
                <button
                  className="btn"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const res = await sendMessage({
                        type: "TAKE_OVER",
                        trackedTabId: tracked.id,
                      });
                      if (!res.ok) throw new Error(res.error);
                      if (res.snapshot) onUpdate(res.snapshot);
                    })
                  }
                >
                  Take over
                </button>
              ) : null}
              <button
                className="btn secondary"
                disabled={pending}
                onClick={() => onOpenHistory(tracked)}
              >
                History
              </button>
              <button
                className="btn danger"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const res = await sendMessage({
                      type: "STOP_TRACKING",
                      trackedTabId: tracked.id,
                    });
                    if (!res.ok) throw new Error(res.error);
                    if (res.snapshot) onUpdate(res.snapshot);
                  })
                }
              >
                Stop Tracking
              </button>
            </div>
          </div>
        ) : (
          <div className="panel stack">
            <p className="title" style={{ margin: 0 }}>
              {current.title || "Untitled page"}
            </p>
            <p className="url">{displayHostPath(current.url)}</p>
            <div className="field">
              <label htmlFor="track-name">Name (optional)</label>
              <input
                id="track-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Novel, Research notes"
              />
            </div>
            <button
              className="btn block track-cta"
              disabled={pending || !canTrack}
              onClick={() =>
                run(async () => {
                  const res = await sendMessage({
                    type: "TRACK_TAB",
                    name: name.trim() || undefined,
                  });
                  if (!res.ok) throw new Error(res.error);
                  if (res.snapshot) onUpdate(res.snapshot);
                })
              }
            >
              {pending ? "Tracking…" : "Track this tab"}
            </button>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">Tracked Tabs</h2>
        {otherTabs.length === 0 ? (
          <div className="empty">
            {tracked ? "No other tracked tabs." : "No tracked tabs yet."}
          </div>
        ) : (
          <div className="list compact-list">
            {otherTabs.map((tab) => (
              <button
                key={tab.id}
                className="list-item"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const res = await sendMessage({
                      type: "OPEN_TAB",
                      trackedTabId: tab.id,
                      takeOver: false,
                    });
                    if (!res.ok) throw new Error(res.error);
                    if (res.snapshot) onUpdate(res.snapshot);
                    window.close();
                  })
                }
              >
                <span className="name">
                  {tab.emoji ? `${tab.emoji} ` : ""}
                  {tab.name}
                </span>
                <span className="sub">
                  {tab.currentTitle || displayHostPath(tab.currentUrl)}
                </span>
                <span className="sub">
                  {formatDevice(tab)} · {relativeTime(tab.lastUpdatedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="footer">
        <span className="truncate">{snapshot.userEmail}</span>
        <div className="row">
          <button className="btn ghost" onClick={() => openDashboard(snapshot.serverUrl!)}>
            Dashboard
          </button>
          <button
            className="btn ghost"
            onClick={() =>
              run(async () => {
                const res = await sendMessage({ type: "SIGN_OUT" });
                if (!res.ok) throw new Error(res.error);
                if (res.snapshot) onUpdate(res.snapshot);
              })
            }
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [snapshot, setSnapshot] = useState<PopupSnapshot | null>(null);
  const [view, setView] = useState<View>("main");
  const [historyTab, setHistoryTab] = useState<TrackedTab | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    void sendMessage({ type: "GET_SNAPSHOT" }).then((res) => {
      if (!res.ok) {
        setBootError(res.error);
        return;
      }
      setSnapshot(res.snapshot ?? null);
    });
  }, []);

  if (bootError) {
    return (
      <div className="app">
        <p className="error">{bootError}</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="app">
        <div className="empty">Loading…</div>
      </div>
    );
  }

  return (
    <div className="app">
      {!snapshot.serverUrl ? (
        <SetupView snapshot={snapshot} onDone={setSnapshot} />
      ) : !snapshot.authenticated ? (
        <AuthForm snapshot={snapshot} onDone={setSnapshot} />
      ) : view === "settings" ? (
        <SettingsView
          snapshot={snapshot}
          onBack={() => setView("main")}
          onUpdate={setSnapshot}
        />
      ) : view === "history" && historyTab ? (
        <HistoryView
          tab={historyTab}
          onBack={() => {
            setView("main");
            setHistoryTab(null);
          }}
          onUpdate={setSnapshot}
        />
      ) : (
        <MainView
          snapshot={snapshot}
          onUpdate={setSnapshot}
          onOpenSettings={() => setView("settings")}
          onOpenHistory={(tab) => {
            setHistoryTab(tab);
            setView("history");
          }}
        />
      )}
    </div>
  );
}

export default App;
