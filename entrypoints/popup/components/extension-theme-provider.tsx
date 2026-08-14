import { useEffect } from "react";

import { subscribeDashboardTheme } from "@/lib/dashboard-theme";
import type { PrivacySettings } from "@/lib/types";

export function ExtensionThemeProvider({
  settings,
  children,
}: {
  settings?: PrivacySettings;
  children: React.ReactNode;
}) {
  useEffect(
    () => subscribeDashboardTheme(document.documentElement, settings),
    [settings?.dashboardThemeSeed, settings?.dashboardThemeVariant],
  );

  return children;
}
