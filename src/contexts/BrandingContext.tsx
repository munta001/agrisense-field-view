import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlatformBranding = {
  platform_name: string;
  logo_url: string | null;
  tone_color: string;
};

type BrandingContextValue = PlatformBranding & {
  loading: boolean;
  refreshBranding: () => Promise<void>;
};

const defaultBranding: PlatformBranding = {
  platform_name: "AgriSense",
  logo_url: null,
  tone_color: "#23704F",
};

const BrandingContext = createContext<BrandingContextValue>({
  ...defaultBranding,
  loading: true,
  refreshBranding: async () => {},
});

function hexToHsl(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return { h: 152, s: 55, l: 28 };
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyTone(color: string) {
  const { h, s, l } = hexToHsl(color);
  const root = document.documentElement;
  const readableLightness = l > 58 ? Math.max(28, l - 35) : l;
  root.style.setProperty("--primary", `${h} ${Math.max(35, s)}% ${readableLightness}%`);
  root.style.setProperty("--ring", `${h} ${Math.max(35, s)}% ${readableLightness}%`);
  root.style.setProperty("--chart-1", `${h} ${Math.max(35, s)}% ${readableLightness}%`);
  root.style.setProperty("--sidebar-background", `${h} ${Math.max(25, Math.min(58, s))}% 9%`);
  root.style.setProperty("--sidebar-primary", `${h} ${Math.max(40, s)}% ${Math.max(38, Math.min(58, l + 12))}%`);
  root.style.setProperty("--sidebar-accent", `${h} ${Math.max(25, Math.min(45, s))}% 16%`);
  root.style.setProperty("--sidebar-border", `${h} ${Math.max(20, Math.min(35, s))}% 19%`);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState(defaultBranding);
  const [loading, setLoading] = useState(true);

  const refreshBranding = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("platform_name, logo_url, tone_color")
      .eq("id", "platform")
      .maybeSingle();
    const next = data ?? defaultBranding;
    setBranding(next);
    applyTone(next.tone_color);
    document.title = next.platform_name;
    setLoading(false);
  };

  useEffect(() => {
    void refreshBranding();
  }, []);

  const value = useMemo(() => ({ ...branding, loading, refreshBranding }), [branding, loading]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => useContext(BrandingContext);