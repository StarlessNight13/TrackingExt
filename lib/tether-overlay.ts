import type { TrackedTab } from "./types";

/** Series tether lives locally; overlay it onto a cloud or peer tab view. */
export function withLocalTether(tab: TrackedTab, local?: TrackedTab | null): TrackedTab {
  if (!local) return tab;
  return {
    ...tab,
    tetherMode: local.tetherMode ?? tab.tetherMode,
    seriesPattern: local.seriesPattern ?? tab.seriesPattern,
  };
}
