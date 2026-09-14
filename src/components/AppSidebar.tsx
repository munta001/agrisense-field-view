import {
  LayoutDashboard, Activity, Map, FileInput, BarChart3, Bell, FileText, Settings, LogOut, Leaf, ChevronDown, Sprout, MapPin, UserRound,
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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { orgs, currentOrg, setCurrentOrg, currentRole } = useOrg();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm">
            <Leaf className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display text-xl font-bold text-sidebar-foreground">
              AgriSense
            </span>
          )}
        </div>

        {/* Org Switcher */}
        {!collapsed && currentOrg && (
          <div className="px-3 pb-1 pt-4">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5 text-sm text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent">
                <span className="min-w-0 text-left">
                  <span className="block text-[10px] font-semibold uppercase text-sidebar-foreground/50">Organisation</span>
                  <span className="mt-0.5 block truncate font-medium">{currentOrg.name}</span>
                </span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {orgs.map(org => (
                  <DropdownMenuItem key={org.id} onClick={() => setCurrentOrg(org)}>
                    {org.name}
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
