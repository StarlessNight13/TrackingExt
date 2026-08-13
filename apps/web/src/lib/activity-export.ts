export type ExportableActivity = {
  id: string;
  name: string;
  emoji: string | null;
  tags: string[];
  currentUrl: string;
  currentTitle: string | null;
  lastUpdatedAt: string;
  createdAt: string;
  archivedAt: string | null;
  activeDevice: { name: string } | null;
  lastUpdatedDevice: { name: string } | null;
};

export type ExportableHistoryEntry = {
  url: string;
  title: string | null;
  visitedAt: string;
};

export type ActivityExportPayload = {
  exportedAt: string;
  activity: ExportableActivity;
  history: ExportableHistoryEntry[];
};

export function buildActivityExport(
  activity: ExportableActivity,
  history: ExportableHistoryEntry[],
): ActivityExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    activity: {
      id: activity.id,
      name: activity.name,
      emoji: activity.emoji,
      tags: activity.tags,
      currentUrl: activity.currentUrl,
      currentTitle: activity.currentTitle,
      lastUpdatedAt: activity.lastUpdatedAt,
      createdAt: activity.createdAt,
      archivedAt: activity.archivedAt,
      activeDevice: activity.activeDevice ? { name: activity.activeDevice.name } : null,
      lastUpdatedDevice: activity.lastUpdatedDevice
        ? { name: activity.lastUpdatedDevice.name }
        : null,
    },
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

export function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function slugifyFilename(name: string) {
  const slug = name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "activity";
}
