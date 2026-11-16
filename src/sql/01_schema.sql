-- ThirdEye: full schema for a FRESH external Supabase project (2026-11-16).

-- Run once as postgres in SQL Editor; then run 02_setup_required.sql.

-- No customer data, passwords, API credentials or obsolete WhatsApp sender included.

BEGIN;

SET LOCAL search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer', 'master_admin');

CREATE TABLE public."activity_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "user_id" uuid,
  "action" text NOT NULL,
  "details" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."activity_logs" TO authenticated;

GRANT ALL ON public."activity_logs" TO service_role;

ALTER TABLE public."activity_logs" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."alerts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "sensor_id" uuid,
  "title" text NOT NULL,
  "message" text,
  "severity" text DEFAULT 'info'::text NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metric" text,
  "whatsapp_sent_at" timestamp with time zone
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."alerts" TO authenticated;

GRANT ALL ON public."alerts" TO service_role;

ALTER TABLE public."alerts" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."appliance_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "appliance_id" uuid,
  "metric" text NOT NULL,
  "condition" text NOT NULL,
  "run_seconds" integer DEFAULT 300 NOT NULL,
  "cooldown_min" integer DEFAULT 30 NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."appliance_rules" TO authenticated;

GRANT ALL ON public."appliance_rules" TO service_role;

ALTER TABLE public."appliance_rules" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."appliances" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid,
  "zone_id" uuid,
  "name" text NOT NULL,
  "controller_dev_eui" text NOT NULL,
  "do_channel" text DEFAULT '07'::text NOT NULL,
  "max_run_s" integer DEFAULT 600 NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."appliances" TO authenticated;

GRANT ALL ON public."appliances" TO service_role;

ALTER TABLE public."appliances" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."automation_commands" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "appliance_id" uuid,
  "command" text NOT NULL,
  "source" text NOT NULL,
  "alert_id" uuid,
  "execute_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "sent_at" timestamp with time zone,
  "error" text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."automation_commands" TO authenticated;

GRANT ALL ON public."automation_commands" TO service_role;

ALTER TABLE public."automation_commands" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."crop_stage_thresholds" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "crop_stage_id" uuid NOT NULL,
  "sensor_type_id" uuid,
  "min_value" numeric,
  "max_value" numeric,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metric" text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."crop_stage_thresholds" TO authenticated;

GRANT ALL ON public."crop_stage_thresholds" TO service_role;

ALTER TABLE public."crop_stage_thresholds" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."crop_stages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "crop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "stage_order" integer DEFAULT 0 NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "duration_days" integer DEFAULT 0 NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."crop_stages" TO authenticated;

GRANT ALL ON public."crop_stages" TO service_role;

ALTER TABLE public."crop_stages" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."crops" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT ''::text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."crops" TO authenticated;

GRANT ALL ON public."crops" TO service_role;

ALTER TABLE public."crops" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."data_entries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "sensor_id" uuid,
  "value" numeric NOT NULL,
  "notes" text,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."data_entries" TO authenticated;

GRANT ALL ON public."data_entries" TO service_role;

ALTER TABLE public."data_entries" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."organizations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sensor_limit" integer DEFAULT 10 NOT NULL,
  "zone_limit" integer DEFAULT 10 NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."organizations" TO authenticated;

GRANT ALL ON public."organizations" TO service_role;

ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."platform_settings" (
  "id" text DEFAULT 'platform'::text NOT NULL,
  "platform_name" text DEFAULT 'ThirdEye'::text NOT NULL,
  "logo_url" text,
  "tone_color" text DEFAULT '#055299'::text NOT NULL,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."platform_settings" TO authenticated;

GRANT ALL ON public."platform_settings" TO service_role;

GRANT SELECT ON public."platform_settings" TO anon;

ALTER TABLE public."platform_settings" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "full_name" text,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "phone_number" text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."profiles" TO authenticated;

GRANT ALL ON public."profiles" TO service_role;

ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."sensor_readings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "sensor_id" uuid,
  "value" numeric,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "device_id" integer,
  "serial_number" integer,
  "channel" text,
  "packet_type" integer,
  "checksum_valid" boolean,
  "battery_v" numeric(5,3),
  "report_cycle_s" integer,
  "temperature_c" numeric(6,1),
  "moisture_pct" numeric(6,1),
  "conductivity" integer,
  "ph" numeric(5,2),
  "nitrogen" integer,
  "phosphorus" integer,
  "potassium" integer,
  "salinity" integer,
  "dev_eui" text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."sensor_readings" TO authenticated;

GRANT ALL ON public."sensor_readings" TO service_role;

GRANT INSERT ON public."sensor_readings" TO anon;

ALTER TABLE public."sensor_readings" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."sensor_types" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "unit" text NOT NULL,
  "icon" text,
  "description" text,
  "min_value" numeric,
  "max_value" numeric,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."sensor_types" TO authenticated;

GRANT ALL ON public."sensor_types" TO service_role;

ALTER TABLE public."sensor_types" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."sensors" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "sensor_type_id" uuid NOT NULL,
  "zone_id" uuid,
  "name" text NOT NULL,
  "ip_address" text,
  "latitude" numeric,
  "longitude" numeric,
  "map_x" numeric,
  "map_y" numeric,
  "status" text DEFAULT 'online'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "device_id" integer,
  "location" text,
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "dev_eui" text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."sensors" TO authenticated;

GRANT ALL ON public."sensors" TO service_role;

ALTER TABLE public."sensors" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."user_roles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "org_id" uuid,
  "role" public."app_role" DEFAULT 'viewer'::app_role NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."user_roles" TO authenticated;

GRANT ALL ON public."user_roles" TO service_role;

ALTER TABLE public."user_roles" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."zones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "name" text NOT NULL,
  "color" text DEFAULT '#22c55e'::text NOT NULL,
  "boundaries" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "background_image_url" text,
  "crop_id" uuid,
  "crop_stage_id" uuid,
  "crop_start_date" date
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."zones" TO authenticated;

GRANT ALL ON public."zones" TO service_role;

ALTER TABLE public."zones" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."activity_logs" ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY (id);

ALTER TABLE public."alerts" ADD CONSTRAINT "alerts_pkey" PRIMARY KEY (id);

ALTER TABLE public."alerts" ADD CONSTRAINT "alerts_severity_check" CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])));

ALTER TABLE public."appliance_rules" ADD CONSTRAINT "appliance_rules_condition_check" CHECK ((condition = ANY (ARRAY['below_min'::text, 'above_max'::text])));

ALTER TABLE public."appliance_rules" ADD CONSTRAINT "appliance_rules_pkey" PRIMARY KEY (id);

ALTER TABLE public."appliances" ADD CONSTRAINT "appliances_do_channel_check" CHECK ((do_channel = ANY (ARRAY['07'::text, '08'::text])));

ALTER TABLE public."appliances" ADD CONSTRAINT "appliances_pkey" PRIMARY KEY (id);

ALTER TABLE public."automation_commands" ADD CONSTRAINT "automation_commands_command_check" CHECK ((command = ANY (ARRAY['on'::text, 'off'::text])));

ALTER TABLE public."automation_commands" ADD CONSTRAINT "automation_commands_pkey" PRIMARY KEY (id);

ALTER TABLE public."automation_commands" ADD CONSTRAINT "automation_commands_source_check" CHECK ((source = ANY (ARRAY['alert'::text, 'manual'::text, 'timer'::text])));

ALTER TABLE public."automation_commands" ADD CONSTRAINT "automation_commands_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])));

ALTER TABLE public."crop_stage_thresholds" ADD CONSTRAINT "crop_stage_thresholds_crop_stage_id_sensor_type_id_key" UNIQUE (crop_stage_id, sensor_type_id);

ALTER TABLE public."crop_stage_thresholds" ADD CONSTRAINT "crop_stage_thresholds_pkey" PRIMARY KEY (id);

ALTER TABLE public."crop_stages" ADD CONSTRAINT "crop_stages_pkey" PRIMARY KEY (id);

ALTER TABLE public."crops" ADD CONSTRAINT "crops_pkey" PRIMARY KEY (id);

ALTER TABLE public."data_entries" ADD CONSTRAINT "data_entries_pkey" PRIMARY KEY (id);

ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_pkey" PRIMARY KEY (id);

ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_slug_key" UNIQUE (slug);

ALTER TABLE public."platform_settings" ADD CONSTRAINT "platform_settings_id_check" CHECK ((id = 'platform'::text));

ALTER TABLE public."platform_settings" ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public."platform_settings" ADD CONSTRAINT "platform_settings_platform_name_check" CHECK (((char_length(platform_name) >= 1) AND (char_length(platform_name) <= 80)));

ALTER TABLE public."platform_settings" ADD CONSTRAINT "platform_settings_tone_color_check" CHECK ((tone_color ~ '^#[0-9A-Fa-f]{6}$'::text));

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_user_id_key" UNIQUE (user_id);

ALTER TABLE public."sensor_readings" ADD CONSTRAINT "sensor_readings_pkey" PRIMARY KEY (id);

ALTER TABLE public."sensor_types" ADD CONSTRAINT "sensor_types_pkey" PRIMARY KEY (id);

ALTER TABLE public."sensors" ADD CONSTRAINT "sensors_pkey" PRIMARY KEY (id);

ALTER TABLE public."sensors" ADD CONSTRAINT "sensors_status_check" CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text, 'maintenance'::text])));

ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_org_id_key" UNIQUE (user_id, org_id);

ALTER TABLE public."zones" ADD CONSTRAINT "zones_pkey" PRIMARY KEY (id);

ALTER TABLE public."activity_logs" ADD CONSTRAINT "activity_logs_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."alerts" ADD CONSTRAINT "alerts_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."alerts" ADD CONSTRAINT "alerts_sensor_id_fkey" FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE SET NULL;

ALTER TABLE public."appliance_rules" ADD CONSTRAINT "appliance_rules_appliance_id_fkey" FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE CASCADE;

ALTER TABLE public."appliances" ADD CONSTRAINT "appliances_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id);

ALTER TABLE public."appliances" ADD CONSTRAINT "appliances_zone_id_fkey" FOREIGN KEY (zone_id) REFERENCES zones(id);

ALTER TABLE public."automation_commands" ADD CONSTRAINT "automation_commands_appliance_id_fkey" FOREIGN KEY (appliance_id) REFERENCES appliances(id);

ALTER TABLE public."crop_stage_thresholds" ADD CONSTRAINT "crop_stage_thresholds_crop_stage_id_fkey" FOREIGN KEY (crop_stage_id) REFERENCES crop_stages(id) ON DELETE CASCADE;

ALTER TABLE public."crop_stage_thresholds" ADD CONSTRAINT "crop_stage_thresholds_sensor_type_id_fkey" FOREIGN KEY (sensor_type_id) REFERENCES sensor_types(id) ON DELETE CASCADE;

ALTER TABLE public."crop_stages" ADD CONSTRAINT "crop_stages_crop_id_fkey" FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE;

ALTER TABLE public."crops" ADD CONSTRAINT "crops_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."data_entries" ADD CONSTRAINT "data_entries_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."data_entries" ADD CONSTRAINT "data_entries_sensor_id_fkey" FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE SET NULL;

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."sensor_readings" ADD CONSTRAINT "sensor_readings_sensor_id_fkey" FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE;

ALTER TABLE public."sensors" ADD CONSTRAINT "sensors_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."sensors" ADD CONSTRAINT "sensors_sensor_type_id_fkey" FOREIGN KEY (sensor_type_id) REFERENCES sensor_types(id);

ALTER TABLE public."sensors" ADD CONSTRAINT "sensors_zone_id_fkey" FOREIGN KEY (zone_id) REFERENCES zones(id);

ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."zones" ADD CONSTRAINT "zones_crop_id_fkey" FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE SET NULL;

ALTER TABLE public."zones" ADD CONSTRAINT "zones_crop_stage_id_fkey" FOREIGN KEY (crop_stage_id) REFERENCES crop_stages(id) ON DELETE SET NULL;

ALTER TABLE public."zones" ADD CONSTRAINT "zones_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_readings_device_time ON public.sensor_readings USING btree (device_id, recorded_at DESC);

CREATE UNIQUE INDEX sensors_dev_eui_unique_idx ON public.sensors USING btree (dev_eui) WHERE (dev_eui IS NOT NULL);

CREATE UNIQUE INDEX user_roles_master_admin_unique ON public.user_roles USING btree (user_id) WHERE (role = 'master_admin'::app_role);

CREATE UNIQUE INDEX crop_stage_thresholds_stage_metric_key ON public.crop_stage_thresholds USING btree (crop_stage_id, metric) WHERE (metric IS NOT NULL);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _org_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND org_id = _org_id AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND org_id = _org_id
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'master_admin'
      AND is_active
  )
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'phone_number', '')
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_alert_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.activity_logs (org_id, user_id, action, details)
  values (
    new.org_id,
    null,
    'alert_created',
    jsonb_build_object(
      'title', new.title,
      'message', new.message,
      'severity', new.severity,
      'metric', new.metric,
      'sensor_id', new.sensor_id
    )
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.link_reading_device()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.sensor_id IS NULL AND NEW.device_id IS NOT NULL THEN
    SELECT id INTO NEW.sensor_id FROM public.sensors WHERE device_id = NEW.device_id LIMIT 1;
  ELSIF NEW.device_id IS NULL AND NEW.sensor_id IS NOT NULL THEN
    SELECT device_id INTO NEW.device_id FROM public.sensors WHERE id = NEW.sensor_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.master_admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT jsonb_build_object(
    'organizations', COALESCE(jsonb_agg(o ORDER BY o->>'name'), '[]'::jsonb)
  )
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'id', org.id,
      'name', org.name,
      'slug', org.slug,
      'logo_url', org.logo_url,
      'is_active', org.is_active,
      'sensor_limit', org.sensor_limit,
      'zone_limit', org.zone_limit,
      'created_at', org.created_at,
      'sensor_count', (SELECT count(*) FROM public.sensors s WHERE s.org_id = org.id),
      'active_sensor_count', (SELECT count(*) FROM public.sensors s WHERE s.org_id = org.id AND s.is_active),
      'zone_count', (SELECT count(*) FROM public.zones z WHERE z.org_id = org.id),
      'reading_count', (SELECT count(*) FROM public.sensor_readings r JOIN public.sensors s ON s.id = r.sensor_id WHERE s.org_id = org.id),
      'readings_bytes', COALESCE((
        SELECT sum(pg_column_size(r))
        FROM public.sensor_readings r
        JOIN public.sensors s ON s.id = r.sensor_id
        WHERE s.org_id = org.id
      ), 0),
      'storage_bytes', COALESCE((
        SELECT sum(COALESCE((ob.metadata->>'size')::bigint, 0))
        FROM storage.objects ob
        WHERE ob.bucket_id = 'zone-images'
          AND (storage.foldername(ob.name))[1] = org.id::text
      ), 0) + COALESCE((
        SELECT sum(pg_column_size(r))
        FROM public.sensor_readings r
        JOIN public.sensors s ON s.id = r.sensor_id
        WHERE s.org_id = org.id
      ), 0),
      'storage_files', COALESCE((
        SELECT count(*) FROM storage.objects ob
        WHERE ob.bucket_id = 'zone-images'
          AND (storage.foldername(ob.name))[1] = org.id::text
      ), 0),
      'users', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'user_id', ur.user_id,
          'role', ur.role,
          'full_name', p.full_name,
          'email', u.email,
          'last_sign_in_at', u.last_sign_in_at,
          'created_at', u.created_at
        ) ORDER BY ur.role)
        FROM public.user_roles ur
        LEFT JOIN public.profiles p ON p.user_id = ur.user_id
        LEFT JOIN auth.users u ON u.id = ur.user_id
        WHERE ur.org_id = org.id
      ), '[]'::jsonb)
    ) AS o
    FROM public.organizations org
  ) x;

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.org_member_details(p_org_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, role app_role, is_active boolean, created_at timestamp with time zone, full_name text, email text, last_sign_in_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), p_org_id, 'admin') OR public.is_master_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY
  SELECT ur.id, ur.user_id, ur.role, ur.is_active, ur.created_at, p.full_name, u.email::text, u.last_sign_in_at
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  LEFT JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.org_id = p_org_id
  ORDER BY ur.role, p.full_name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_zone_stages(p_org_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.insert_sensor_reading(p_dev_eui text, p_org_id uuid, p_device_id integer, p_serial_number integer, p_channel text, p_packet_type integer, p_checksum_valid boolean, p_battery_v numeric, p_report_cycle_s integer, p_temperature_c numeric, p_moisture_pct numeric, p_conductivity integer, p_ph numeric, p_nitrogen integer, p_phosphorus integer, p_potassium integer, p_salinity integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public
AS $function$
DECLARE
    v_sensor_id     UUID;
    v_sensor_org_id UUID;
    v_reading_id    UUID;
    v_sensor_name   TEXT;
    v_org_name      TEXT;
    v_sensor_status TEXT;
    v_sensor_type_id UUID := '44ccc9b7-feaf-4493-ba3b-e5f1e22d5f6f';  -- Soil 8-in-1 (LoRaWAN)
BEGIN
    SELECT id, org_id, name
    INTO v_sensor_id, v_sensor_org_id, v_sensor_name
    FROM sensors
    WHERE dev_eui = p_dev_eui;

    IF p_org_id IS NOT NULL THEN
        SELECT name INTO v_org_name FROM organizations WHERE id = p_org_id;
    END IF;

    IF v_sensor_id IS NULL THEN
        INSERT INTO sensors (
            dev_eui, device_id, org_id, name, sensor_type_id,
            status, is_active, created_at, updated_at
        )
        VALUES (
            p_dev_eui, p_device_id, p_org_id,
            'Sensor-' || p_dev_eui, v_sensor_type_id,
            'online', true, NOW(), NOW()
        )
        RETURNING id, org_id, name
        INTO v_sensor_id, v_sensor_org_id, v_sensor_name;

        v_sensor_status := 'created';
    ELSE
        UPDATE sensors
        SET device_id  = COALESCE(device_id, p_device_id),
            org_id     = COALESCE(org_id, p_org_id),
            updated_at = NOW()
        WHERE id = v_sensor_id;

        v_sensor_status := 'existing';
    END IF;

    INSERT INTO sensor_readings (
        sensor_id, dev_eui, device_id, value,
        serial_number, channel, packet_type, checksum_valid,
        battery_v, report_cycle_s, temperature_c, moisture_pct,
        conductivity, ph, nitrogen, phosphorus, potassium, salinity,
        recorded_at
    ) VALUES (
        v_sensor_id, p_dev_eui, p_device_id, p_temperature_c,
        p_serial_number, p_channel, p_packet_type, p_checksum_valid,
        p_battery_v, p_report_cycle_s, p_temperature_c, p_moisture_pct,
        p_conductivity, p_ph, p_nitrogen, p_phosphorus, p_potassium, p_salinity,
        NOW()
    )
    RETURNING id INTO v_reading_id;

    RETURN json_build_object(
        'success',       true,
        'sensor_status', v_sensor_status,
        'sensor_id',     v_sensor_id,
        'sensor_name',   v_sensor_name,
        'dev_eui',       p_dev_eui,
        'org_id',        v_sensor_org_id,
        'org_name',      COALESCE(v_org_name, 'unknown'),
        'reading_id',    v_reading_id,
        'message',       CASE v_sensor_status
                           WHEN 'created'
                           THEN 'Sensor auto-registered and assigned to org. Reading inserted.'
                           ELSE 'Sensor found. Reading inserted.'
                         END
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error',   SQLERRM,
        'dev_eui', p_dev_eui,
        'org_id',  p_org_id::text
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.queue_automation(p_sensor_id uuid, p_metric text, p_direction text, p_alert_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_cond text := case p_direction when 'below' then 'below_min' else 'above_max' end;
  v_run int;
begin
  for r in
    select ap.id as appliance_id, ap.max_run_s, ar.run_seconds, ar.cooldown_min
    from sensors se
    join appliances ap on ap.zone_id = se.zone_id
    join appliance_rules ar on ar.appliance_id = ap.id
    where se.id = p_sensor_id
      and ar.metric = p_metric
      and ar.condition = v_cond
  loop
    -- skip if this appliance already started inside its cooldown window
    if exists (select 1 from automation_commands c
               where c.appliance_id = r.appliance_id
                 and c.command = 'on'
                 and c.status <> 'failed'
                 and c.created_at > now() - make_interval(mins => r.cooldown_min)) then
      continue;
    end if;

    v_run := least(r.run_seconds, r.max_run_s);

    insert into automation_commands (appliance_id, command, source, alert_id, execute_at)
    values (r.appliance_id, 'on', 'alert', p_alert_id, now());

    insert into automation_commands (appliance_id, command, source, alert_id, execute_at)
    values (r.appliance_id, 'off', 'timer', p_alert_id, now() + make_interval(secs => v_run));
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.evaluate_reading_alerts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_alert_id uuid;
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
    )
    RETURNING id INTO v_alert_id;

    -- automation hook: must never be able to block a reading insert
    BEGIN
      PERFORM public.queue_automation(s.id, t.metric, direction, v_alert_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'queue_automation failed: %', SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.request_manual_automation(p_appliance_id uuid, p_command text, p_alert_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ap public.appliances; v_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_command IS NULL OR p_command NOT IN ('on','off') THEN RAISE EXCEPTION 'Invalid command'; END IF;
  SELECT * INTO v_ap FROM public.appliances WHERE id = p_appliance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appliance not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v_ap.org_id AND o.is_active)
    OR NOT (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_uid AND r.org_id = v_ap.org_id AND r.is_active AND r.role IN ('admin','operator')) OR public.is_master_admin(v_uid))
  THEN RAISE EXCEPTION 'Only active admins and operators can control this appliance'; END IF;
  IF p_alert_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.alerts al JOIN public.sensors s ON s.id = al.sensor_id
    WHERE al.id = p_alert_id AND al.org_id = v_ap.org_id AND s.org_id = v_ap.org_id AND s.zone_id = v_ap.zone_id
  ) THEN RAISE EXCEPTION 'Alert does not belong to this appliance zone'; END IF;
  IF p_command = 'on' THEN
    IF v_ap.max_run_s IS NULL OR v_ap.max_run_s <= 0 THEN RAISE EXCEPTION 'Invalid maximum run time'; END IF;
    IF EXISTS (SELECT 1 FROM public.automation_commands WHERE appliance_id = v_ap.id AND status = 'pending')
    THEN RAISE EXCEPTION 'This appliance already has a queued action or stop timer'; END IF;
  ELSE
    UPDATE public.automation_commands SET status = 'failed', error = 'Cancelled by manual stop'
    WHERE appliance_id = v_ap.id AND command = 'on' AND status = 'pending';
    UPDATE public.automation_commands SET execute_at = now()
    WHERE appliance_id = v_ap.id AND command = 'off' AND status = 'pending';
  END IF;
  INSERT INTO public.automation_commands(appliance_id,command,source,alert_id,execute_at)
    VALUES (v_ap.id,p_command,'manual',p_alert_id,now()) RETURNING id INTO v_id;
  IF p_command = 'on' THEN
    INSERT INTO public.automation_commands(appliance_id,command,source,alert_id,execute_at)
    VALUES (v_ap.id,'off','timer',p_alert_id,now()+make_interval(secs => v_ap.max_run_s));
  END IF;
  INSERT INTO public.activity_logs(org_id,user_id,action,details)
    VALUES (v_ap.org_id,v_uid,'manual_automation',jsonb_build_object('appliance_id',v_ap.id,'command',p_command,'command_id',v_id));
  RETURN v_id;
END;
$function$
;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sensors_updated_at BEFORE UPDATE ON public.sensors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER update_crops_updated_at BEFORE UPDATE ON public.crops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crop_stages_updated_at BEFORE UPDATE ON public.crop_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER link_reading_device_trg BEFORE INSERT ON public.sensor_readings FOR EACH ROW EXECUTE FUNCTION link_reading_device();

CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER evaluate_reading_alerts_trg AFTER INSERT ON public.sensor_readings FOR EACH ROW EXECUTE FUNCTION evaluate_reading_alerts();

CREATE TRIGGER on_alert_log_activity AFTER INSERT ON public.alerts FOR EACH ROW EXECUTE FUNCTION log_alert_activity();

CREATE POLICY "Users can view all profiles" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Users can update own profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = user_id));

CREATE POLICY "Org members can view orgs" ON public."organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member(auth.uid(), id));

CREATE POLICY "Admins can update orgs" ON public."organizations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_role(auth.uid(), id, 'admin'::app_role));

CREATE POLICY "Org members can view roles" ON public."user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can update roles" ON public."user_roles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((org_id IS NOT NULL AND role <> 'master_admin'::public.app_role AND public.has_role(auth.uid(), org_id, 'admin'::public.app_role))) WITH CHECK ((org_id IS NOT NULL AND role <> 'master_admin'::public.app_role AND public.has_role(auth.uid(), org_id, 'admin'::public.app_role)));

CREATE POLICY "Admins can delete roles" ON public."user_roles" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((org_id IS NOT NULL AND role <> 'master_admin'::public.app_role AND public.has_role(auth.uid(), org_id, 'admin'::public.app_role)));

CREATE POLICY "Anyone can view sensor types" ON public."sensor_types" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Org members can view zones" ON public."zones" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins/operators can manage zones" ON public."zones" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role)));

CREATE POLICY "Admins/operators can update zones" ON public."zones" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role)));

CREATE POLICY "Org members can view sensors" ON public."sensors" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins/operators can add sensors" ON public."sensors" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role)));

CREATE POLICY "Admins/operators can update sensors" ON public."sensors" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role)));

CREATE POLICY "Admins can delete sensors" ON public."sensors" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), org_id, 'admin'::app_role));

CREATE POLICY "Admins/operators can add entries" ON public."data_entries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role)));

CREATE POLICY "Org members can view readings" ON public."sensor_readings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM sensors s
  WHERE ((s.id = sensor_readings.sensor_id) AND is_org_member(auth.uid(), s.org_id)))));

CREATE POLICY "Admins/operators can insert readings" ON public."sensor_readings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM sensors s
  WHERE ((s.id = sensor_readings.sensor_id) AND (has_role(auth.uid(), s.org_id, 'admin'::app_role) OR has_role(auth.uid(), s.org_id, 'operator'::app_role))))));

CREATE POLICY "Org members can view alerts" ON public."alerts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins/operators can create alerts" ON public."alerts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role)));

CREATE POLICY "Members can mark alerts read" ON public."alerts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can view logs" ON public."activity_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can view entries" ON public."data_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Members view appliances" ON public."appliances" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Master admins manage rules" ON public."appliance_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_master_admin(auth.uid())) WITH CHECK (is_master_admin(auth.uid()));

CREATE POLICY "Admins/operators can update entries" ON public."data_entries" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role)));

CREATE POLICY "System inserts profiles" ON public."profiles" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Members can insert logs" ON public."activity_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Authenticated can create orgs" ON public."organizations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "Anyone can view zone images" ON storage."objects" AS PERMISSIVE FOR SELECT TO "public" USING ((bucket_id = 'zone-images'::text));

CREATE POLICY "Authenticated users can upload zone images" ON storage."objects" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (((bucket_id = 'zone-images'::text) AND (auth.uid() IS NOT NULL)));

CREATE POLICY "Authenticated users can update zone images" ON storage."objects" AS PERMISSIVE FOR UPDATE TO "public" USING (((bucket_id = 'zone-images'::text) AND (auth.uid() IS NOT NULL)));

CREATE POLICY "Authenticated users can delete zone images" ON storage."objects" AS PERMISSIVE FOR DELETE TO "public" USING (((bucket_id = 'zone-images'::text) AND (auth.uid() IS NOT NULL)));

CREATE POLICY "Org members can view crops" ON public."crops" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins/operators can insert crops" ON public."crops" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role)));

CREATE POLICY "Admins/operators can update crops" ON public."crops" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), org_id, 'admin'::app_role) OR has_role(auth.uid(), org_id, 'operator'::app_role)));

CREATE POLICY "Admins can delete crops" ON public."crops" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), org_id, 'admin'::app_role));

CREATE POLICY "Org members can view crop stages" ON public."crop_stages" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM crops c
  WHERE ((c.id = crop_stages.crop_id) AND is_org_member(auth.uid(), c.org_id)))));

CREATE POLICY "Admins/operators can insert crop stages" ON public."crop_stages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM crops c
  WHERE ((c.id = crop_stages.crop_id) AND (has_role(auth.uid(), c.org_id, 'admin'::app_role) OR has_role(auth.uid(), c.org_id, 'operator'::app_role))))));

CREATE POLICY "Admins/operators can update crop stages" ON public."crop_stages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM crops c
  WHERE ((c.id = crop_stages.crop_id) AND (has_role(auth.uid(), c.org_id, 'admin'::app_role) OR has_role(auth.uid(), c.org_id, 'operator'::app_role))))));

CREATE POLICY "Admins can delete crop stages" ON public."crop_stages" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM crops c
  WHERE ((c.id = crop_stages.crop_id) AND has_role(auth.uid(), c.org_id, 'admin'::app_role)))));

CREATE POLICY "Org members can view thresholds" ON public."crop_stage_thresholds" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (crop_stages cs
     JOIN crops c ON ((c.id = cs.crop_id)))
  WHERE ((cs.id = crop_stage_thresholds.crop_stage_id) AND is_org_member(auth.uid(), c.org_id)))));

CREATE POLICY "Admins/operators can insert thresholds" ON public."crop_stage_thresholds" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (crop_stages cs
     JOIN crops c ON ((c.id = cs.crop_id)))
  WHERE ((cs.id = crop_stage_thresholds.crop_stage_id) AND (has_role(auth.uid(), c.org_id, 'admin'::app_role) OR has_role(auth.uid(), c.org_id, 'operator'::app_role))))));

CREATE POLICY "Admins/operators can update thresholds" ON public."crop_stage_thresholds" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (crop_stages cs
     JOIN crops c ON ((c.id = cs.crop_id)))
  WHERE ((cs.id = crop_stage_thresholds.crop_stage_id) AND (has_role(auth.uid(), c.org_id, 'admin'::app_role) OR has_role(auth.uid(), c.org_id, 'operator'::app_role))))));

CREATE POLICY "Admins can delete thresholds" ON public."crop_stage_thresholds" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (crop_stages cs
     JOIN crops c ON ((c.id = cs.crop_id)))
  WHERE ((cs.id = crop_stage_thresholds.crop_stage_id) AND has_role(auth.uid(), c.org_id, 'admin'::app_role)))));

CREATE POLICY "Gateway can insert readings" ON public."sensor_readings" AS PERMISSIVE FOR INSERT TO "anon" WITH CHECK (((device_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM sensors s
  WHERE (s.device_id = sensor_readings.device_id)))));

CREATE POLICY "Admins can manage roles" ON public."user_roles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((org_id IS NOT NULL AND role <> 'master_admin'::public.app_role AND public.has_role(auth.uid(), org_id, 'admin'::public.app_role)));

CREATE POLICY "Users can view own roles" ON public."user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR is_master_admin(auth.uid())));

CREATE POLICY "Platform branding is publicly visible" ON public."platform_settings" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Master admins can update platform branding" ON public."platform_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_master_admin(auth.uid())) WITH CHECK (((id = 'platform'::text) AND is_master_admin(auth.uid())));

CREATE POLICY "Users can view own profile pictures" ON storage."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Users can upload own profile pictures" ON storage."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Users can replace own profile pictures" ON storage."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Users can delete own profile pictures" ON storage."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'profile-pictures'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Master admins insert sensor types" ON public."sensor_types" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_master_admin(auth.uid()));

CREATE POLICY "Master admins update sensor types" ON public."sensor_types" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_master_admin(auth.uid())) WITH CHECK (is_master_admin(auth.uid()));

CREATE POLICY "Master admins delete sensor types" ON public."sensor_types" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_master_admin(auth.uid()));

CREATE POLICY "Master admins manage appliances" ON public."appliances" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_master_admin(auth.uid())) WITH CHECK (is_master_admin(auth.uid()));

CREATE POLICY "Members view rules" ON public."appliance_rules" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM appliances a
  WHERE ((a.id = appliance_rules.appliance_id) AND is_org_member(auth.uid(), a.org_id)))));

CREATE POLICY "Master admins view commands" ON public."automation_commands" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_master_admin(auth.uid()));

CREATE POLICY "Members view commands" ON public."automation_commands" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM appliances a
  WHERE ((a.id = automation_commands.appliance_id) AND is_org_member(auth.uid(), a.org_id)))));

CREATE POLICY "Master admins view orgs" ON public."organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_master_admin(auth.uid()));

CREATE POLICY "Master admins view zones" ON public."zones" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_master_admin(auth.uid()));

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO service_role, authenticated, anon;

REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO service_role, authenticated, anon;

REVOKE ALL ON FUNCTION public.is_master_admin(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO service_role, authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.log_alert_activity() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.log_alert_activity() TO service_role;

REVOKE ALL ON FUNCTION public.link_reading_device() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.link_reading_device() TO service_role;

REVOKE ALL ON FUNCTION public.master_admin_overview() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.master_admin_overview() TO service_role, authenticated;

REVOKE ALL ON FUNCTION public.org_member_details(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.org_member_details(uuid) TO service_role, authenticated;

REVOKE ALL ON FUNCTION public.sync_zone_stages(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_zone_stages(uuid) TO service_role, authenticated;

REVOKE ALL ON FUNCTION public.insert_sensor_reading(text, uuid, integer, integer, text, integer, boolean, numeric, integer, numeric, numeric, integer, numeric, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.insert_sensor_reading(text, uuid, integer, integer, text, integer, boolean, numeric, integer, numeric, numeric, integer, numeric, integer, integer, integer, integer) TO service_role, authenticated, anon;

REVOKE ALL ON FUNCTION public.queue_automation(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.queue_automation(uuid, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.evaluate_reading_alerts() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.evaluate_reading_alerts() TO service_role;

REVOKE ALL ON FUNCTION public.request_manual_automation(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.request_manual_automation(uuid, text, uuid) TO service_role, authenticated;

COMMENT ON COLUMN public.alerts.whatsapp_sent_at IS 'DEPRECATED: legacy Meta integration removed; no WhatsApp sender configured.';

COMMIT;
