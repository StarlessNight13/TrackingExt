import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@trackingext/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import type { ComponentProps } from "react";

import { NavUser } from "@/components/nav-user";
import { DASHBOARD_NAV, DASHBOARD_SETTINGS_NAV } from "@/lib/dashboard-nav";
import { orpc } from "@/utils/orpc";

type AppSidebarProps = ComponentProps<typeof Sidebar>;

function isNavActive(pathname: string, to: string, exact?: boolean) {
  return exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

export function AppSidebar({ variant = "inset", ...props }: AppSidebarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const tabsQuery = useQuery(orpc.trackedTabs.list.queryOptions());
  const tabCount = tabsQuery.data?.length ?? 0;
  const SettingsIcon = DASHBOARD_SETTINGS_NAV.icon;

  return (
    <Sidebar collapsible="icon" variant={variant} {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            <LayoutDashboard className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/70">
              TrackingExt
            </span>
            <span className="truncate text-sm font-medium">Dashboard</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DASHBOARD_NAV.map(({ to, label, icon: Icon, exact }) => {
                const isActive = isNavActive(pathname, to, exact);

                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link to={to} />}
                      tooltip={label}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {to === "/dashboard" && tabCount > 0 ? (
                      <SidebarMenuBadge>{tabCount}</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isNavActive(pathname, DASHBOARD_SETTINGS_NAV.to)}
              render={<Link to={DASHBOARD_SETTINGS_NAV.to} />}
              tooltip={DASHBOARD_SETTINGS_NAV.label}
            >
              <SettingsIcon />
              <span>{DASHBOARD_SETTINGS_NAV.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
