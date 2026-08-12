import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@trackingext/ui/components/breadcrumb";
import { Separator } from "@trackingext/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@trackingext/ui/components/sidebar";
import { Outlet, Link, createFileRoute, useRouterState } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { getDashboardNavItem } from "@/lib/dashboard-nav";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentPage = getDashboardNavItem(pathname);

  return (
    <SidebarProvider className="h-svh min-h-0">
      <AppSidebar />
      <SidebarInset className="max-h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-border">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="h-4 self-center data-vertical:h-4 data-vertical:self-center"
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
          </div>
          <div className="px-4">
            <ModeToggle />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-1 flex-col">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
