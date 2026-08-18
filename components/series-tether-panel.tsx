import { useState } from "react";

import { sendMessage, type PopupSnapshot } from "../lib/messaging";
import { describeSeriesPattern, seriesLearningProgress } from "../lib/tether-series";
import type { TetherMode, TrackedTab } from "../lib/types";
import { M3Button } from "../entrypoints/popup/components/m3-button";
import { M3TextField } from "../entrypoints/popup/components/m3-text-field";

export function SeriesTetherPanel({
  tracked,
  onUpdate,
  compact = false,
}: {
  tracked: TrackedTab;
  onUpdate: (snapshot: PopupSnapshot) => void;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlPattern, setUrlPattern] = useState(tracked.seriesPattern?.urlPattern ?? "");
  const [titlePattern, setTitlePattern] = useState(tracked.seriesPattern?.titlePattern ?? "");

  const tetherMode = tracked.tetherMode ?? "loose";
  const progress = seriesLearningProgress(tracked.seriesPattern);

  const run = async (message: Parameters<typeof sendMessage>[0]) => {
    setError(null);
    setPending(true);
    try {
      const res = await sendMessage(message);
      if (!res.ok) throw new Error(res.error);
      if (res.snapshot) onUpdate(res.snapshot);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Series tether update failed");
    } finally {
      setPending(false);
    }
  };

  const setMode = (mode: TetherMode) =>
    void run({
      type: "UPDATE_SERIES_TETHER",
      trackedTabId: tracked.id,
      tetherMode: mode,
      resetLearning: mode === "series",
    });

  return (
    <div className={`panel stack series-tether-panel${compact ? " series-tether-panel--compact" : ""}`}>
      <div className="row wrap" style={{ justifyContent: "space-between" }}>
        <span className="section-title" style={{ margin: 0 }}>
          Series tether
        </span>
        <span className="pill">{tetherMode === "series" ? "Series" : "Loose"}</span>
      </div>

      <p className="muted" style={{ margin: 0, fontSize: 11 }}>
        {describeSeriesPattern(tracked.seriesPattern)}
      </p>

      {tetherMode === "series" && progress ? (
        <p className="muted series-tether-notice" style={{ margin: 0, fontSize: 11 }}>
          Stay on the same series. TabTether needs {progress.required - progress.current} more page
          change{progress.required - progress.current === 1 ? "" : "s"} to finish learning.
        </p>
      ) : null}

      {tetherMode === "series" && tracked.seriesPattern?.status === "ready" ? (
        <div className="stack">
          {tracked.seriesPattern.stableTokens.length ? (
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>
              Stable parts: {tracked.seriesPattern.stableTokens.join(", ")}
            </p>
          ) : null}
          {tracked.seriesPattern.changingHints.length ? (
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>
              Changing parts: {tracked.seriesPattern.changingHints.slice(0, 4).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="provider-choice" role="group" aria-label="Tether mode">
        <span className="provider-choice__label">Mode</span>
        <button
          className={`provider-choice__option${tetherMode === "loose" ? " provider-choice__option--selected" : ""}`}
          type="button"
          aria-pressed={tetherMode === "loose"}
          disabled={pending}
          onClick={() => setMode("loose")}
        >
          Loose
        </button>
        <button
          className={`provider-choice__option${tetherMode === "series" ? " provider-choice__option--selected" : ""}`}
          type="button"
          aria-pressed={tetherMode === "series"}
          disabled={pending}
          onClick={() => setMode("series")}
        >
          Series
        </button>
      </div>

      {tetherMode === "series" ? (
        <>
          <M3TextField
            id={`series-url-${tracked.id}`}
            label="URL pathname pattern"
            value={urlPattern}
            onChange={setUrlPattern}
            placeholder="^/series/example/chapter-\\d+$"
          />
          <M3TextField
            id={`series-title-${tracked.id}`}
            label="Title pattern"
            value={titlePattern}
            onChange={setTitlePattern}
            placeholder="^Example Chapter \\d+$"
          />
          <div className="row wrap">
            <M3Button
              variant="tonal"
              disabled={pending || (!urlPattern.trim() && !titlePattern.trim())}
              onClick={() =>
                void run({
                  type: "UPDATE_SERIES_TETHER",
                  trackedTabId: tracked.id,
                  urlPattern: urlPattern.trim() || undefined,
                  titlePattern: titlePattern.trim() || undefined,
                })
              }
            >
              Save patterns
            </M3Button>
            <M3Button
              variant="text"
              disabled={pending}
              onClick={() =>
                void run({
                  type: "UPDATE_SERIES_TETHER",
                  trackedTabId: tracked.id,
                  resetLearning: true,
                })
              }
            >
              Relearn from navigation
            </M3Button>
          </div>
        </>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 11 }}>
          Loose tether follows any page on the same website.
        </p>
      )}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
