export const EXTENSION_BRIDGE_SOURCE = "trackingext-extension" as const;
export const DASHBOARD_BRIDGE_SOURCE = "trackingext-dashboard" as const;

export type ExtensionBridgeChannel = "self-hosted" | "store" | "development";

export type ExtensionBridgeInfo = {
  source: typeof EXTENSION_BRIDGE_SOURCE;
  type: "EXTENSION_INFO";
  version: string;
  versionName?: string;
  channel: ExtensionBridgeChannel;
  name: string;
};

function resolveChannel(): ExtensionBridgeChannel {
  const raw = import.meta.env.VITE_EXTENSION_CHANNEL;
  if (raw === "store" || raw === "self-hosted" || raw === "development") {
    return raw;
  }
  if (import.meta.env.PROD) {
    return "self-hosted";
  }
  return "development";
}

export function getExtensionBridgeInfo(): ExtensionBridgeInfo {
  const manifest = browser.runtime.getManifest();
  return {
    source: EXTENSION_BRIDGE_SOURCE,
    type: "EXTENSION_INFO",
    version: manifest.version,
    versionName: manifest.version_name,
    channel: resolveChannel(),
    name: manifest.name,
  };
}
