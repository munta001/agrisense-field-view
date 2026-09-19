
ALTER TABLE public.crop_stages ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS crop_start_date date;
ALTER TABLE public.crop_stage_thresholds ALTER COLUMN sensor_type_id DROP NOT NULL;
ALTER TABLE public.crop_stage_thresholds ADD COLUMN IF NOT EXISTS metric text;
CREATE UNIQUE INDEX IF NOT EXISTS crop_stage_thresholds_stage_metric_key
  ON public.crop_stage_thresholds (crop_stage_id, metric) WHERE metric IS NOT NULL;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS metric text;

-- keep each zone's stage in sync with its crop start date
CREATE OR REPLACE FUNCTION public.sync_zone_stages(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  z record;
  s record;
  elapsed integer;
  acc integer;
  target uuid;
  changed integer := 0;
BEGIN
  IF NOT (public.is_org_member(auth.uid(), p_org_id) OR public.is_master_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  FOR z IN SELECT id, crop_id, crop_start_date, crop_stage_id FROM public.zones
           WHERE org_id = p_org_id AND crop_id IS NOT NULL AND crop_start_date IS NOT NULL
  LOOP
    elapsed := (CURRENT_DATE - z.crop_start_date);
    acc := 0;
    target := NULL;
    FOR s IN SELECT id, duration_days FROM public.crop_stages
             WHERE crop_id = z.crop_id ORDER BY stage_order
    LOOP
      target := s.id;
      acc := acc + GREATEST(COALESCE(s.duration_days, 0), 0);
      EXIT WHEN elapsed < acc;
    END LOOP;

    IF target IS NOT NULL AND target IS DISTINCT FROM z.crop_stage_id THEN
      UPDATE public.zones SET crop_stage_id = target, updated_at = now() WHERE id = z.id;
      changed := changed + 1;
    END IF;
  END LOOP;

  RETURN changed;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_zone_stages(uuid) TO authenticated;

-- evaluate every incoming reading against the active stage thresholds
CREATE OR REPLACE FUNCTION public.evaluate_reading_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  t record;
  payload jsonb;
  val numeric;
  labels jsonb := '{"temperature_c":"Temperature","moisture_pct":"Soil moisture","conductivity":"Conductivity","ph":"pH","nitrogen":"Nitrogen","phosphorus":"Phosphorus","potassium":"Potassium","salinity":"Salinity"}'::jsonb;
  label text;
  zone_name text;
  direction text;
  sev text;
BEGIN
  IF NEW.sensor_id IS NULL THEN RETURN NEW; END IF;

  SELECT se.id, se.org_id, se.name, z.name AS zname, z.crop_stage_id
    INTO s
  FROM public.sensors se
  LEFT JOIN public.zones z ON z.id = se.zone_id
  WHERE se.id = NEW.sensor_id;

  IF s.crop_stage_id IS NULL THEN RETURN NEW; END IF;

  payload := to_jsonb(NEW);
  zone_name := COALESCE(s.zname, 'Unassigned zone');

  FOR t IN SELECT metric, min_value, max_value FROM public.crop_stage_thresholds
           WHERE crop_stage_id = s.crop_stage_id AND metric IS NOT NULL
  LOOP
    IF payload ->> t.metric IS NULL THEN CONTINUE; END IF;
    val := (payload ->> t.metric)::numeric;
    direction := NULL;
    IF t.min_value IS NOT NULL AND val < t.min_value THEN
      direction := 'below';
    ELSIF t.max_value IS NOT NULL AND val > t.max_value THEN
      direction := 'above';
    END IF;
    IF direction IS NULL THEN CONTINUE; END IF;

    -- one alert per sensor/metric per hour
    IF EXISTS (SELECT 1 FROM public.alerts a
               WHERE a.sensor_id = s.id AND a.metric = t.metric
                 AND a.created_at > now() - interval '1 hour') THEN
      CONTINUE;
    END IF;

    label := COALESCE(labels ->> t.metric, t.metric);
    sev := CASE
      WHEN direction = 'below' AND t.min_value IS NOT NULL AND t.min_value <> 0 AND val < t.min_value * 0.8 THEN 'critical'
      WHEN direction = 'above' AND t.max_value IS NOT NULL AND t.max_value <> 0 AND val > t.max_value * 1.2 THEN 'critical'
      ELSE 'warning' END;

    INSERT INTO public.alerts (org_id, sensor_id, title, message, severity, is_read, metric)
    VALUES (
      s.org_id, s.id,
      label || ' ' || direction || ' range on ' || s.name,
      zone_name || ': ' || label || ' is ' || val::text || ' (allowed ' ||
        COALESCE(t.min_value::text, '—') || ' to ' || COALESCE(t.max_value::text, '—') || ')',
      sev, false, t.metric
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evaluate_reading_alerts_trg ON public.sensor_readings;
CREATE TRIGGER evaluate_reading_alerts_trg
AFTER INSERT ON public.sensor_readings
FOR EACH ROW EXECUTE FUNCTION public.evaluate_reading_alerts();
