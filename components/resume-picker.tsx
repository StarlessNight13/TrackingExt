import { useDeferredValue, useMemo, useState, useTransition } from "react";

import { displayHostPath } from "@/lib/privacy";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import type { TrackedTab } from "@/lib/types";
import { formatDevice, relativeTime } from "@/lib/view-utils";
import { ActivityHealthBadges } from "@/components/activity-health-badges";
import { M3TextField } from "../entrypoints/popup/components/m3-text-field";

export function ResumePicker({
  snapshot,
  onUpdate,
  onBack,
  closeOnResume = false,
  title = "Resume activity",
}: {
  snapshot: PopupSnapshot;
  onUpdate: (snapshot: PopupSnapshot) => void;
  onBack?: () => void;
  closeOnResume?: boolean;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  const tabs = useMemo(() => {
    const active = snapshot.trackedTabs.filter((tab) => !tab.archivedAt);
    if (!deferredQuery) return active;
    return active.filter((tab) => {
      const haystack = [
        tab.name,
        tab.currentTitle ?? "",
        tab.currentUrl,
        ...tab.tags,
        tab.activeDevice?.name ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(deferredQuery);
    });
  }, [deferredQuery, snapshot.trackedTabs]);

  const resume = (tab: TrackedTab, takeOverOwnership: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage({
        type: "OPEN_TAB",
        trackedTabId: tab.id,
        takeOver: takeOverOwnership,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.snapshot) onUpdate(res.snapshot);
      if (closeOnResume) window.close();
    });
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        {onBack ? (
          <button className="btn ghost" type="button" onClick={onBack}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        <h2 className="section-title" style={{ margin: 0 }}>
          {title}
        </h2>
        <span />
      </div>

      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Open an activity on this device and take ownership so URL updates sync from here.
      </p>

      <M3TextField
        id="resume-search"
        label="Search"
        value={query}
        onChange={setQuery}
        placeholder="Name, page, tag, or device"
        autoFocus
      />

      {tabs.length === 0 ? (
        <div className="empty">
          {deferredQuery ? "No matching activities." : "No tethered activities to resume."}
        </div>
      ) : (
        <div className="list compact-list">
          {tabs.map((tab) => {
            const ownedHere = Boolean(
              snapshot.deviceId && tab.activeDeviceId === snapshot.deviceId,
            );
            return (
              <div key={tab.id} className="panel compact-track">
                <button
                  className="list-item"
                  type="button"
                  disabled={pending}
                  onClick={() => resume(tab, true)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    padding: 0,
                  }}
                >
                  <span className="name">
                    {tab.emoji ? `${tab.emoji} ` : ""}
                    {tab.name}
                    {ownedHere ? (
                      <span className="pill" style={{ marginLeft: 6 }}>
                        yours
                      </span>
                    ) : null}
                    {tab.activeDevice && !ownedHere ? (
                      <span className="pill" style={{ marginLeft: 6 }}>
                        owned elsewhere
                      </span>
                    ) : null}
                  </span>
                  <ActivityHealthBadges health={tab.health} />
                  <span className="sub">{tab.currentTitle || displayHostPath(tab.currentUrl)}</span>
                  <span className="sub">
                    {formatDevice(tab)} · {relativeTime(tab.lastUpdatedAt)}
                  </span>
                </button>
                <div className="row wrap" style={{ marginTop: 8 }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={pending}
                    onClick={() => resume(tab, true)}
                  >
                    Resume
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={pending}
                    onClick={() => resume(tab, false)}
                  >
                    Open only
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
