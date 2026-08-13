import {
  Bookmark,
  FolderKanban,
  KeyRound,
  MonitorSmartphone,
  Puzzle,
  Radio,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavItem = {
  to:
    | "/dashboard"
    | "/dashboard/collections"
    | "/dashboard/devices"
    | "/dashboard/settings"
    | "/dashboard/sessions"
    | "/dashboard/extension"
    | "/dashboard/sync";
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const DASHBOARD_NAV: DashboardNavItem[] = [
  { to: "/dashboard", label: "Tracked", icon: Bookmark, exact: true },
  { to: "/dashboard/collections", label: "Collections", icon: FolderKanban },
  { to: "/dashboard/sync", label: "Sync", icon: Radio },
  { to: "/dashboard/devices", label: "Devices", icon: MonitorSmartphone },
  { to: "/dashboard/sessions", label: "Sessions", icon: KeyRound },
  { to: "/dashboard/extension", label: "Extension", icon: Puzzle },
];

export const DASHBOARD_SETTINGS_NAV: DashboardNavItem = {
  to: "/dashboard/settings",
  label: "Settings",
  icon: Settings,
};

export function getDashboardNavItem(pathname: string) {
  const items = [...DASHBOARD_NAV, DASHBOARD_SETTINGS_NAV];
  return (
    items.find((item) =>
      item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
    ) ?? DASHBOARD_NAV[0]
  );
}
