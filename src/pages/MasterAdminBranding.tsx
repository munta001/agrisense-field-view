import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Palette, RotateCcw, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { PlatformLogo } from "@/components/PlatformLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding } from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";

const presets = ["#23704F", "#2563EB", "#0F766E", "#B45309", "#BE123C", "#6D28D9"];

export default function MasterAdminBrandingPage() {
  const { platform_name, logo_url, tone_color, refreshBranding } = useBranding();
  const [name, setName] = useState(platform_name);
  const [color, setColor] = useState(tone_color);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(platform_name);
    setColor(tone_color);
  }, [platform_name, tone_color]);

  const onLogoChange = (file: File | null) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Choose a PNG, JPG, or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5 MB");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const save = async () => {
    if (!name.trim()) {
      toast.error("Platform name is required");
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      toast.error("Choose a valid tone color");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        action: "update_platform_branding",
        platform_name: name.trim(),
        tone_color: color.toUpperCase(),
      };
      if (logoFile) {
        body.logo_base64 = await fileToBase64(logoFile);
        body.logo_content_type = logoFile.type;
      }
      const { data, error } = await supabase.functions.invoke("master-admin-manage", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refreshBranding();
      setLogoFile(null);
      setLogoPreview(null);
      toast.success("Platform branding updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update platform branding");
    } finally {
      setSaving(false);
    }
  };

  const shownLogo = logoPreview ?? logo_url;

  return (
    <MasterAdminLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-7">
          <p className="mb-1 text-sm font-medium text-primary">Platform settings</p>
          <h1 className="font-display text-3xl font-bold text-foreground">Branding</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the identity and tone used throughout the platform.</p>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="grid lg:grid-cols-[1fr_360px]">
            <section className="space-y-8 p-6 sm:p-8 lg:p-10">
              <div>
                <h2 className="font-display text-xl font-semibold">Platform identity</h2>
                <p className="mt-1 text-sm text-muted-foreground">The name and logo appear on sign-in, navigation, and Master Admin pages.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform-name" className="font-semibold">Platform name</Label>
                <Input id="platform-name" className="h-12" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="tone-color" className="font-semibold">Tone color</Label>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Palette className="h-3.5 w-3.5" /> Platform-wide</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
                  <input
                    id="tone-color"
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value.toUpperCase())}
                    className="h-11 w-14 cursor-pointer rounded-md border bg-card p-1"
                    aria-label="Choose platform tone color"
                  />
                  <Input value={color.toUpperCase()} onChange={(event) => setColor(event.target.value)} className="h-11 font-mono uppercase" maxLength={7} />
                </div>
                <div className="flex flex-wrap gap-2" aria-label="Suggested tone colors">
                  {presets.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={color.toUpperCase() === preset ? "default" : "outline"}
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setColor(preset)}
                      aria-label={`Use ${preset}`}
                    >
                      <span className="h-4 w-4 rounded-full border bg-primary" style={{ backgroundColor: preset }} />
                    </Button>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setColor("#23704F")}>
                    <RotateCcw className="h-4 w-4" /> Reset
                  </Button>
                </div>
              </div>
            </section>

            <aside className="border-t bg-muted/40 p-6 sm:p-8 lg:border-l lg:border-t-0">
              <h2 className="font-display text-xl font-semibold">Platform logo</h2>
              <p className="mt-1 text-sm text-muted-foreground">Use a clear square or horizontal logo.</p>
              <div className="mt-6 rounded-lg border bg-card p-5">
                <Button
                  type="button"
                  variant="ghost"
                  className="group relative h-40 w-full overflow-hidden rounded-lg border border-dashed bg-muted/50 p-0 hover:border-primary/50"
                  onClick={() => fileRef.current?.click()}
                >
                  {shownLogo ? (
                    <img src={shownLogo} alt="Platform logo preview" className="h-full w-full object-contain p-4" />
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-muted-foreground"><ImagePlus className="h-8 w-8" /><span>Upload logo</span></span>
                  )}
                </Button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)} />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{logoPreview ? "New logo selected" : shownLogo ? "Current logo" : "Default leaf icon"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">PNG, JPG, or WebP · 5 MB max</p>
                  </div>
                  {logoPreview && <Button type="button" variant="ghost" size="icon" onClick={() => { setLogoFile(null); setLogoPreview(null); }} aria-label="Discard new logo"><X className="h-4 w-4" /></Button>}
                </div>
                <Button type="button" variant="outline" className="mt-5 w-full" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> {shownLogo ? "Replace logo" : "Choose logo"}
                </Button>
              </div>

              <div className="mt-6 border-t pt-5">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Live preview</p>
                <div className="mt-3 flex items-center gap-3 rounded-lg border bg-card p-4">
                  {logoPreview ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg"><img src={logoPreview} alt="" className="h-full w-full object-contain" /></div>
                  ) : (
                    <PlatformLogo className="h-10 w-10 rounded-lg bg-primary p-2 text-primary-foreground" iconClassName="text-primary-foreground" />
                  )}
                  <div className="min-w-0"><p className="truncate font-display font-bold">{name || "Platform name"}</p><p className="text-xs text-muted-foreground">Smart agriculture platform</p></div>
                </div>
              </div>
            </aside>
          </div>

          <div className="flex justify-end border-t bg-muted/25 px-6 py-4 sm:px-8">
            <Button onClick={save} disabled={saving} className="min-w-40">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save branding
            </Button>
          </div>
        </div>
      </div>
    </MasterAdminLayout>
  );
}