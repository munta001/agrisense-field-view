import { Navigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { UserAccountMenu } from "@/components/UserAccountMenu";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { Leaf, Loader2 } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { currentOrg, loading, deactivated } = useOrg();
  const { isMasterAdmin, masterAdminLoading } = useAuth();
  const { platform_name } = useBranding();

  if (loading || masterAdminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isMasterAdmin) return <Navigate to="/master-admin" replace />;

  if (deactivated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center max-w-md space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-lg">
            <Leaf className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Organisation Deactivated</h1>
          <p className="text-muted-foreground">Your organisation has been deactivated. Please contact the platform administrator to restore access.</p>
        </div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center max-w-md space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-lg">
            <Leaf className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">No Organisation Assigned</h1>
          <p className="text-muted-foreground">Your account has not been assigned to an organisation yet. Please contact your administrator to get access.</p>
        </div>
      </div>
    );
  }

  const routeTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/sensors": "Sensors",
    "/field-map": "Field Map",
    "/data-entry": "Data Entry",
    "/analytics": "Analytics",
    "/alerts": "Alerts",
    "/reports": "Reports",
    "/crops": "Crops",
    "/zones": "Zones",
    "/admin": "Administration",
    "/profile": "Profile",
  };
  const pageTitle = pathname.startsWith("/sensors/") ? "Sensor details" : routeTitles[pathname] || platform_name;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-4 shadow-sm sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger />
              <div className="hidden h-6 w-px bg-border sm:block" />
              <p className="truncate font-display text-base font-semibold text-foreground sm:text-lg">{pageTitle}</p>
            </div>
            <UserAccountMenu />
          </header>
          <main className="flex-1 overflow-auto bg-muted/30 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
