export function displayHostPath(url: string): string {
  try {
    const parsed = new URL(url);
    const path = `${parsed.host}${parsed.pathname}${parsed.search}`.replace(/\/$/, "");
    return path || parsed.host;
  } catch {
    return url;
  }
}

export function relativeTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const delta = Date.now() - date.getTime();
  const mins = Math.round(delta / 60000);
  if (Number.isNaN(mins)) return "unknown";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return date.toLocaleDateString();
}

export function parseUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown client";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  if (ua.toLowerCase().includes("trackingext") || ua.includes("extension")) return "Extension";
  return "Browser";
}
