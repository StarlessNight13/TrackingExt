import { useEffect, useState, useTransition } from "react";

import type { LocalDashboardTab } from "@/lib/open-dashboard";
import { displayHostPath } from "@/lib/privacy";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import { describeSyncModes, needsServerUrl as needsServerUrlForModes } from "@/lib/sync-modes";
import { normalizeServerUrl } from "@/lib/server-url";
import type { LanSignalingMode, PrivacySettings, SyncModes, TrackedTab } from "@/lib/types";
import { formatDevice, relativeTime } from "@/lib/view-utils";

import { LanPairingPanel } from "../entrypoints/popup/components/lan-pairing-panel";
import { M3Button } from "../entrypoints/popup/components/m3-button";
import { M3SwitchRow } from "../entrypoints/popup/components/m3-switch";

export function LocalDashboardView({
  snapshot,
  onUpdate,
  onOpenHistory,
  initialTab = "tabs",
  onBack,
  closeOnOpenTab = false,
  syncHash = false,
  showHeader = true,
}: {
  snapshot: PopupSnapshot;
  onUpdate: (snapshot: PopupSnapshot) => void;
  onOpenHistory: (tab: TrackedTab) => void;
  initialTab?: LocalDashboardTab;
  onBack?: () => void;
  closeOnOpenTab?: boolean;
  syncHash?: boolean;
  showHeader?: boolean;
}) {
  const [tab, setTab] = useState<LocalDashboardTab>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const selectTab = (next: LocalDashboardTab) => {
    setTab(next);
    if (syncHash) {
      window.location.hash = next === "tabs" ? "" : next;
    }
  };

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

  const tabs: { id: LocalDashboardTab; label: string }[] = [
    { id: "tabs", label: "Tabs" },
    ...(snapshot.syncModes.lan ? [{ id: "lan" as const, label: "LAN" }] : []),
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="stack local-dashboard">
      {showHeader ? (
        <div className="row local-dashboard__header">
          {onBack ? (
            <button className="btn ghost" type="button" onClick={onBack}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          <span className="section-title" style={{ margin: 0 }}>
            {syncHash ? "TrackingExt" : "Local dashboard"}
          </span>
        </div>
      ) : null}

      {showHeader ? (
        <p className="muted" style={{ margin: 0, fontSize: 11 }}>
          {describeSyncModes(snapshot.syncModes)} · manage tabs on this device
          {snapshot.syncModes.lan ? " and nearby browsers" : ""}
        </p>
      ) : null}

      <div className="local-dashboard__tabs" role="tablist" aria-label="Dashboard sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`local-dashboard__tab${tab === item.id ? " local-dashboard__tab--active" : ""}`}
            onClick={() => selectTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "tabs" ? (
        <LocalTabsPanel
          snapshot={snapshot}
          pending={pending}
          run={run}
          onUpdate={onUpdate}
          onOpenHistory={onOpenHistory}
          closeOnOpenTab={closeOnOpenTab}
          fullPage={syncHash}
        />
      ) : null}

      {tab === "lan" && snapshot.syncModes.lan ? (
        <LocalLanPanel snapshot={snapshot} pending={pending} onUpdate={onUpdate} setError={setError} />
      ) : null}

      {tab === "settings" ? <LocalSettingsPanel snapshot={snapshot} onUpdate={onUpdate} /> : null}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function LocalTabsPanel({
  snapshot,
  pending,
  run,
  onUpdate,
  onOpenHistory,
  closeOnOpenTab,
  fullPage,
}: {
  snapshot: PopupSnapshot;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
  onUpdate: (snapshot: PopupSnapshot) => void;
  onOpenHistory: (tab: TrackedTab) => void;
  closeOnOpenTab: boolean;
  fullPage: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (tracked: TrackedTab) => {
    setEditingId(tracked.id);
    setEditName(tracked.name);
  };

  return (
    <div className="stack" role="tabpanel">
      <div className="row wrap" style={{ justifyContent: "space-between" }}>
        <span className="section-title" style={{ margin: 0 }}>
          Tracked tabs
        </span>
        <M3Button
          variant="text"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await sendMessage({ type: "SYNC_NOW" });
              if (!res.ok) throw new Error(res.error);
              if (res.snapshot) onUpdate(res.snapshot);
            })
          }
        >
          Sync now
        </M3Button>
      </div>

      {snapshot.trackedTabs.length === 0 ? (
        <div className="empty">
          {fullPage
            ? "No tracked tabs yet. Use the extension popup on any page to start tracking."
            : "No tracked tabs yet. Track a page from the popup home screen."}
        </div>
      ) : (
        <div className={`list compact-list${fullPage ? " local-dashboard__tab-grid" : ""}`}>
          {snapshot.trackedTabs.map((tracked) => (
            <div key={tracked.id} className="panel compact-track local-dashboard__tab-card">
              {editingId === tracked.id ? (
                <div className="field">
                  <label htmlFor={`rename-${tracked.id}`}>Name</label>
                  <input
                    id={`rename-${tracked.id}`}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
              ) : (
                <>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="name">
                      {tracked.emoji ? `${tracked.emoji} ` : ""}
                      {tracked.name}
                    </span>
                    {tracked.activeDevice ? (
                      <span className="pill">{tracked.activeDevice.name}</span>
                    ) : null}
                  </div>
                  <p className="sub" style={{ margin: "4px 0 0" }}>
                    {tracked.currentTitle || displayHostPath(tracked.currentUrl)}
                  </p>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 11 }}>
                    {formatDevice(tracked)} · {relativeTime(tracked.lastUpdatedAt)}
                  </p>
                </>
              )}

              <div className="row wrap local-dashboard__tab-actions">
                {editingId === tracked.id ? (
                  <>
                    <button
                      className="btn secondary"
                      disabled={pending || !editName.trim()}
                      onClick={() =>
                        run(async () => {
                          const res = await sendMessage({
                            type: "RENAME_TAB",
                            trackedTabId: tracked.id,
                            name: editName.trim(),
                          });
                          if (!res.ok) throw new Error(res.error);
                          setEditingId(null);
                          if (res.snapshot) onUpdate(res.snapshot);
                        })
                      }
                    >
                      Save
                    </button>
                    <button className="btn ghost" disabled={pending} onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn"
                      disabled={pending}
                      title="Open and take ownership on this device"
                      onClick={() =>
                        run(async () => {
                          const res = await sendMessage({
                            type: "OPEN_TAB",
                            trackedTabId: tracked.id,
                            takeOver: true,
                          });
                          if (!res.ok) throw new Error(res.error);
                          if (res.snapshot) onUpdate(res.snapshot);
                          if (closeOnOpenTab) window.close();
                        })
                      }
                    >
                      Resume
                    </button>
                    <button
                      className="btn secondary"
                      disabled={pending}
                      title="Open without taking ownership"
                      onClick={() =>
                        run(async () => {
                          const res = await sendMessage({
                            type: "OPEN_TAB",
                            trackedTabId: tracked.id,
                            takeOver: false,
                          });
                          if (!res.ok) throw new Error(res.error);
                          if (res.snapshot) onUpdate(res.snapshot);
                          if (closeOnOpenTab) window.close();
                        })
                      }
                    >
                      Open
                    </button>
                    <button className="btn ghost" disabled={pending} onClick={() => startEdit(tracked)}>
                      Rename
                    </button>
                    {snapshot.settings.recordHistory ? (
                      <button className="btn ghost" disabled={pending} onClick={() => onOpenHistory(tracked)}>
                        History
                      </button>
                    ) : null}
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
                      Stop
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LocalLanPanel({
  snapshot,
  pending,
  onUpdate,
  setError,
}: {
  snapshot: PopupSnapshot;
  pending: boolean;
  onUpdate: (snapshot: PopupSnapshot) => void;
  setError: (error: string | null) => void;
}) {
  const [lanSignalingMode, setLanSignalingMode] = useState(snapshot.lanSignalingMode);
  const [serverUrl, setServerUrl] = useState(snapshot.serverUrl ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setServerUrl(snapshot.serverUrl ?? "");
  }, [snapshot.serverUrl]);

  const showRelayUrl = needsServerUrlForModes(snapshot.syncModes, lanSignalingMode, snapshot.serverUrl);

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

  const saveLanSignalingMode = (mode: LanSignalingMode) => {
    setError(null);
    startTransition(async () => {
      if (mode === "server-relay" && !snapshot.serverUrl) {
        if (!serverUrl.trim()) {
          setError("Enter a relay server URL before enabling server relay");
          return;
        }
        try {
          const normalized = normalizeServerUrl(serverUrl);
          const urlRes = await sendMessage({ type: "SET_SERVER_URL", serverUrl: normalized });
          if (!urlRes.ok) {
            setError(urlRes.error);
            return;
          }
          if (urlRes.snapshot) onUpdate(urlRes.snapshot);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Invalid endpoint");
          return;
        }
      }

      const res = await sendMessage({ type: "UPDATE_LAN_SIGNALING_MODE", lanSignalingMode: mode });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLanSignalingMode(mode);
      if (res.snapshot) onUpdate(res.snapshot);
    });
  };

  return (
    <div className="stack" role="tabpanel">
      <div className="panel stack">
        <span className="section-title" style={{ margin: 0 }}>
          Pair a device
        </span>
        <LanPairingPanel compact snapshot={snapshot} lanSignalingMode={lanSignalingMode} onUpdate={onUpdate} />
      </div>

      <div className="panel stack">
        <span className="section-title" style={{ margin: 0 }}>
          Paired devices
        </span>
        <M3SwitchRow
          title="Use server relay for reconnect"
          description="Disable for fully local pairing without a server"
          checked={lanSignalingMode === "server-relay"}
          onChange={(checked) => saveLanSignalingMode(checked ? "server-relay" : "local")}
          id="lan-relay-mode"
        />
        {showRelayUrl ? (
          <div className="stack" style={{ gap: 8 }}>
            <div className="field">
              <label htmlFor="lan-relay-server">Relay server URL</label>
              <input
                id="lan-relay-server"
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:3000"
              />
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>
              Used for 6-digit pairing codes and automatic reconnect. Save before enabling server relay.
            </p>
            <button className="btn secondary" disabled={pending || !serverUrl.trim()} onClick={saveServerUrl}>
              Save relay URL
            </button>
          </div>
        ) : null}
        {snapshot.pairedLanDevices.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 11 }}>
            No paired devices yet.
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
                  <div className="row wrap">
                    <button
                      className="btn secondary"
                      disabled={pending || lanSignalingMode === "local"}
                      onClick={() => {
                        setError(null);
                        startTransition(async () => {
                          const res = await sendMessage({ type: "RECONNECT_LAN" });
                          if (!res.ok) {
                            setError(res.error);
                            return;
                          }
                          if (res.snapshot) onUpdate(res.snapshot);
                        });
                      }}
                    >
                      Reconnect
                    </button>
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LocalSettingsPanel({
  snapshot,
  onUpdate,
}: {
  snapshot: PopupSnapshot;
  onUpdate: (snapshot: PopupSnapshot) => void;
}) {
  const [deviceName, setDeviceName] = useState(snapshot.deviceName ?? "");
  const [syncModes, setSyncModes] = useState<SyncModes>(snapshot.syncModes);
  const [serverUrl, setServerUrl] = useState(snapshot.serverUrl ?? "");
  const [excluded, setExcluded] = useState(snapshot.settings.excludedHosts.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsServerUrl = needsServerUrlForModes(syncModes, snapshot.lanSignalingMode, snapshot.serverUrl);

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

  const saveSyncModes = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage({ type: "UPDATE_SYNC_MODES", syncModes });
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

  const toggleSyncMode = (key: keyof SyncModes) => {
    setSyncModes((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="stack" role="tabpanel">
      <div className="panel stack settings-panel">
        <span className="section-title" style={{ margin: 0 }}>
          Sync modes
        </span>
        <M3SwitchRow
          title="Offline"
          description="This browser only"
          checked={syncModes.offline}
          onChange={() => toggleSyncMode("offline")}
          id="dash-mode-offline"
        />
        <M3SwitchRow
          title="LAN"
          description="Same-network WebRTC sync"
          checked={syncModes.lan}
          onChange={() => toggleSyncMode("lan")}
          id="dash-mode-lan"
        />
        <M3SwitchRow
          title="Server"
          description="Cloud sync and web dashboard"
          checked={syncModes.server}
          onChange={() => toggleSyncMode("server")}
          id="dash-mode-server"
        />
        <button className="btn secondary" disabled={pending} onClick={saveSyncModes}>
          Save sync modes
        </button>
      </div>

      {needsServerUrl ? (
        <div className="panel stack">
          <div className="field">
            <label htmlFor="local-dash-server">Server / relay URL</label>
            <input
              id="local-dash-server"
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
          </div>
          <button className="btn secondary" disabled={pending || !serverUrl.trim()} onClick={saveServerUrl}>
            Save URL
          </button>
        </div>
      ) : null}

      <div className="panel stack">
        <div className="field">
          <label htmlFor="local-dash-device">Device name</label>
          <input id="local-dash-device" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
        </div>
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
          id="dash-record-history"
        />
        <M3SwitchRow
          title="Store URL query parameters"
          checked={!snapshot.settings.stripQueryParams}
          onChange={(checked) => patchSettings({ stripQueryParams: !checked })}
          id="dash-store-query"
        />
        <M3SwitchRow
          title="Store URL fragments (#…)"
          checked={!snapshot.settings.stripFragments}
          onChange={(checked) => patchSettings({ stripFragments: !checked })}
          id="dash-store-fragments"
        />
        <div className="field">
          <label htmlFor="local-dash-excluded">Excluded websites</label>
          <textarea
            id="local-dash-excluded"
            value={excluded}
            onChange={(e) => setExcluded(e.target.value)}
            rows={3}
            className="local-dashboard__textarea"
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
