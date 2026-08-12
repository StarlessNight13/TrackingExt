import { createFileRoute } from "@tanstack/react-router";

import { ExtensionGuidePanel } from "@/components/dashboard/extension-guide-panel";

export const Route = createFileRoute("/_auth/dashboard/extension")({
  component: ExtensionPage,
});

function ExtensionPage() {
  return <ExtensionGuidePanel />;
}
