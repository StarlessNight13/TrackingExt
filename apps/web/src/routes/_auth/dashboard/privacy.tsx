import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/dashboard/privacy")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/settings" });
  },
});
