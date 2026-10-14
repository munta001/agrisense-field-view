import {
  LayoutDashboard, Activity, Map, FileInput, BarChart3, Bell, FileText, Settings, LogOut, ChevronDown, Sprout, MapPin, UserRound,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlatformLogo } from "@/components/PlatformLogo";
import { BrandName } from "@/components/BrandName";


const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Sensors", url: "/sensors", icon: Activity },
  { title: "Field Map", url: "/field-map", icon: Map },
  { title: "Data Entry", url: "/data-entry", icon: FileInput },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Alerts", url: "/alerts", icon: Bell },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Crops", url: "/crops", icon: Sprout },
  { title: "Zones", url: "/zones", icon: MapPin },
];

const adminItems = [
  { title: "Admin Panel", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { orgs, currentOrg, setCurrentOrg, currentRole } = useOrg();

  // On mobile the sidebar is an overlay drawer — close it whenever a
  // navigation link inside it is tapped so the page underneath is visible.
  const closeMobileNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <PlatformLogo className="h-11 w-11 rounded-lg bg-sidebar-primary p-2 shadow-sm" iconClassName="h-6 w-6 text-sidebar-primary-foreground" />
          {!collapsed && (
            <BrandName className="font-display text-xl font-bold text-sidebar-foreground" />
          )}

        </div>

        {/* Org Switcher */}
        {!collapsed && currentOrg && (
          <div className="px-3 pb-1 pt-4">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5 text-sm text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-sidebar-border bg-sidebar-background">
                  {currentOrg.logo_url ? (
                    <img src={currentOrg.logo_url} alt={`${currentOrg.name} logo`} className="h-full w-full object-contain" />
                  ) : (
                    <Sprout className="h-5 w-5 text-sidebar-primary" />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-[10px] font-semibold uppercase text-sidebar-foreground/50">Organisation</span>
                  <span className="mt-0.5 block truncate font-medium">{currentOrg.name}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {orgs.map(org => (
                  <DropdownMenuItem key={org.id} onClick={() => setCurrentOrg(org)} className="gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                      {org.logo_url ? (
                        <img src={org.logo_url} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Sprout className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </span>
                    <span className="truncate">{org.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <SidebarGroup className="px-3 pt-4">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase text-sidebar-foreground/40">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end onClick={closeMobileNav} className="rounded-lg text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground" activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium shadow-sm">
                      <item.icon className="mr-2 h-4 w-4 text-sidebar-primary" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {currentRole?.role === "admin" && (
          <SidebarGroup className="px-3">
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase text-sidebar-foreground/40">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className="rounded-lg text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground" activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium shadow-sm">
                        <item.icon className="mr-2 h-4 w-4 text-sidebar-primary" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/profile" end className="rounded-lg text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground" activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium">
                <UserRound className="mr-2 h-4 w-4 text-sidebar-primary" />
                {!collapsed && <span>Profile</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="rounded-lg text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
