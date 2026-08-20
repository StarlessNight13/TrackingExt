import { useTransition } from "react";

import {
  buildActivityExport,
  buildActivityExportFile,
  downloadTextFile,
  type ActivityExportFormat,
} from "@/lib/activity-export";
import { sendMessage } from "@/lib/messaging";
import type { HistoryEntry, TrackedTab } from "@/lib/types";

export function ExportActivityButtons({
  tracked,
  disabled = false,
  className = "btn ghost",
}: {
  tracked: TrackedTab;
  disabled?: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  const exportActivity = (format: ActivityExportFormat) => {
    startTransition(async () => {
      const res = await sendMessage({ type: "GET_HISTORY", trackedTabId: tracked.id });
      if (!res.ok) throw new Error(res.error);
      const payload = buildActivityExport(tracked, (res.history ?? []) as HistoryEntry[]);
      const file = buildActivityExportFile(payload, format);
      downloadTextFile(file.filename, file.contents, file.mimeType);
    });
  };

  return (
    <>
      <button className={className} disabled={disabled || pending} onClick={() => exportActivity("json")}>
        Export JSON
      </button>
      <button className={className} disabled={disabled || pending} onClick={() => exportActivity("markdown")}>
        Export Markdown
      </button>
      <button className={className} disabled={disabled || pending} onClick={() => exportActivity("links")}>
        Export links
      </button>
    </>
  );
}
