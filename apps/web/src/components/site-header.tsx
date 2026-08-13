import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@trackingext/ui/components/breadcrumb";
import { Separator } from "@trackingext/ui/components/separator";
import { SidebarTrigger } from "@trackingext/ui/components/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";

import { ModeToggle } from "@/components/mode-toggle";
import { getDashboardNavItem } from "@/lib/dashboard-nav";

export function SiteHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentPage = getDashboardNavItem(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/[data-slot=sidebar-wrapper]:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-vertical:h-4 data-vertical:self-center"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink render={<Link to="/dashboard" />}>Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentPage.label}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
