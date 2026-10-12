import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyBrandingToDocument,
  applyToneVars,
  readCachedBranding,
  toneVars,
  writeCachedBranding,
  type PlatformBranding,
} from "@/lib/platform-branding";

export type { PlatformBranding };

const cached = readCachedBranding();

// Apply the last known branding before React renders, so a returning visitor
// sees the real brand straight away instead of a placeholder that then swaps.
if (cached) {
  document.title = cached.platform_name;
  applyToneVars(Object.keys(cached.vars).length ? cached.vars : toneVars(cached.tone_color));
}

const initialBranding: PlatformBranding = cached
  ? { platform_name: cached.platform_name, logo_url: cached.logo_url, tone_color: cached.tone_color }
  : { platform_name: "", logo_url: null, tone_color: "" };

type BrandingContextValue = PlatformBranding & {
  loading: boolean;
  /** True once real branding is known — from the cache, or from the database. */
  resolved: boolean;
  refreshBranding: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue>({
  ...initialBranding,
  loading: true,
  resolved: false,
  refreshBranding: async () => {},
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<PlatformBranding>(initialBranding);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(Boolean(cached));

  const refreshBranding = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("platform_name, logo_url, tone_color")
      .eq("id", "platform")
      .maybeSingle();

    if (data) {
      const next: PlatformBranding = {
        platform_name: data.platform_name ?? "",
        logo_url: data.logo_url ?? null,
        tone_color: data.tone_color ?? "",
      };
      setBranding(next);
      writeCachedBranding(next);
      applyBrandingToDocument(next);
      setResolved(true);
    }

    setLoading(false);
  };

  useEffect(() => {
    void refreshBranding();
  }, []);

  const value = useMemo(
    () => ({ ...branding, loading, resolved, refreshBranding }),
    [branding, loading, resolved],
  );
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => useContext(BrandingContext);
