import { useEffect, useState } from "react";

import {
  DASHBOARD_BRIDGE_SOURCE,
  isExtensionBridgeInfo,
  type ExtensionBridgeInfo,
} from "@/lib/extension-bridge";

export type ServedExtensionPackage = {
  version: string;
  channel: "self-hosted" | "store" | "development";
  builtAt?: string;
};

export type ExtensionInstallStatus =
  | { status: "checking" }
  | { status: "missing"; served: ServedExtensionPackage | null }
  | {
      status: "detected";
      installed: ExtensionBridgeInfo;
      served: ServedExtensionPackage | null;
      comparison: "unknown" | "up-to-date" | "outdated" | "ahead";
    };

function compareSemver(a: string, b: string): number {
  const parse = (value: string) =>
    value
      .split(/[.+-]/)
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10) || 0);

  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

async function fetchServedPackage(): Promise<ServedExtensionPackage | null> {
  try {
    const response = await fetch("/downloads/extension-version.json", {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<ServedExtensionPackage>;
    if (typeof data.version !== "string") return null;
    return {
      version: data.version,
      channel:
        data.channel === "store" || data.channel === "development"
          ? data.channel
          : "self-hosted",
      builtAt: typeof data.builtAt === "string" ? data.builtAt : undefined,
    };
  } catch {
    return null;
  }
}

function compareVersions(
  installed: ExtensionBridgeInfo,
  served: ServedExtensionPackage | null,
): "unknown" | "up-to-date" | "outdated" | "ahead" {
  if (!served) return "unknown";
  const result = compareSemver(installed.version, served.version);
  if (result < 0) return "outdated";
  if (result > 0) return "ahead";
  return "up-to-date";
}

export function useExtensionInstallStatus(): ExtensionInstallStatus {
  const [state, setState] = useState<ExtensionInstallStatus>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    let installed: ExtensionBridgeInfo | null = null;
    let served: ServedExtensionPackage | null = null;

    const publish = () => {
      if (cancelled) return;
      if (!installed) {
        setState({ status: "missing", served });
        return;
      }
      setState({
        status: "detected",
        installed,
        served,
        comparison: compareVersions(installed, served),
      });
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (!isExtensionBridgeInfo(event.data)) return;
      installed = event.data;
      publish();
    };

    window.addEventListener("message", onMessage);

    const ping = () => {
      window.postMessage(
        { source: DASHBOARD_BRIDGE_SOURCE, type: "EXTENSION_PING" },
        window.location.origin,
      );
    };

    void fetchServedPackage().then((packageInfo) => {
      if (cancelled) return;
      served = packageInfo;
      publish();
    });

    // Give the content script a moment to answer before showing "not installed".
    ping();
    const retry = window.setTimeout(ping, 250);
    const settle = window.setTimeout(() => {
      if (!cancelled && !installed) publish();
    }, 700);

    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(retry);
      window.clearTimeout(settle);
    };
  }, []);

  return state;
}
