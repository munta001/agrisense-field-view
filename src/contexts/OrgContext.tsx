import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Organization = Tables<"organizations">;
type UserRole = Tables<"user_roles">;

interface OrgContextType {
  orgs: Organization[];
  currentOrg: Organization | null;
  currentRole: UserRole | null;
  setCurrentOrg: (org: Organization) => void;
  loading: boolean;
  deactivated: boolean;
  refetchOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType>({
  orgs: [],
  currentOrg: null,
  currentRole: null,
  setCurrentOrg: () => {},
  loading: true,
  deactivated: false,
  refetchOrgs: async () => {},
});

export const useOrg = () => useContext(OrgContext);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const [deactivated, setDeactivated] = useState(false);

  const fetchOrgs = async () => {
    if (authLoading) { setLoading(true); return; }
    if (!user) { setOrgs([]); setCurrentOrg(null); setCurrentRole(null); setDeactivated(false); setLoading(false); return; }
    setLoading(true);
    const { data: allRoles } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", user.id)
      .not("org_id", "is", null);
    if (!allRoles?.length) { setOrgs([]); setCurrentOrg(null); setCurrentRole(null); setDeactivated(false); setLoading(false); return; }
    const roles = allRoles.filter((r: any) => r.is_active !== false);
    if (!roles.length) { setOrgs([]); setCurrentOrg(null); setCurrentRole(null); setDeactivated(true); setLoading(false); return; }
    const orgIds = roles.map(r => r.org_id);
    const { data: allOrgs } = await supabase.from("organizations").select("*").in("id", orgIds);
    const orgData = (allOrgs || []).filter((o: any) => o.is_active !== false);
    setDeactivated(orgData.length === 0 && (allOrgs?.length ?? 0) > 0);
    setOrgs(orgData);
    const savedOrgId = localStorage.getItem("agrisense_org_id");
    const saved = orgData.find(o => o.id === savedOrgId);
    const selected = saved || orgData[0] || null;
    setCurrentOrg(selected);
    if (selected) {
      const role = roles.find(r => r.org_id === selected.id) || null;
      setCurrentRole(role);
      localStorage.setItem("agrisense_org_id", selected.id);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrgs(); }, [user?.id, authLoading]);

  const handleSetOrg = (org: Organization) => {
    setCurrentOrg(org);
    localStorage.setItem("agrisense_org_id", org.id);
    supabase.from("user_roles").select("*").eq("user_id", user!.id).eq("org_id", org.id).single()
      .then(({ data }) => setCurrentRole(data));
  };

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, currentRole, setCurrentOrg: handleSetOrg, loading, deactivated, refetchOrgs: fetchOrgs }}>
      {children}
    </OrgContext.Provider>
  );
}
