import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Theme as MaterialTheme } from "@trackingext/ui/components/theme";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/components/theme-provider";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }
    return { session };
  },
});

function AuthLayout() {
  const { resolvedTheme } = useTheme();
  const settingsQuery = useQuery(orpc.settings.get.queryOptions());
  const settings = settingsQuery.data;

  return (
    <MaterialTheme
      seed={settings?.dashboardThemeSeed ?? "#6750A4"}
      variant={settings?.dashboardThemeVariant ?? "TONAL_SPOT"}
      colorMode={resolvedTheme === "dark" ? "dark" : "light"}
      storageKey={null}
    >
      <main className="flex min-h-full flex-1 flex-col overflow-hidden bg-background">
        <Outlet />
      </main>
    </MaterialTheme>
  );
}
