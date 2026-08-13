/**
 * Resolve the API origin for browser calls.
 * - unset / empty → current page origin (works when opening via host IP)
 * - absolute URL → used as-is (split API domain)
 * - path starting with `/` → current origin + path
 */
export function getServerUrl(configuredUrl?: string) {
  const raw = configuredUrl?.trim() ?? "";

  if (!raw) {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "http://localhost:3000";
  }

  const normalized = raw.endsWith("/") ? raw.slice(0, -1) : raw;

  if (!normalized.startsWith("/")) {
    return normalized;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${normalized}`;
  }

  const processEnv = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  const vercelUrl =
    processEnv?.VERCEL_ENV === "production"
      ? (processEnv?.VERCEL_PROJECT_PRODUCTION_URL ?? processEnv?.VERCEL_URL)
      : (processEnv?.VERCEL_URL ?? processEnv?.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelUrl) {
    const origin = vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
    return `${origin}${normalized}`;
  }

  return `http://localhost:3000${normalized}`;
}
