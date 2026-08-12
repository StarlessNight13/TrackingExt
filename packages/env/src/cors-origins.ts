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
): string {
  if (origin && isMatchingWebOrigin(origin, configuredOrigin)) {
    return origin;
  }

  return configuredOrigin;
}
