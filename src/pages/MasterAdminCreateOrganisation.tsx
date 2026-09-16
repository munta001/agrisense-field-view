import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, Check, Gauge, ImagePlus, Link2, Loader2, Save, Upload, X } from "lucide-react";
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
      <div className="mx-auto max-w-5xl">
        <Button variant="ghost" size="sm" className="mb-5 -ml-2 text-muted-foreground" asChild>
          <Link to="/master-admin/organisations"><ArrowLeft className="h-4 w-4" /> Organisations</Link>
        </Button>

        <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-primary">Organisation settings</p>
            <h1 className="font-display text-3xl font-bold text-foreground">{isEdit ? "Edit organisation" : "Create organisation"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{isEdit ? "Manage identity, branding and device access." : "Set up the identity, branding and device access."}</p>
          </div>
          {!pageLoading && (
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-primary"><Check className="h-3.5 w-3.5" /></span>
              Changes apply immediately
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          {pageLoading ? (
            <div className="grid min-h-[480px] lg:grid-cols-[1fr_340px]">
              <div className="space-y-7 p-6 sm:p-8">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="space-y-6 border-t bg-muted/40 p-6 sm:p-8 lg:border-l lg:border-t-0">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-40 w-full" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid lg:grid-cols-[1fr_340px]">
                <section className="p-6 sm:p-8 lg:p-10" aria-labelledby="organisation-details-heading">
                  <div className="mb-8">
                    <h2 id="organisation-details-heading" className="font-display text-xl font-semibold text-foreground">Organisation details</h2>
                    <p className="mt-1 text-sm text-muted-foreground">The name and short code identify this organisation across the platform.</p>
                  </div>

                  <div className="space-y-7">
                    <div className="space-y-2">
                      <Label htmlFor="org-name" className="text-sm font-semibold">Organisation name</Label>
                      <Input id="org-name" className="h-12 bg-background px-4" value={name} onChange={e => onNameChange(e.target.value)} placeholder="Green Valley Farm" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org-slug" className="text-sm font-semibold">Short code</Label>
                      <div className="relative">
                        <Link2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="org-slug"
                          className="h-12 bg-background pl-11"
                          value={slug}
                          onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                          placeholder="green-valley-farm"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Lowercase letters, numbers and dashes only. This value must be unique.</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="org-sensor-limit" className="text-sm font-semibold">Device allowance</Label>
                        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">Subscription</span>
                      </div>
                      <div className="relative">
                        <Gauge className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="org-sensor-limit"
                          className="h-12 bg-background pl-11"
                          type="number"
                          min={0}
                          step={1}
                          value={sensorLimit}
                          onChange={e => setSensorLimit(e.target.value)}
                          placeholder="10"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Maximum number of active devices this organisation can register.</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="org-zone-limit" className="text-sm font-semibold">Zone allowance</Label>
                        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">Subscription</span>
                      </div>
                      <div className="relative">
                        <Map className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="org-zone-limit"
                          className="h-12 bg-background pl-11"
                          type="number"
                          min={0}
                          step={1}
                          value={zoneLimit}
                          onChange={e => setZoneLimit(e.target.value)}
                          placeholder="10"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Maximum number of zones this organisation can create.</p>
                    </div>

                  </div>
                </section>

                <aside className="border-t bg-muted/40 p-6 sm:p-8 lg:border-l lg:border-t-0" aria-labelledby="organisation-logo-heading">
                  <div className="mb-6">
                    <h2 id="organisation-logo-heading" className="font-display text-xl font-semibold text-foreground">Brand logo</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Shown throughout the organisation workspace.</p>
                  </div>

                  <div className="rounded-lg border bg-card p-5">
                    <Button
                      type="button"
                      variant="ghost"
                      className="group relative h-40 w-full overflow-hidden rounded-lg border border-dashed bg-muted/50 p-0 hover:border-primary/50 hover:bg-secondary/50"
                      onClick={() => fileRef.current?.click()}
                      aria-label={shownLogo ? "Replace organisation logo" : "Upload organisation logo"}
                    >
                      {shownLogo ? (
                        <img src={shownLogo} alt="Organisation logo preview" className="h-full w-full object-contain p-4" />
                      ) : (
                        <span className="flex flex-col items-center gap-2 text-muted-foreground">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary"><Building2 className="h-5 w-5" /></span>
                          <span className="text-sm font-medium">Upload logo</span>
                        </span>
                      )}
                      <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border bg-card text-primary shadow-sm transition-transform group-hover:scale-105">
                        <ImagePlus className="h-4 w-4" />
                      </span>
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={e => onLogoChange(e.target.files?.[0] ?? null)}
                    />

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{logoPreview ? "New logo selected" : shownLogo ? "Current logo" : "No logo added"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">PNG or JPG, up to 5 MB</p>
                      </div>
                      {logoPreview && (
                        <Button type="button" variant="ghost" size="icon" onClick={clearNewLogo} aria-label="Discard new logo">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <Button type="button" variant="outline" className="mt-5 w-full" onClick={() => fileRef.current?.click()}>
                      <Upload className="h-4 w-4" /> {shownLogo ? "Replace logo" : "Choose logo"}
                    </Button>
                  </div>

                  <div className="mt-6 border-t pt-5">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Preview</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card">
                        {shownLogo ? <img src={shownLogo} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{name || "Organisation name"}</p>
                        <p className="truncate text-xs text-muted-foreground">{slug || "short-code"}</p>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t bg-muted/25 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <p className="hidden text-xs text-muted-foreground sm:block">Review the details before saving.</p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button variant="outline" asChild>
                    <Link to="/master-admin/organisations">Cancel</Link>
                  </Button>
                  <Button onClick={save} disabled={saving} className="min-w-36">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? "Save changes" : "Create organisation"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MasterAdminLayout>
  );
}
