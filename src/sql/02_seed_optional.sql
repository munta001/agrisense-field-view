-- ============================================================
-- AgriSense — OPTIONAL baseline seed data
-- Run AFTER 01_schema.sql, in the SQL Editor of the new project.
-- ============================================================

-- The 8-in-1 LoRaWAN soil sensor type (the app's insert_sensor_reading
-- function auto-registers devices against this type)
INSERT INTO public.sensor_types (id, name, unit, icon, description, min_value, max_value) VALUES
  ('44ccc9b7-feaf-4493-ba3b-e5f1e22d5f6f',
   'Soil 8-in-1 (LoRaWAN)',
   'multi',
   'flask-conical',
   'Soil 8-in-1 LoRaWAN probe: temperature, moisture, conductivity, pH, N, P, K, salinity',
   NULL, NULL);

-- Platform branding singleton (set your own platform name / tone colour;
-- logo_url points at storage you will upload later, so left NULL here)
INSERT INTO public.platform_settings (id, platform_name, logo_url, tone_color)
VALUES ('platform', 'AgriSense', NULL, '#23704F')
ON CONFLICT (id) DO NOTHING;

-- Crop templates are per-organisation (crops.org_id is required), so they are
-- attached to the first organisation that exists. If none exists yet, nothing
-- is inserted — create an organisation first, then re-run this file.
DO $$
DECLARE
  v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RAISE NOTICE 'No organisation found — crop templates skipped. Create one and re-run.';
    RETURN;
  END IF;

  -- Crop template: Tomato (4 stages with thresholds, 21-day cycle)
  INSERT INTO public.crops (id, org_id, name, category, description) VALUES
    ('c0000001-aaaa-4000-8000-000000000001', v_org, 'Tomato', 'Vegetables', 'Roma and cherry tomato varieties');

  INSERT INTO public.crop_stages (id, crop_id, name, stage_order, duration_days, description) VALUES
    ('d0000001-0000-4000-8000-000000000001', 'c0000001-aaaa-4000-8000-000000000001', 'Germination', 0, 7, NULL),
    ('d0000001-0000-4000-8000-000000000002', 'c0000001-aaaa-4000-8000-000000000001', 'Vegetative',  1, 5, NULL),
    ('d0000001-0000-4000-8000-000000000003', 'c0000001-aaaa-4000-8000-000000000001', 'Flowering',   2, 6, NULL),
    ('d0000001-0000-4000-8000-000000000004', 'c0000001-aaaa-4000-8000-000000000001', 'Fruiting',    3, 3, NULL);

  INSERT INTO public.crop_stage_thresholds (crop_stage_id, metric, min_value, max_value) VALUES
    ('d0000001-0000-4000-8000-000000000001', 'temperature_c', 50, 55),
    ('d0000001-0000-4000-8000-000000000001', 'salinity',      9, 10),
    ('d0000001-0000-4000-8000-000000000002', 'temperature_c', 21, 26);

  -- Crop template: Lettuce (3 stages, no thresholds yet)
  INSERT INTO public.crops (id, org_id, name, category, description) VALUES
    ('c0000001-aaaa-4000-8000-000000000002', v_org, 'Lettuce', 'Leafy Greens', 'Butterhead and romaine varieties');

  INSERT INTO public.crop_stages (id, crop_id, name, stage_order, duration_days, description) VALUES
    ('d0000001-0000-4000-8000-000000000011', 'c0000001-aaaa-4000-8000-000000000002', 'Seedling', 0, 0, NULL),
    ('d0000001-0000-4000-8000-000000000012', 'c0000001-aaaa-4000-8000-000000000002', 'Growth',   1, 0, NULL),
    ('d0000001-0000-4000-8000-000000000013', 'c0000001-aaaa-4000-8000-000000000002', 'Harvest',  2, 0, NULL);
END $$;
