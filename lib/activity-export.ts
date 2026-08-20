import type { HistoryEntry, TrackedTab } from "./types";

export type ExportableActivity = Pick<
  TrackedTab,
  | "id"
  | "name"
  | "emoji"
  | "tags"
  | "currentUrl"
  | "currentTitle"
  | "lastUpdatedAt"
  | "createdAt"
  | "archivedAt"
> & {
  activeDevice: { name: string } | null;
  lastUpdatedDevice: { name: string } | null;
};

export type ExportableHistoryEntry = Pick<HistoryEntry, "url" | "title" | "visitedAt">;

export type ActivityExportPayload = {
  exportedAt: string;
  activity: ExportableActivity;
  history: ExportableHistoryEntry[];
};

export function toExportableActivity(tab: TrackedTab): ExportableActivity {
  return {
    id: tab.id,
    name: tab.name,
    emoji: tab.emoji,
    tags: tab.tags,
    currentUrl: tab.currentUrl,
    currentTitle: tab.currentTitle,
    lastUpdatedAt: tab.lastUpdatedAt,
    createdAt: tab.createdAt,
    archivedAt: tab.archivedAt,
    activeDevice: tab.activeDevice ? { name: tab.activeDevice.name } : null,
    lastUpdatedDevice: tab.lastUpdatedDevice ? { name: tab.lastUpdatedDevice.name } : null,
  };
}

export function buildActivityExport(
  activity: TrackedTab,
  history: HistoryEntry[],
): ActivityExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    activity: toExportableActivity(activity),
    history: history.map((entry) => ({
      url: entry.url,
      title: entry.title,
      visitedAt: entry.visitedAt,
    })),
  };
}

export function activityExportToJson(payload: ActivityExportPayload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function activityExportToMarkdown(payload: ActivityExportPayload) {
  const { activity, history, exportedAt } = payload;
  const title = activity.emoji ? `${activity.emoji} ${activity.name}` : activity.name;
  const lines = [
    `# ${title}`,
    "",
    `- Current: [${activity.currentTitle || activity.currentUrl}](${activity.currentUrl})`,
    `- Tags: ${activity.tags.length > 0 ? activity.tags.join(", ") : "none"}`,
    `- Last updated: ${activity.lastUpdatedAt}${
      activity.lastUpdatedDevice ? ` from ${activity.lastUpdatedDevice.name}` : ""
    }`,
    `- Created: ${activity.createdAt}`,
    `- Exported: ${exportedAt}`,
    "",
  ];

  if (history.length === 0) {
    lines.push("_No history entries._", "");
  } else {
    lines.push("## History", "");
    for (const entry of history) {
      const label = entry.title || entry.url;
      lines.push(`- ${entry.visitedAt} — [${label}](${entry.url})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function activityExportToLinks(payload: ActivityExportPayload) {
  const urls = [payload.activity.currentUrl, ...payload.history.map((entry) => entry.url)];
  const unique: string[] = [];
  for (const url of urls) {
    if (!unique.includes(url)) unique.push(url);
  }
  return `${unique.join("\n")}\n`;
}

export function slugifyFilename(name: string) {
  const slug = name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "activity";
}

export function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type ActivityExportFormat = "json" | "markdown" | "links";

export function buildActivityExportFile(
  payload: ActivityExportPayload,
  format: ActivityExportFormat,
) {
  const slug = slugifyFilename(payload.activity.name);
  switch (format) {
    case "json":
      return {
        filename: `${slug}.json`,
        mimeType: "application/json",
        contents: activityExportToJson(payload),
      };
    case "markdown":
      return {
        filename: `${slug}.md`,
        mimeType: "text/markdown",
        contents: activityExportToMarkdown(payload),
      };
    case "links":
      return {
        filename: `${slug}-links.txt`,
        mimeType: "text/plain",
        contents: activityExportToLinks(payload),
      };
  }
}
