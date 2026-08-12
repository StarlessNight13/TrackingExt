import type { TrackedTab } from "./types";

export function formatDevice(tab: TrackedTab) {
  const device = tab.lastUpdatedDevice;
  if (!device) return "Unknown device";
  return device.name;
}

export function relativeTime(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.round(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}
