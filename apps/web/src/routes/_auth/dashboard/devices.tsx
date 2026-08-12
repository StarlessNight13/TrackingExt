import { createFileRoute } from "@tanstack/react-router";

import { DevicesPanel } from "@/components/dashboard/devices-panel";

export const Route = createFileRoute("/_auth/dashboard/devices")({
  component: DevicesPage,
});

function DevicesPage() {
  return <DevicesPanel />;
}
