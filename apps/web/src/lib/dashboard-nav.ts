import {
  Bookmark,
  KeyRound,
  MonitorSmartphone,
  Puzzle,
  Radio,
  Shield,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavItem = {
  to:
    | "/dashboard"
    | "/dashboard/devices"
    | "/dashboard/privacy"
    | "/dashboard/sessions"
    | "/dashboard/extension"
    | "/dashboard/sync";
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const DASHBOARD_NAV: DashboardNavItem[] = [
  { to: "/dashboard", label: "Tracked", icon: Bookmark, exact: true },
  { to: "/dashboard/sync", label: "Sync", icon: Radio },
  { to: "/dashboard/devices", label: "Devices", icon: MonitorSmartphone },
  { to: "/dashboard/privacy", label: "Privacy", icon: Shield },
  { to: "/dashboard/sessions", label: "Sessions", icon: KeyRound },
  { to: "/dashboard/extension", label: "Extension", icon: Puzzle },
];

export function getDashboardNavItem(pathname: string) {
  return (
    DASHBOARD_NAV.find((item) =>
      item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
    ) ?? DASHBOARD_NAV[0]
  );
}
