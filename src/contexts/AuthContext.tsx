import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isMasterAdmin: boolean;
  masterAdminLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isMasterAdmin: false,
  masterAdminLoading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// Records a "user_signed_in" activity log entry for each organisation the user
// actively belongs to. Guarded per browser session so token refreshes don't
// create duplicate entries.
async function logSignIn(userId: string) {
  const flag = `signin-logged-${userId}`;
  try {
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, "1");
    const { data: memberships } = await (supabase as any)
      .from("user_roles")
      .select("org_id, role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .not("org_id", "is", null);
    if (!memberships?.length) return;
    await (supabase as any).from("activity_logs").insert(
      memberships.map((m: any) => ({
        org_id: m.org_id,
        user_id: userId,
        action: "user_signed_in",
        details: { role: m.role },
      }))
    );
  } catch {
    // logging must never break sign-in
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [masterAdminLoading, setMasterAdminLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "SIGNED_IN" && session?.user) logSignIn(session.user.id);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { setIsMasterAdmin(false); setMasterAdminLoading(false); return; }
    setMasterAdminLoading(true);
    (supabase as any)
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "master_admin")
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }: any) => {
        setIsMasterAdmin(!!data);
        setMasterAdminLoading(false);
      });
  }, [user?.id, loading]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isMasterAdmin, masterAdminLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
