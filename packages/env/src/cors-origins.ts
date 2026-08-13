export function expandLocalDevOrigins(origin: string): string[] {
  const origins = new Set<string>([origin]);

  try {
    const url = new URL(origin);
    const port = url.port ? `:${url.port}` : "";

    if (url.hostname === "localhost") {
      origins.add(`${url.protocol}//127.0.0.1${port}`);
    } else if (url.hostname === "127.0.0.1") {
      origins.add(`${url.protocol}//localhost${port}`);
    }
  } catch {
    // Ignore invalid configured origins.
  }

  return [...origins];
}

/** LAN / loopback / Tailscale hosts used when opening the dashboard from another device. */
export function isPrivateNetworkOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }
    if (/^10(?:\.\d{1,3}){3}$/.test(hostname)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(hostname)) return true;
    if (/^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function isMatchingWebOrigin(
  origin: string | null | undefined,
  configuredOrigin: string,
): boolean {
  if (!origin) {
    return false;
  }

  return expandLocalDevOrigins(configuredOrigin).includes(origin);
}

export function resolveCorsOrigin(
  origin: string | null | undefined,
  configuredOrigin: string,
  options?: { allowPrivateNetworkOrigins?: boolean },
): string {
  if (origin && isMatchingWebOrigin(origin, configuredOrigin)) {
    return origin;
  }

  if (origin && options?.allowPrivateNetworkOrigins && isPrivateNetworkOrigin(origin)) {
    return origin;
  }

  return configuredOrigin;
}
