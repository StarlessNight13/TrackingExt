import { createFileRoute } from "@tanstack/react-router";

import { SettingsPanel } from "@/components/dashboard/settings-panel";

export const Route = createFileRoute("/_auth/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return <SettingsPanel />;
}
