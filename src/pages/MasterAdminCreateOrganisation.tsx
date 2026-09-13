import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Upload, Building2 } from "lucide-react";
import { toast } from "sonner";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function MasterAdminCreateOrganisationPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Logo must be under 5 MB");
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const create = async () => {
    if (!name.trim()) return toast.error("Enter an organisation name");
    if (!slug.trim()) return toast.error("Enter a short code (slug)");
    setSaving(true);
    try {
      let logo_base64: string | null = null;
      let logo_content_type: string | null = null;
      if (logoFile) {
        logo_content_type = logoFile.type;
        const buf = await logoFile.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        logo_base64 = btoa(binary);
      }
      const { data, error } = await supabase.functions.invoke("master-admin-manage", {
        body: { action: "create_org", name, slug, logo_base64, logo_content_type },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Could not create organisation");
        return;
      }
      toast.success("Organisation created");
      navigate("/master-admin/organisations");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MasterAdminLayout>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/master-admin/organisations"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Create organisation</h1>
          <p className="text-muted-foreground">Set up a new organisation on the platform</p>
        </div>
      </div>

      <Card className="glass-card max-w-xl">
        <CardHeader><CardTitle className="font-display text-lg">Organisation details</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="org-name">Name *</Label>
            <Input
              id="org-name"
              value={name}
              onChange={e => onNameChange(e.target.value)}
              placeholder="Green Valley Farm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-slug">Short code (slug) *</Label>
            <Input
              id="org-slug"
              value={slug}
              onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
              placeholder="green-valley-farm"
            />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers and dashes only. Used in links.</p>
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
                {logoPreview ? (
                  <img src={logoPreview} alt="Organisation logo preview" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <input id="org-logo" type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="org-logo" className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" /> {logoFile ? "Change image" : "Upload logo"}
                  </label>
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">PNG or JPG, up to 5 MB</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" asChild><Link to="/master-admin/organisations">Cancel</Link></Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create organisation
            </Button>
          </div>
        </CardContent>
      </Card>
    </MasterAdminLayout>
  );
}
