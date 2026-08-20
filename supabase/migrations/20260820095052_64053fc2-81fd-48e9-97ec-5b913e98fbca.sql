-- Extend sensors with LoRaWAN device identity
ALTER TABLE public.sensors
  ADD COLUMN IF NOT EXISTS device_id INTEGER,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sensors_device_id_key ON public.sensors (device_id) WHERE device_id IS NOT NULL;

-- Extend sensor_readings with the 8-in-1 soil payload + protocol metadata
ALTER TABLE public.sensor_readings
  ALTER COLUMN sensor_id DROP NOT NULL,
  ALTER COLUMN value DROP NOT NULL;

ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS device_id INTEGER,
  ADD COLUMN IF NOT EXISTS serial_number INTEGER,
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS packet_type INTEGER,
  ADD COLUMN IF NOT EXISTS checksum_valid BOOLEAN,
  ADD COLUMN IF NOT EXISTS battery_v NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS report_cycle_s INTEGER,
  ADD COLUMN IF NOT EXISTS temperature_c NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS moisture_pct NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS conductivity INTEGER,
  ADD COLUMN IF NOT EXISTS ph NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS nitrogen INTEGER,
  ADD COLUMN IF NOT EXISTS phosphorus INTEGER,
  ADD COLUMN IF NOT EXISTS potassium INTEGER,
  ADD COLUMN IF NOT EXISTS salinity INTEGER;

CREATE INDEX IF NOT EXISTS idx_readings_device_time
  ON public.sensor_readings (device_id, recorded_at DESC);

-- Link readings to their sensor row by device_id on insert
CREATE OR REPLACE FUNCTION public.link_reading_device()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sensor_id IS NULL AND NEW.device_id IS NOT NULL THEN
    SELECT id INTO NEW.sensor_id FROM public.sensors WHERE device_id = NEW.device_id LIMIT 1;
  ELSIF NEW.device_id IS NULL AND NEW.sensor_id IS NOT NULL THEN
    SELECT device_id INTO NEW.device_id FROM public.sensors WHERE id = NEW.sensor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_reading_device_trg ON public.sensor_readings;
CREATE TRIGGER link_reading_device_trg
  BEFORE INSERT ON public.sensor_readings
  FOR EACH ROW EXECUTE FUNCTION public.link_reading_device();

-- Gateway ingestion with the anon key
GRANT INSERT ON public.sensor_readings TO anon;
GRANT ALL ON public.sensor_readings TO service_role;
GRANT ALL ON public.sensors TO service_role;

DROP POLICY IF EXISTS "Gateway can insert readings" ON public.sensor_readings;
CREATE POLICY "Gateway can insert readings"
  ON public.sensor_readings FOR INSERT TO anon
  WITH CHECK (device_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sensors s WHERE s.device_id = sensor_readings.device_id));