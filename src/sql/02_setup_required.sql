-- ThirdEye: REQUIRED startup records and buckets. Run after 01_schema.sql.
BEGIN;
INSERT INTO public.sensor_types (id, name, unit, icon, description)
VALUES ('44ccc9b7-feaf-4493-ba3b-e5f1e22d5f6f', 'Soil 8-in-1 (LoRaWAN)', 'multi', 'flask-conical', 'Temperature, moisture, conductivity, pH, nitrogen, phosphorus, potassium and salinity (ppm)')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.platform_settings (id, platform_name, logo_url, tone_color)
VALUES ('platform', 'ThirdEye', NULL, '#055299') ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('zone-images', 'zone-images', true, NULL, NULL), ('profile-pictures', 'profile-pictures', false, 5242880, NULL)
ON CONFLICT (id) DO NOTHING;
COMMIT;
