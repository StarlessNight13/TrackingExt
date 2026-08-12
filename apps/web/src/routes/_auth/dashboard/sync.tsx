import { createFileRoute } from "@tanstack/react-router";

import { SyncSettingsPanel } from "@/components/dashboard/sync-settings-panel";

export const Route = createFileRoute("/_auth/dashboard/sync")({
  component: SyncPage,
});

function SyncPage() {
  return <SyncSettingsPanel />;
}
