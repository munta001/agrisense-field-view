import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function MasterAdminCreateOrganisationPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pageLoading, setPageLoading] = useState(isEdit);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogo, setExistingLogo] = useState<string | null>(null);
  const [sensorLimit, setSensorLimit] = useState("10");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data, error } = await (supabase as any).rpc("master_admin_overview");
      if (error) {
        toast.error(error.message);
        setPageLoading(false);
        return;
      }
      const org = (data?.organizations ?? []).find((o: any) => o.id === id);
      if (!org) {
        toast.error("Organisation not found");
        navigate("/master-admin/organisations");
        return;
      }
      setName(org.name);
      setSlug(org.slug);
      setSlugTouched(true);
      setExistingLogo(org.logo_url ?? null);
      setSensorLimit(String(org.sensor_limit ?? 10));
      setPageLoading(false);
    })();
  }, [id]);

  const onNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const onLogoChange = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Logo must be under 5 MB"); return; }
    setLogoFile(f);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const clearNewLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const fileToBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const save = async () => {
    if (!name.trim() || !slug.trim()) { toast.error("Name and slug are required"); return; }
    const limit = parseInt(sensorLimit, 10);
    if (!Number.isFinite(limit) || limit < 0) { toast.error("Sensor allowance must be a whole number"); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        slug: slugify(slug),
        sensor_limit: limit,
      };
      if (logoFile) {
        payload.logo_base64 = await fileToBase64(logoFile);
        payload.logo_content_type = logoFile.type;
      }
      if (isEdit) {
        payload.action = "update_org";
        payload.org_id = id;
      } else {
        payload.action = "create_org";
      }
      const { data, error } = await supabase.functions.invoke("master-admin-manage", { body: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(isEdit ? "Organisation updated" : "Organisation created");
      navigate("/master-admin/organisations");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const shownLogo = logoPreview ?? existingLogo;

  return (
    <MasterAdminLayout>
      <div className="max-w-xl">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link to="/master-admin/organisations"><ArrowLeft className="mr-2 h-4 w-4" /> Back to organisations</Link>
        </Button>
        <div className="mb-4">
          <h1 className="font-display text-2xl font-bold text-foreground">{isEdit ? "Edit organisation" : "New organisation"}</h1>
          <p className="text-muted-foreground">{isEdit ? "Update the organisation's name, short code and logo" : "Create a new organisation for the platform"}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organisation details</CardTitle>
            <CardDescription>The short code is used in links and must be unique.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {pageLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="org-name">Name</Label>
                  <Input id="org-name" value={name} onChange={e => onNameChange(e.target.value)} placeholder="Green Valley Farm" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-slug">Short code (slug)</Label>
                  <Input
                    id="org-slug"
                    value={slug}
                    onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                    placeholder="green-valley-farm"
                  />
                  <p className="text-xs text-muted-foreground">Lowercase letters, numbers and dashes only.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-sensor-limit">Sensor allowance (subscription)</Label>
                  <Input
                    id="org-sensor-limit"
                    type="number"
                    min={0}
                    step={1}
                    value={sensorLimit}
                    onChange={e => setSensorLimit(e.target.value)}
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">Maximum number of devices this organisation can register. Only you can change this.</p>
                </div>

                <div className="space-y-2">
                  <Label>Logo</Label>
                  {shownLogo ? (
                    <div className="flex items-center gap-3">
                      <img src={shownLogo} alt="Organisation logo preview" className="h-16 w-16 rounded-lg border object-cover" />
                      {logoPreview && (
                        <Button type="button" variant="outline" size="sm" onClick={clearNewLogo}>
                          <X className="mr-2 h-4 w-4" /> Remove new image
                        </Button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      <Building2 className="h-6 w-6" />
                      Click to upload a logo
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => onLogoChange(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">PNG or JPG up to 5 MB.{isEdit && " Leave empty to keep the current logo."}</p>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" asChild>
                    <Link to="/master-admin/organisations">Cancel</Link>
                  </Button>
                  <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {isEdit ? "Save changes" : "Create organisation"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MasterAdminLayout>
  );
}
