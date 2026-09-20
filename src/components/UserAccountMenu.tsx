import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserAccountMenu() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { orgs, currentOrg, currentRole, setCurrentOrg } = useOrg();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user?.id]);

  const name = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "User";
  const initials = useMemo(
    () => name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "U",
    [name],
  );
  const roleLabel = currentRole?.role
    ? currentRole.role.charAt(0).toUpperCase() + currentRole.role.slice(1).replace(/_/g, " ")
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-12 max-w-[250px] gap-3 rounded-lg px-2 text-left hover:bg-muted"
          aria-label="Open account menu"
        >
          <div className="hidden min-w-0 flex-1 text-right sm:block">
            <p className="truncate text-sm font-semibold leading-none text-foreground">{name}</p>
            <p className="mt-1.5 truncate text-[11px] font-semibold uppercase text-primary">{currentOrg?.name}</p>
          </div>
          <Avatar className="h-9 w-9 border border-primary/20 bg-secondary">
            <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} alt={name} />
            <AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-semibold text-foreground">
              {name}{roleLabel ? ` (${roleLabel})` : ""}
            </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <UserRound className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        {orgs.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Organisations</DropdownMenuLabel>
            {orgs.map(org => (
              <DropdownMenuItem key={org.id} onClick={() => setCurrentOrg(org)} className="justify-between">
                <span className="truncate">{org.name}</span>
                {org.id === currentOrg?.id && <Check className="ml-2 h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}