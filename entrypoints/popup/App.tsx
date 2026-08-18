import { useEffect, useState, useTransition } from "react";

import { displayHostPath } from "@/lib/privacy";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import { HistoryView } from "@/components/history-view";
import { ResumePicker } from "@/components/resume-picker";
import { SeriesTetherPanel } from "@/components/series-tether-panel";
import { openDashboard } from "@/lib/open-dashboard";
import { describeSyncModes } from "@/lib/sync-modes";
import type { PrivacySettings, SyncModes, TrackedTab, TetherMode } from "@/lib/types";
import { seriesLearningProgress } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { supportedSyncModes, supportsLanSync } from "@/lib/browser-capabilities";
import { formatDevice, relativeTime } from "@/lib/view-utils";

import { ExtensionThemeProvider } from "./components/extension-theme-provider";
import { IconSettings } from "./components/icons";
import { LanPairingPanel } from "./components/lan-pairing-panel";
import { M3SwitchRow } from "./components/m3-switch";
import { M3TextArea, M3TextField } from "./components/m3-text-field";

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
              No paired devices. Pair from another browser using a token below.
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
  const [tetherMode, setTetherMode] = useState<TetherMode>("loose");
  const [showSeriesPanel, setShowSeriesPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = snapshot.currentTab;
  const tracked = current?.tracked ?? null;
  const boundCount = tracked ? (snapshot.boundTabCounts[tracked.id] ?? 0) : 0;
  const tetheredOpenTabs = snapshot.openTabs.filter((tab) => tab.tracked);
  const untetheredOpenTabs = snapshot.openTabs.filter((tab) => !tab.tracked);

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
  const seriesProgress = seriesLearningProgress(tracked?.seriesPattern);
  const lanSummary =
    snapshot.syncModes.lan && snapshot.pairedLanDevices.length > 0
      ? `${snapshot.lanConnectedPeers}/${snapshot.pairedLanDevices.length} LAN peers online`
      : null;

  return (
    <div className="stack">
      <div className="brand">
        <h1>TabTether</h1>
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
              Open a normal web page to tether it.
            </p>
          </div>
        ) : tracked ? (
          <div className="panel compact-track">
            <div className="status-row">
              <span className="status-dot" />
              Tethered
              {tracked.tetherMode === "series" ? <span className="pill">Series</span> : null}
              {!current.isActiveOwner ? <span className="pill">owned elsewhere</span> : null}
            </div>
            {boundCount > 1 ? (
              <p className="muted" style={{ margin: 0, fontSize: 11 }}>
                {boundCount} browser tabs are linked to this activity.
              </p>
            ) : null}
            {tracked.tetherMode === "series" && seriesProgress ? (
              <p className="muted series-tether-notice" style={{ margin: 0, fontSize: 11 }}>
                Learning this series ({seriesProgress.current}/{seriesProgress.required} page
                changes). Stay on the same series while TabTether learns the pattern.
              </p>
            ) : null}
            {tracked.tetherMode === "series" && tracked.seriesPattern?.status === "ready" ? (
              <p className="muted series-tether-notice" style={{ margin: 0, fontSize: 11 }}>
                Series pattern active
                {tracked.seriesPattern.stableTokens.length
                  ? `: ${tracked.seriesPattern.stableTokens[0]}`
                  : ""}
                . Off-series pages will not update this tether.
              </p>
            ) : null}
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
                className="btn secondary"
                disabled={pending}
                onClick={() => setShowSeriesPanel((value) => !value)}
              >
                {showSeriesPanel ? "Hide series pattern" : "Series pattern"}
              </button>
              <button
                className="btn secondary"
                disabled={pending}
                onClick={() => openDashboard(snapshot, "tabs")}
              >
                Dashboard
              </button>
              {boundCount > 1 ? (
                <button
                  className="btn danger"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const res = await sendMessage({ type: "UNBIND_TAB" });
                      if (!res.ok) throw new Error(res.error);
                      if (res.snapshot) onUpdate(res.snapshot);
                    })
                  }
                >
                  Untether this tab
                </button>
              ) : (
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
                  Untether tab
                </button>
              )}
              {boundCount > 1 ? (
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
                  Delete activity
                </button>
              ) : null}
            </div>
            {showSeriesPanel ? (
              <SeriesTetherPanel
                key={`${tracked.id}-${tracked.lastUpdatedAt}`}
                tracked={tracked}
                compact
                onUpdate={onUpdate}
              />
            ) : null}
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
            <div className="provider-choice" role="group" aria-label="Tether mode">
              <span className="provider-choice__label">Tether mode</span>
              <button
                className={`provider-choice__option${tetherMode === "loose" ? " provider-choice__option--selected" : ""}`}
                type="button"
                aria-pressed={tetherMode === "loose"}
                onClick={() => setTetherMode("loose")}
              >
                Loose
              </button>
              <button
                className={`provider-choice__option${tetherMode === "series" ? " provider-choice__option--selected" : ""}`}
                type="button"
                aria-pressed={tetherMode === "series"}
                onClick={() => setTetherMode("series")}
              >
                Series
              </button>
            </div>
            {tetherMode === "loose" ? (
              <p className="muted" style={{ margin: 0, fontSize: 11 }}>
                Loose tether follows any page on the same website.
              </p>
            ) : (
              <p className="muted series-tether-notice" style={{ margin: 0, fontSize: 11 }}>
                Series tether learns what stays the same across pages. Stay on the same series;
                after 3 page changes TabTether builds a regex from the repeating URL/title parts.
              </p>
            )}
            <button
              className="btn block track-cta"
              disabled={pending || !canTrack}
              onClick={() =>
                run(async () => {
                  const res = await sendMessage({
                    type: "TRACK_TAB",
                    name: name.trim() || undefined,
                    tetherMode,
                  });
                  if (!res.ok) throw new Error(res.error);
                  if (res.snapshot) onUpdate(res.snapshot);
                })
              }
            >
              {pending
                ? "Tethering…"
                : tetherMode === "series"
                  ? "Tether this series"
                  : "Tether this tab"}
            </button>
            {canTrack && snapshot.trackedTabs.length > 0 ? (
              <div className="stack">
                <span className="muted" style={{ margin: 0, fontSize: 11 }}>
                  Or link this tab to an existing activity:
                </span>
                <div className="list compact-list">
                  {snapshot.trackedTabs.map((activity) => (
                    <button
                      key={activity.id}
                      className="list-item"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const res = await sendMessage({
                            type: "BIND_TAB",
                            trackedTabId: activity.id,
                          });
                          if (!res.ok) throw new Error(res.error);
                          if (res.snapshot) onUpdate(res.snapshot);
                        })
                      }
                    >
                      <span className="name">
                        {activity.emoji ? `${activity.emoji} ` : ""}
                        {activity.name}
                      </span>
                      <span className="sub">{displayHostPath(activity.currentUrl)}</span>
                      {(snapshot.boundTabCounts[activity.id] ?? 0) > 0 ? (
                        <span className="sub">
                          {snapshot.boundTabCounts[activity.id]} tab
                          {snapshot.boundTabCounts[activity.id] === 1 ? "" : "s"} open
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {snapshot.openTabs.length > 0 ? (
        <div className="section">
          <h2 className="section-title">Tabs in this window</h2>
          <div className="list compact-list">
            {snapshot.openTabs.map((tab) => (
              <div
                key={tab.tabId}
                className={`list-item window-tab-item${tab.active ? " current" : ""}`}
                style={{ cursor: "default" }}
              >
                <div className="row wrap" style={{ justifyContent: "space-between", gap: 8 }}>
                  <span className="name">{tab.title || "Untitled page"}</span>
                  {tab.active ? <span className="pill">Active</span> : null}
                  {tab.tracked ? <span className="pill">Tethered</span> : null}
                </div>
                <span className="sub">{displayHostPath(tab.url)}</span>
                {tab.tracked ? (
                  <span className="sub">
                    {tab.tracked.emoji ? `${tab.tracked.emoji} ` : ""}
                    {tab.tracked.name}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 11 }}>
            {tetheredOpenTabs.length} tethered · {untetheredOpenTabs.length} untethered in this
            window
          </p>
        </div>
      ) : null}

      <div className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            All activities
          </h2>
          {snapshot.trackedTabs.length > 0 ? (
            <button className="btn secondary" type="button" onClick={onOpenResume}>
              Resume…
            </button>
          ) : null}
        </div>
        {snapshot.trackedTabs.length === 0 ? (
          <div className="empty">No tethered activities yet.</div>
        ) : (
          <div className="list compact-list">
            {snapshot.trackedTabs.map((tab) => (
              <button
                key={tab.id}
                className={`list-item${tracked?.id === tab.id ? " current" : ""}`}
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
                  {tracked?.id === tab.id ? " (current page)" : ""}
                </span>
                <span className="sub">{tab.currentTitle || displayHostPath(tab.currentUrl)}</span>
                <span className="sub">
                  {(snapshot.boundTabCounts[tab.id] ?? 0) > 0
                    ? `${snapshot.boundTabCounts[tab.id]} tab${snapshot.boundTabCounts[tab.id] === 1 ? "" : "s"} open · `
                    : ""}
                  {formatDevice(tab)} · {relativeTime(tab.lastUpdatedAt)}
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
        {view === "settings" ? (
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
