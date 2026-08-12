import type { LanSignalingMode, SyncModes } from "./types";

export const DEFAULT_SYNC_MODES: SyncModes = {
  offline: false,
  lan: false,
  server: true,
};

export function isValidSyncModes(modes: SyncModes): boolean {
  return modes.offline || modes.lan || modes.server;
}

export function isServerSyncActive(modes: SyncModes, serverUrl: string | null, sessionToken: string | null) {
  return modes.server && Boolean(serverUrl && sessionToken);
}

export function resolveLanSignalingMode(
  modes: SyncModes,
  explicit?: LanSignalingMode,
): LanSignalingMode {
  if (modes.lan && !modes.server) return "local";
  if (explicit) return explicit;
  if (modes.lan && modes.server) return "server-relay";
  return "local";
}

export function usesServerRelayForLan(
  modes: SyncModes,
  lanSignalingMode: LanSignalingMode,
  serverUrl: string | null,
) {
  return modes.lan && lanSignalingMode === "server-relay" && Boolean(serverUrl);
}

export function needsServerUrlStep(modes: SyncModes, lanSignalingMode?: LanSignalingMode) {
  if (modes.server) return true;
  return modes.lan && resolveLanSignalingMode(modes, lanSignalingMode) === "server-relay";
}

export function needsServerUrl(
  modes: SyncModes,
  lanSignalingMode: LanSignalingMode,
  serverUrl: string | null = null,
) {
  if (modes.server) return true;
  if (!modes.lan) return false;
  if (lanSignalingMode === "server-relay") return true;
  if (!serverUrl) return true;
  return false;
}

export type OnboardingStepId = "modes" | "server" | "pairing" | "device" | "auth";

export function getOnboardingSteps(
  modes: SyncModes,
  lanSignalingMode?: LanSignalingMode,
): OnboardingStepId[] {
  const steps: OnboardingStepId[] = ["modes"];
  if (needsServerUrlStep(modes, lanSignalingMode)) steps.push("server");
  if (modes.lan) steps.push("pairing");
  steps.push("device");
  if (modes.server) steps.push("auth");
  return steps;
}

export function getOnboardingStepLabel(step: OnboardingStepId, modes: SyncModes): string {
  switch (step) {
    case "modes":
      return "Sync modes";
    case "server":
      if (modes.server && modes.lan) return "Server URL";
      if (modes.server) return "Server URL";
      return "Relay URL";
    case "pairing":
      return modes.server ? "LAN pairing" : "LAN pairing (local)";
    case "device":
      return "Device name";
    case "auth":
      return "Sign in";
  }
}

export function describeSyncModes(modes: SyncModes): string {
  const parts: string[] = [];
  if (modes.offline) parts.push("Offline");
  if (modes.lan) parts.push("LAN");
  if (modes.server) parts.push("Server");
  return parts.join(" + ") || "None";
}
