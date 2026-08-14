import { useEffect, useState, useTransition } from "react";

import { displayHostPath } from "@/lib/privacy";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import { HistoryView } from "@/components/history-view";
import { ResumePicker } from "@/components/resume-picker";
import { openDashboard } from "@/lib/open-dashboard";
import { describeSyncModes } from "@/lib/sync-modes";
import type { PrivacySettings, SyncModes, TrackedTab } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { supportedSyncModes, supportsLanSync } from "@/lib/browser-capabilities";
import { formatDevice, relativeTime } from "@/lib/view-utils";

import { ExtensionThemeProvider } from "./components/extension-theme-provider";
import { IconLayoutDashboard, IconSettings } from "./components/icons";
import { LanPairingPanel } from "./components/lan-pairing-panel";
import { M3SwitchRow } from "./components/m3-switch";
import { M3TextArea, M3TextField } from "./components/m3-text-field";
import { OnboardingWizard } from "./components/onboarding-wizard";

type View = "main" | "settings" | "history" | "resume";

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
  const [syncModes, setSyncModes] = useState<SyncModes>(() =>
    supportedSyncModes(snapshot.syncModes),
  );
  const [showPairing, setShowPairing] = useState(false);
  const [excluded, setExcluded] = useState(snapshot.settings.excludedHosts.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSyncModes(supportedSyncModes(snapshot.syncModes));
  }, [snapshot.syncModes]);

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

  const saveExcluded = () => {
    const hosts = excluded
      .split(/[\n,]/)
      .map((h) => h.trim())
      .filter(Boolean);
    patchSettings({ excludedHosts: hosts });
  };

  const saveSyncModes = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage({ type: "UPDATE_SYNC_MODES", syncModes });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.snapshot) onUpdate(res.snapshot);
      if (syncModes.online && !snapshot.syncModes.online) openDashboard(snapshot, "database");
    });
  };

  const toggleSyncMode = (key: keyof SyncModes) => {
    setSyncModes((current) => ({ ...current, [key]: !current[key] }));
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

      <div className="panel stack settings-panel">
        <p className="muted" style={{ margin: 0, fontSize: 11 }}>
          Sync modes (at least one required)
        </p>
        <M3SwitchRow
          title="Online"
          description="Sync through a connected database"
          checked={syncModes.online}
          onChange={() => toggleSyncMode("online")}
          id="settings-mode-online"
        />
        <M3SwitchRow
          title="Offline"
          description="This browser only"
          checked={syncModes.offline}
          onChange={() => toggleSyncMode("offline")}
          id="settings-mode-offline"
        />
        {supportsLanSync ? (
          <M3SwitchRow
            title="LAN"
            description="Same-network WebRTC sync"
            checked={syncModes.lan}
            onChange={() => toggleSyncMode("lan")}
            id="settings-mode-lan"
          />
        ) : null}
        <button className="btn secondary" disabled={pending} onClick={saveSyncModes}>
          Save sync modes
        </button>
        <button
          className="btn ghost"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await sendMessage({ type: "SYNC_NOW" });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              if (res.snapshot) onUpdate(res.snapshot);
            });
          }}
        >
          Sync all modes now
        </button>
      </div>

      {supportsLanSync && (snapshot.syncModes.lan || syncModes.lan) ? (
        <div className="panel stack">
          <span className="section-title" style={{ margin: 0 }}>
            LAN devices
          </span>
          <p className="muted" style={{ margin: 0, fontSize: 11 }}>
            Pair via copied tokens. Reconnect after restart requires re-pairing.
          </p>
          {snapshot.pairedLanDevices.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>
              No paired devices. Use onboarding or pair from another browser.
            </p>
          ) : (
            <div className="list compact-list">
              {snapshot.pairedLanDevices.map((device) => {
                const online = snapshot.lanPeerStatus[device.deviceId] ?? false;
                return (
                  <div key={device.deviceId} className="panel compact-track">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="name">{device.deviceName}</span>
                      <span className="pill">{online ? "Connected" : "Offline"}</span>
                    </div>
                    <p className="muted" style={{ margin: 0, fontSize: 11 }}>
                      {device.browser ?? "Browser"} · paired {relativeTime(device.pairedAt)}
                    </p>
                    <button
                      className="btn danger"
                      disabled={pending}
                      onClick={() => {
                        setError(null);
                        startTransition(async () => {
                          const res = await sendMessage({
                            type: "REMOVE_LAN_PEER",
                            deviceId: device.deviceId,
                          });
                          if (!res.ok) {
                            setError(res.error);
                            return;
                          }
                          if (res.snapshot) onUpdate(res.snapshot);
                        });
                      }}
                    >
                      Unpair
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {!showPairing ? (
            <button
              className="btn secondary"
              disabled={pending}
              onClick={() => setShowPairing(true)}
            >
              Pair new device
            </button>
          ) : (
            <LanPairingPanel
              compact
              snapshot={snapshot}
              lanSignalingMode="local"
              syncModes={syncModes}
              onUpdate={(next) => {
                onUpdate(next);
                setShowPairing(false);
              }}
              onPaired={() => setShowPairing(false)}
            />
          )}
        </div>
      ) : null}

      <div className="panel stack">
        <M3TextField id="device" label="This device" value={deviceName} onChange={setDeviceName} />
        <button className="btn secondary" disabled={pending} onClick={saveDevice}>
          Save device name
        </button>
      </div>

      <div className="panel stack settings-panel">
        <span className="section-title" style={{ margin: 0 }}>
          Privacy
        </span>
        <M3SwitchRow
          title="Record navigation history"
          checked={snapshot.settings.recordHistory}
          onChange={(checked) => patchSettings({ recordHistory: checked })}
          id="settings-record-history"
        />
        <M3SwitchRow
          title="Store URL query parameters"
          description="Auth-related query keys are always removed"
          checked={!snapshot.settings.stripQueryParams}
          onChange={(checked) => patchSettings({ stripQueryParams: !checked })}
          id="settings-store-query"
        />
        <M3SwitchRow
          title="Store URL fragments (#…)"
          checked={!snapshot.settings.stripFragments}
          onChange={(checked) => patchSettings({ stripFragments: !checked })}
          id="settings-store-fragments"
        />
      </div>

      <div className="panel stack">
        <M3TextArea
          id="excluded"
          label="Excluded websites (one host per line)"
          value={excluded}
          onChange={setExcluded}
          rows={4}
        />
        <button className="btn secondary" disabled={pending} onClick={saveExcluded}>
          Save exclusions
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function HistoryPanel({
  tab,
  onBack,
  onUpdate,
}: {
  tab: TrackedTab;
  onBack: () => void;
  onUpdate: (snapshot: PopupSnapshot) => void;
}) {
  return <HistoryView tab={tab} onBack={onBack} onUpdate={onUpdate} />;
}

function MainView({
  snapshot,
  onUpdate,
  onOpenSettings,
  onOpenHistory,
  onOpenResume,
}: {
  snapshot: PopupSnapshot;
  onUpdate: (snapshot: PopupSnapshot) => void;
  onOpenSettings: () => void;
  onOpenHistory: (tab: TrackedTab) => void;
  onOpenResume: () => void;
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
  const lanSummary =
    snapshot.syncModes.lan && snapshot.pairedLanDevices.length > 0
      ? `${snapshot.lanConnectedPeers}/${snapshot.pairedLanDevices.length} LAN peers online`
      : null;

  return (
    <div className="stack">
      <div className="brand">
        <h1>TrackingExt</h1>
        <button
          className="btn ghost icon-btn"
          type="button"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          <IconSettings />
        </button>
      </div>

      <div className="panel compact-track sync-status-bar">
        <div className="row wrap" style={{ justifyContent: "space-between" }}>
          <span className="pill">{describeSyncModes(snapshot.syncModes)}</span>
          {lanSummary ? <span className="muted">{lanSummary}</span> : null}
        </div>
        {snapshot.pendingSyncCount > 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            {snapshot.pendingSyncCount} queued update
            {snapshot.pendingSyncCount === 1 ? "" : "s"} waiting to sync.
          </p>
        ) : null}
        <button
          className="btn secondary"
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await sendMessage({ type: "SYNC_NOW" });
              if (!res.ok) throw new Error(res.error);
              if (res.snapshot) onUpdate(res.snapshot);
            })
          }
        >
          {snapshot.pendingSyncCount > 0 ? "Retry sync" : "Sync now"}
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
            <M3TextField id="tracked-name" label="Name" value={name} onChange={setName} />
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
            <M3TextField
              id="track-name"
              label="Name (optional)"
              value={name}
              onChange={setName}
              placeholder="e.g. Novel, Research notes"
            />
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
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Tracked Tabs
          </h2>
          {snapshot.trackedTabs.length > 0 ? (
            <button className="btn secondary" type="button" onClick={onOpenResume}>
              Resume…
            </button>
          ) : null}
        </div>
        {otherTabs.length === 0 ? (
          <div className="empty">{tracked ? "No other tracked tabs." : "No tracked tabs yet."}</div>
        ) : (
          <div className="list compact-list">
            {otherTabs.map((tab) => (
              <button
                key={tab.id}
                className="list-item"
                disabled={pending}
                title="Resume on this device (open & take over)"
                onClick={() =>
                  run(async () => {
                    const res = await sendMessage({
                      type: "OPEN_TAB",
                      trackedTabId: tab.id,
                      takeOver: true,
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
                <span className="sub">{tab.currentTitle || displayHostPath(tab.currentUrl)}</span>
                <span className="sub">
                  Resume · {formatDevice(tab)} · {relativeTime(tab.lastUpdatedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="footer footer--actions">
        <button
          className="btn ghost icon-btn"
          type="button"
          title="Open local dashboard"
          aria-label="Open local dashboard"
          onClick={() => openDashboard(snapshot)}
        >
          <IconLayoutDashboard />
        </button>
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

  const themeSettings = snapshot?.settings ?? DEFAULT_SETTINGS;

  if (bootError) {
    return (
      <ExtensionThemeProvider settings={themeSettings}>
        <div className="app">
          <p className="error">{bootError}</p>
        </div>
      </ExtensionThemeProvider>
    );
  }

  if (!snapshot) {
    return (
      <ExtensionThemeProvider settings={themeSettings}>
        <div className="app">
          <div className="empty">Loading…</div>
        </div>
      </ExtensionThemeProvider>
    );
  }

  return (
    <ExtensionThemeProvider settings={snapshot.settings}>
      <div className="app">
        {!snapshot.onboardingComplete ? (
          <OnboardingWizard snapshot={snapshot} onDone={setSnapshot} />
        ) : view === "settings" ? (
          <SettingsView snapshot={snapshot} onBack={() => setView("main")} onUpdate={setSnapshot} />
        ) : view === "history" && historyTab ? (
          <HistoryPanel
            tab={historyTab}
            onBack={() => {
              setView("main");
              setHistoryTab(null);
            }}
            onUpdate={setSnapshot}
          />
        ) : view === "resume" ? (
          <ResumePicker
            snapshot={snapshot}
            onUpdate={setSnapshot}
            onBack={() => setView("main")}
            closeOnResume
          />
        ) : (
          <MainView
            snapshot={snapshot}
            onUpdate={setSnapshot}
            onOpenSettings={() => openDashboard(snapshot, "settings")}
            onOpenHistory={(tab) => {
              setHistoryTab(tab);
              setView("history");
            }}
            onOpenResume={() => setView("resume")}
          />
        )}
      </div>
    </ExtensionThemeProvider>
  );
}

export default App;
