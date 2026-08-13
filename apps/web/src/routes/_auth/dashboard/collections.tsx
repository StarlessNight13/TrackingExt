import { createFileRoute } from "@tanstack/react-router";

import { CollectionsPanel } from "@/components/dashboard/collections-panel";

export const Route = createFileRoute("/_auth/dashboard/collections")({
  component: CollectionsPage,
});

function CollectionsPage() {
  return <CollectionsPanel />;
}
