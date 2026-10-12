import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlatformLogo } from "@/components/PlatformLogo";
import { BrandName } from "@/components/BrandName";


export default function OnboardingPage() {
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { refetchOrgs } = useOrg();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { data: org, error: orgErr } = await supabase.from("organizations").insert({ name: orgName, slug }).select().single();
      if (orgErr) throw orgErr;
      const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: user.id, org_id: org.id, role: "admin" as const });
      if (roleErr) throw roleErr;
      await refetchOrgs();
      toast({ title: "Organisation created!", description: "You are now the admin." });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <PlatformLogo className="mb-4 h-14 w-14 rounded-2xl gradient-primary p-3 shadow-lg" iconClassName="h-7 w-7 text-primary-foreground" />
          <h1 className="font-display text-3xl font-bold text-foreground">
            Welcome to <BrandName className="h-8 w-40" />
          </h1>

          <p className="mt-1 text-muted-foreground">Create your organisation to get started</p>
        </div>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Create Organisation</CardTitle>
            <CardDescription>This will be your farm or company workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input placeholder="Organisation Name (e.g. Green Valley Farm)" value={orgName} onChange={e => setOrgName(e.target.value)} required />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create & Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
