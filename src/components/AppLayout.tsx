import { Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { Leaf, Loader2 } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentOrg, loading, deactivated } = useOrg();
  const { isMasterAdmin, masterAdminLoading } = useAuth();

  if (loading || masterAdminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isMasterAdmin) return <Navigate to="/master-admin" replace />;

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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card/50 backdrop-blur-sm px-4 sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
