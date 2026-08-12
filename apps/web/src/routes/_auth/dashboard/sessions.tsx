import { createFileRoute } from "@tanstack/react-router";

import { SessionsPanel } from "@/components/dashboard/sessions-panel";

export const Route = createFileRoute("/_auth/dashboard/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  return <SessionsPanel />;
}
