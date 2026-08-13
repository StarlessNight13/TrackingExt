import { useEffect, useState, useTransition } from "react";
import { getUrlPatternParts } from "@trackingext/api/lib/url-pattern";

import { displayHostPath } from "@/lib/privacy";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import type { HistoryEntry, TrackedTab } from "@/lib/types";
import { relativeTime } from "@/lib/view-utils";

function HistoryUrl({ url, comparisonUrls }: { url: string; comparisonUrls: string[] }) {
  const displayUrl = displayHostPath(url);
  const parts = getUrlPatternParts(displayUrl, comparisonUrls);

  return (
    <>
      {parts.fixedStart}
      {parts.changing ? <mark className="url-diff-changed">{parts.changing}</mark> : null}
      {parts.fixedEnd}
    </>
  );
}

export function HistoryView({
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
  const historyUrls = entries.map((entry) => displayHostPath(entry.url));

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
                  <HistoryUrl url={entry.url} comparisonUrls={historyUrls} /> ·{" "}
                  {relativeTime(entry.visitedAt)}
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
