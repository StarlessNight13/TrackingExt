import { createFileRoute } from "@tanstack/react-router";

import { GroupsPanel } from "@/components/dashboard/groups-panel";

export const Route = createFileRoute("/_auth/dashboard/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  return <GroupsPanel />;
}
