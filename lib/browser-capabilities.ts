import type { SyncModes } from "./types";

// WXT creates a dedicated Firefox Android build using this browser target.
// Firefox (desktop and Android) has no offscreen document API, which this
// extension's LAN/WebRTC transport requires.
export const isFirefoxFamily =
  import.meta.env.BROWSER === "firefox" || import.meta.env.BROWSER === "firefox-android";

export const supportsLanSync = !isFirefoxFamily;

export function supportedSyncModes(syncModes: SyncModes): SyncModes {
  if (supportsLanSync) return syncModes;

  return {
    ...syncModes,
    // Do not leave a Firefox user with no usable sync mode after migrating an
    // existing Chromium profile that had LAN as its sole enabled mode.
    offline: true,
    lan: false,
    online: syncModes.online,
  };
}
