import { ReactNode, useState } from "react";
import { Navigate, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformLogo } from "@/components/PlatformLogo";
import { BrandName } from "@/components/BrandName";

const links = [
  { to: "/master-admin", label: "Overview", end: true },
  { to: "/master-admin/organisations", label: "Organisations" },
  { to: "/master-admin/users", label: "Users" },
  { to: "/master-admin/admins", label: "Master admins" },
  { to: "/master-admin/sensor-types", label: "Sensor types" },
  { to: "/master-admin/branding", label: "Platform branding" },
  { to: "/master-admin/profile", label: "Profile" },
];

export function MasterAdminLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isMasterAdmin, masterAdminLoading, signOut } = useAuth();

  if (masterAdminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isMasterAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex min-h-16 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <PlatformLogo className="h-8 w-8 rounded-lg gradient-primary p-1.5" iconClassName="text-primary-foreground" />
            <BrandName className="min-w-0 truncate font-display font-bold" />
            <Badge variant="default" className="ml-1 hidden sm:inline-flex">Master Admin</Badge>
          </div>
          <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Toggle administration menu" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(open => !open)}><Menu className="h-5 w-5" /></Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Sign out</span><span className="sr-only sm:hidden">Sign out</span>
          </Button>
          </div>
        </div>
        <nav aria-label="Administration" className={cn("gap-1 px-4 pb-3 sm:flex sm:overflow-x-auto sm:pb-2", mobileNavOpen ? "grid grid-cols-2" : "hidden")}>
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap rounded-md px-3 py-3 sm:py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="min-w-0 space-y-6 p-4 sm:p-6">{children}</main>
    </div>
  );
}
