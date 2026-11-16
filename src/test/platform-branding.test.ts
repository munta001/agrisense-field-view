import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDING, DEFAULT_TONE_COLOR, toneVars } from "@/lib/platform-branding";

describe("default platform branding", () => {
  it("uses the reference blue when no valid custom tone is available", () => {
    expect(DEFAULT_TONE_COLOR).toBe("#055299");
    expect(toneVars("")["--primary"]).toBe("209 94% 31%");
  });

  it("resolves ThirdEye and its logo before a branding request completes", () => {
    expect(DEFAULT_BRANDING.platform_name).toBe("ThirdEye");
    expect(DEFAULT_BRANDING.logo_url).toContain("third-eye-logo.jpeg");
    expect(DEFAULT_BRANDING.tone_color).toBe("#055299");
  });
});