import { createFileRoute } from "@tanstack/react-router";

import { TrackedTabsPanel } from "@/components/dashboard/tracked-tabs-panel";

export const Route = createFileRoute("/_auth/dashboard/")({
  component: TrackedPage,
});

function TrackedPage() {
  return <TrackedTabsPanel />;
}
