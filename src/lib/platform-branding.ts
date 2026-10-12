export type PlatformBranding = {
  platform_name: string;
  logo_url: string | null;
  tone_color: string;
};

export const BRANDING_STORAGE_KEY = "platform_branding";

type CachedBranding = PlatformBranding & { vars: Record<string, string> };

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

/** The theme variables a tone colour resolves to, so they can be applied (or cached) without recomputing. */
export function toneVars(color: string): Record<string, string> {
  const { h, s, l } = hexToHsl(color);
  const readableLightness = l > 58 ? Math.max(28, l - 35) : l;
  return {
    "--primary": `${h} ${Math.max(35, s)}% ${readableLightness}%`,
    "--ring": `${h} ${Math.max(35, s)}% ${readableLightness}%`,
    "--chart-1": `${h} ${Math.max(35, s)}% ${readableLightness}%`,
    "--sidebar-background": `${h} ${Math.max(25, Math.min(58, s))}% 9%`,
    "--sidebar-primary": `${h} ${Math.max(40, s)}% ${Math.max(38, Math.min(58, l + 12))}%`,
    "--sidebar-accent": `${h} ${Math.max(25, Math.min(45, s))}% 16%`,
    "--sidebar-border": `${h} ${Math.max(20, Math.min(35, s))}% 19%`,
  };
}

export function applyToneVars(vars: Record<string, string>) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
}

export function applyFavicon(logoUrl: string | null) {
  if (!logoUrl) return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.href = logoUrl;
}

/** Write the tab title, theme colours and tab icon in one go. */
export function applyBrandingToDocument(branding: PlatformBranding) {
  if (branding.platform_name) document.title = branding.platform_name;
  applyToneVars(toneVars(branding.tone_color));
  applyFavicon(branding.logo_url);
}

export function readCachedBranding(): CachedBranding | null {
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedBranding> | null;
    if (!parsed || typeof parsed.platform_name !== "string" || !parsed.platform_name) return null;
    return {
      platform_name: parsed.platform_name,
      logo_url: typeof parsed.logo_url === "string" ? parsed.logo_url : null,
      tone_color: typeof parsed.tone_color === "string" ? parsed.tone_color : "",
      vars: parsed.vars && typeof parsed.vars === "object" ? (parsed.vars as Record<string, string>) : {},
    };
  } catch {
    return null;
  }
}

export function writeCachedBranding(branding: PlatformBranding) {
  try {
    const cached: CachedBranding = { ...branding, vars: toneVars(branding.tone_color) };
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(cached));
  } catch {
    /* storage unavailable — branding simply isn't remembered for the next visit */
  }
}
