import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { LocalDashboardTab } from "@/lib/open-dashboard";
import { ActivityMetadataEditor } from "@/components/activity-metadata-editor";
import { displayHostPath } from "@/lib/privacy";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import { describeSyncModes } from "@/lib/sync-modes";
import { describeSeriesPattern } from "@/lib/types";
import type { PrivacySettings, SyncModes, TrackedTab } from "@/lib/types";
import { formatDevice, relativeTime } from "@/lib/view-utils";
import { CloudDatabasePanel } from "./cloud-database-panel";
import { CloudManagementPanel } from "./cloud-management-panel";
import { SeriesTetherPanel } from "./series-tether-panel";

import { LanPairingPanel } from "../entrypoints/popup/components/lan-pairing-panel";
import { M3Button } from "../entrypoints/popup/components/m3-button";
import { M3SwitchRow } from "../entrypoints/popup/components/m3-switch";
import { M3TextArea, M3TextField } from "../entrypoints/popup/components/m3-text-field";
import { IconMoreVertical } from "../entrypoints/popup/components/icons";

function TabActionsMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const toggle = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: Math.min(rect.bottom + 6, window.innerHeight - 190),
        left: Math.max(8, Math.min(rect.right - 240, window.innerWidth - 248)),
      });
    }
    setOpen((value) => !value);
  };

  return (
    <>
      <button
        ref={trigger}
        className="btn secondary tab-actions-menu__trigger"
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        title="More actions"
        onClick={toggle}
      >
        <IconMoreVertical />
      </button>
      {open
        ? createPortal(
            <div
              ref={menu}
              className="tab-actions-menu__items"
              role="menu"
              style={position}
              onClick={() => setOpen(false)}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

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
    ...(snapshot.cloud.configuration
      ? [
          { id: "groups" as const, label: "Groups" },
          { id: "devices" as const, label: "Devices" },
        ]
      : []),
    ...(snapshot.syncModes.lan ? [{ id: "lan" as const, label: "LAN" }] : []),
    ...(snapshot.syncModes.online ? [{ id: "database" as const, label: "Database" }] : []),
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
            {syncHash ? "TabTether" : "Local dashboard"}
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
        <LocalLanPanel
          snapshot={snapshot}
          pending={pending}
          onUpdate={onUpdate}
          setError={setError}
        />
      ) : null}

      {tab === "database" && snapshot.syncModes.online ? (
        <div role="tabpanel">
          <CloudDatabasePanel snapshot={snapshot} onUpdate={onUpdate} />
        </div>
      ) : null}

      {tab === "groups" ? <CloudManagementPanel kind="groups" /> : null}
      {tab === "devices" ? (
        <CloudManagementPanel
          kind="devices"
          currentDeviceId={snapshot.cloud.configuration?.deviceId}
        />
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
  const [seriesPanelId, setSeriesPanelId] = useState<string | null>(null);

  const startEdit = (tracked: TrackedTab) => {
    setEditingId(tracked.id);
    setSeriesPanelId(null);
  };

  return (
    <div className="stack" role="tabpanel">
      <div className="row wrap" style={{ justifyContent: "space-between" }}>
        <span className="section-title" style={{ margin: 0 }}>
          Tethered tabs
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
            ? "No tethered tabs yet. Use the extension popup on any page to tether one."
            : "No tethered tabs yet. Tether a page from the popup home screen."}
        </div>
      ) : (
        <div className={`list compact-list${fullPage ? " local-dashboard__tab-grid" : ""}`}>
          {snapshot.trackedTabs.map((tracked) => (
            <div key={tracked.id} className="panel compact-track local-dashboard__tab-card">
              {editingId === tracked.id ? (
                <ActivityMetadataEditor
                  tracked={tracked}
                  snapshot={snapshot}
                  onUpdate={onUpdate}
                  compact
                  onSaved={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="name">
                      {tracked.emoji ? `${tracked.emoji} ` : ""}
                      {tracked.name}
                    </span>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {tracked.tetherMode === "series" ? <span className="pill">Series</span> : null}
                      {tracked.activeDevice ? (
                        <span className="pill">{tracked.activeDevice.name}</span>
                      ) : null}
                    </div>
                  </div>
                  {tracked.tetherMode === "series" ? (
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: 11 }}>
                      {describeSeriesPattern(tracked.seriesPattern)}
                    </p>
                  ) : null}
                  {tracked.currentTitle ? (
                    <p className="sub" style={{ margin: "4px 0 0" }}>
                      {tracked.currentTitle}
                    </p>
                  ) : null}
                  <p className="muted local-dashboard__tab-url" style={{ margin: "4px 0 0", fontSize: 11 }}>
                    {displayHostPath(tracked.currentUrl)}
                  </p>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 11 }}>
                    {formatDevice(tracked)} · {relativeTime(tracked.lastUpdatedAt)}
                    {(snapshot.boundTabCounts[tracked.id] ?? 0) > 0
                      ? ` · ${snapshot.boundTabCounts[tracked.id]} browser tab${snapshot.boundTabCounts[tracked.id] === 1 ? "" : "s"} open`
                      : ""}
                  </p>
                </>
              )}

              <div className="row wrap local-dashboard__tab-actions">
                {editingId === tracked.id ? (
                  <button
                    className="btn ghost"
                    disabled={pending}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
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
                    <TabActionsMenu>
                        <button
                          className="btn ghost"
                          disabled={pending}
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
                          Open without taking over
                        </button>
                        <button className="btn ghost" disabled={pending} onClick={() => startEdit(tracked)}>
                          Edit details
                        </button>
                        {snapshot.settings.recordHistory ? (
                          <button className="btn ghost" disabled={pending} onClick={() => onOpenHistory(tracked)}>
                            History
                          </button>
                        ) : null}
                        <button
                          className="btn ghost"
                          disabled={pending}
                          onClick={() =>
                            setSeriesPanelId((current) => (current === tracked.id ? null : tracked.id))
                          }
                        >
                          {seriesPanelId === tracked.id ? "Hide series pattern" : "Series pattern"}
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
                          Untether tab
                        </button>
                      </TabActionsMenu>
                  </>
                )}
              </div>

              {seriesPanelId === tracked.id ? (
                <SeriesTetherPanel
                  key={`${tracked.id}-${tracked.lastUpdatedAt}`}
                  tracked={tracked}
                  compact
                  onUpdate={onUpdate}
                />
              ) : null}
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
  const [, startTransition] = useTransition();

  return (
    <div className="stack" role="tabpanel">
      <div className="panel stack">
        <span className="section-title" style={{ margin: 0 }}>
          Pair a device
        </span>
        <LanPairingPanel compact snapshot={snapshot} lanSignalingMode="local" onUpdate={onUpdate} />
      </div>

      <div className="panel stack">
        <span className="section-title" style={{ margin: 0 }}>
          Paired devices
        </span>
        <p className="muted" style={{ margin: 0, fontSize: 11 }}>
          Connections last only while both browsers stay open. Offline devices must be paired again.
        </p>
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
  const [excluded, setExcluded] = useState(snapshot.settings.excludedHosts.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patchSettings = (settings: Partial<PrivacySettings>) => {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage({ type: "UPDATE_SETTINGS", settings });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.snapshot) onUpdate(res.snapshot);
      if (syncModes.online && !snapshot.syncModes.online) window.location.hash = "database";
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
          title="Online"
          description="Sync through a connected database"
          checked={syncModes.online}
          onChange={() => toggleSyncMode("online")}
          id="dash-mode-online"
        />
        <M3SwitchRow
          title="LAN"
          description="Same-network WebRTC sync"
          checked={syncModes.lan}
          onChange={() => toggleSyncMode("lan")}
          id="dash-mode-lan"
        />
        <button className="btn secondary" disabled={pending} onClick={saveSyncModes}>
          Save sync modes
        </button>
      </div>

      <div className="panel stack">
        <M3TextField
          id="local-dash-device"
          label="Device name"
          value={deviceName}
          onChange={setDeviceName}
        />
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
        <M3TextArea
          id="local-dash-excluded"
          label="Excluded websites"
          value={excluded}
          onChange={setExcluded}
          rows={3}
        />
        <button className="btn secondary" disabled={pending} onClick={saveExcluded}>
          Save exclusions
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
