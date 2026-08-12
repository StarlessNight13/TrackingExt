import { createFileRoute } from "@tanstack/react-router";

import { PrivacySettingsPanel } from "@/components/dashboard/privacy-settings-panel";

export const Route = createFileRoute("/_auth/dashboard/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return <PrivacySettingsPanel />;
}
