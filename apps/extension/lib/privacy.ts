import type { PrivacySettings } from "./types";

/** Query keys that often carry secrets — always stripped. */
const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "id_token",
  "idToken",
  "auth",
  "authorization",
  "api_key",
  "apiKey",
  "apikey",
  "key",
  "password",
  "passwd",
  "secret",
  "session",
  "sessionid",
  "session_id",
  "jwt",
  "bearer",
  "code",
  "oauth_token",
  "sig",
  "signature",
]);

export function isTrackableUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isExcludedHost(url: string, excludedHosts: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return excludedHosts.some((raw) => {
      const h = raw.toLowerCase().trim();
      if (!h) return false;
      return host === h || host.endsWith(`.${h}`);
    });
  } catch {
    return false;
  }
}

/**
 * Normalize a URL before storing/syncing.
 * Always strips sensitive query params; optionally strips all query/hash.
 */
export function sanitizeUrl(url: string, settings: PrivacySettings): string {
  const parsed = new URL(url);

  if (settings.stripFragments) {
    parsed.hash = "";
  }

  if (settings.stripQueryParams) {
    parsed.search = "";
  } else {
    const kept = new URLSearchParams();
    parsed.searchParams.forEach((value, key) => {
      if (!SENSITIVE_QUERY_KEYS.has(key) && !SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        kept.append(key, value);
      }
    });
    parsed.search = kept.toString() ? `?${kept.toString()}` : "";
  }

  return parsed.toString();
}

export function displayHostPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}${parsed.search}`.replace(/\/$/, "") || parsed.host;
  } catch {
    return url;
  }
}
