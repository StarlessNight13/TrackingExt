export const EXTENSION_BRIDGE_SOURCE = "trackingext-extension" as const;
export const DASHBOARD_BRIDGE_SOURCE = "trackingext-dashboard" as const;

export type ExtensionBridgeInfo = {
  source: typeof EXTENSION_BRIDGE_SOURCE;
  type: "EXTENSION_INFO";
  version: string;
  versionName?: string;
  channel: "self-hosted" | "store" | "development";
  name: string;
};

export type DashboardBridgePing = {
  source: typeof DASHBOARD_BRIDGE_SOURCE;
  type: "EXTENSION_PING";
};

export function isExtensionBridgeInfo(data: unknown): data is ExtensionBridgeInfo {
  if (!data || typeof data !== "object") return false;
  const value = data as Partial<ExtensionBridgeInfo>;
  return (
    value.source === EXTENSION_BRIDGE_SOURCE &&
    value.type === "EXTENSION_INFO" &&
    typeof value.version === "string" &&
    typeof value.name === "string" &&
    (value.channel === "self-hosted" ||
      value.channel === "store" ||
      value.channel === "development")
  );
}
