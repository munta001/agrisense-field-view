import { ReactNode } from "react";
import { Navigate, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Leaf, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/master-admin", label: "Overview", end: true },
  { to: "/master-admin/organisations", label: "Organisations" },
  { to: "/master-admin/users", label: "Users" },
];

export function MasterAdminLayout({ children }: { children: ReactNode }) {
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
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Leaf className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">AgriSense</span>
            <Badge variant="default" className="ml-1">Master Admin</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 sm:px-4">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="space-y-6 p-4 sm:p-6">{children}</main>
    </div>
  );
}
