import type { LanSignalingMode, SyncModes } from "./types";

export const DEFAULT_SYNC_MODES: SyncModes = { offline: true, lan: false, online: false };

export function isValidSyncModes(modes: SyncModes) {
  return modes.offline || modes.lan || modes.online;
}

export function resolveLanSignalingMode(): LanSignalingMode {
  return "local";
}

export function describeSyncModes(modes: SyncModes) {
  return (
    [modes.offline && "Offline", modes.lan && "LAN", modes.online && "Online"]
      .filter(Boolean)
      .join(" + ") || "None"
  );
}
