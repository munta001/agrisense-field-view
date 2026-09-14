CREATE TABLE public.platform_settings (
  id text PRIMARY KEY DEFAULT 'platform' CHECK (id = 'platform'),
  platform_name text NOT NULL DEFAULT 'AgriSense' CHECK (char_length(platform_name) BETWEEN 1 AND 80),
  logo_url text,
  tone_color text NOT NULL DEFAULT '#23704F' CHECK (tone_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform branding is publicly visible"
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Master admins can update platform branding"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (public.is_master_admin(auth.uid()))
WITH CHECK (id = 'platform' AND public.is_master_admin(auth.uid()));

CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_settings (id, platform_name, tone_color)
VALUES ('platform', 'AgriSense', '#23704F');