-- ============================================================
-- AgriSense — full Supabase schema migration
-- Run this ONCE in the SQL Editor of a FRESH Supabase project.
-- Idempotent-friendly ordering: extensions/types -> tables ->
-- functions -> triggers -> indexes -> RLS -> policies -> grants.
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'operator',
    'viewer',
    'master_admin'
);


--
-- Name: evaluate_reading_alerts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evaluate_reading_alerts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'phone_number', '')
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _org_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND org_id = _org_id AND role = _role
  )
$$;


--
-- Name: insert_sensor_reading(text, uuid, integer, integer, text, integer, boolean, numeric, integer, numeric, numeric, integer, numeric, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_sensor_reading(p_dev_eui text, p_org_id uuid, p_device_id integer, p_serial_number integer, p_channel text, p_packet_type integer, p_checksum_valid boolean, p_battery_v numeric, p_report_cycle_s integer, p_temperature_c numeric, p_moisture_pct numeric, p_conductivity integer, p_ph numeric, p_nitrogen integer, p_phosphorus integer, p_potassium integer, p_salinity integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: is_master_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_master_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'master_admin'
      AND is_active
  )
$$;


--
-- Name: is_org_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND org_id = _org_id
  )
$$;


--
-- Name: link_reading_device(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_reading_device() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: log_alert_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_alert_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: master_admin_overview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.master_admin_overview() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: org_member_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_member_details(p_org_id uuid) RETURNS TABLE(id uuid, user_id uuid, role public.app_role, is_active boolean, created_at timestamp with time zone, full_name text, email text, last_sign_in_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: sync_zone_stages(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_zone_stages(p_org_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    sensor_id uuid,
    title text NOT NULL,
    message text,
    severity text DEFAULT 'info'::text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metric text,
    CONSTRAINT alerts_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: crop_stage_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crop_stage_thresholds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crop_stage_id uuid NOT NULL,
    sensor_type_id uuid,
    min_value numeric,
    max_value numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metric text
);


--
-- Name: crop_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crop_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crop_id uuid NOT NULL,
    name text NOT NULL,
    stage_order integer DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    duration_days integer DEFAULT 0 NOT NULL
);


--
-- Name: crops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: data_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    sensor_id uuid,
    value numeric NOT NULL,
    notes text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sensor_limit integer DEFAULT 10 NOT NULL,
    zone_limit integer DEFAULT 10 NOT NULL
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id text DEFAULT 'platform'::text NOT NULL,
    platform_name text DEFAULT 'AgriSense'::text NOT NULL,
    logo_url text,
    tone_color text DEFAULT '#23704F'::text NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_settings_id_check CHECK ((id = 'platform'::text)),
    CONSTRAINT platform_settings_platform_name_check CHECK (((char_length(platform_name) >= 1) AND (char_length(platform_name) <= 80))),
    CONSTRAINT platform_settings_tone_color_check CHECK ((tone_color ~ '^#[0-9A-Fa-f]{6}$'::text))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone_number text
);


--
-- Name: COLUMN profiles.phone_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.phone_number IS 'User contact phone number, editable by the user and master admins';


--
-- Name: sensor_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sensor_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sensor_id uuid,
    value numeric,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    device_id integer,
    serial_number integer,
    channel text,
    packet_type integer,
    checksum_valid boolean,
    battery_v numeric(5,3),
    report_cycle_s integer,
    temperature_c numeric(6,1),
    moisture_pct numeric(6,1),
    conductivity integer,
    ph numeric(5,2),
    nitrogen integer,
    phosphorus integer,
    potassium integer,
    salinity integer,
    dev_eui text
);


--
-- Name: sensor_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sensor_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    icon text,
    description text,
    min_value numeric,
    max_value numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sensors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sensors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    sensor_type_id uuid NOT NULL,
    zone_id uuid,
    name text NOT NULL,
    ip_address text,
    latitude numeric,
    longitude numeric,
    map_x numeric,
    map_y numeric,
    status text DEFAULT 'online'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    device_id integer,
    location text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    dev_eui text,
    CONSTRAINT sensors_status_check CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text, 'maintenance'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid,
    role public.app_role DEFAULT 'viewer'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#22c55e'::text NOT NULL,
    boundaries jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    background_image_url text,
    crop_id uuid,
    crop_stage_id uuid,
    crop_start_date date
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: crop_stage_thresholds crop_stage_thresholds_crop_stage_id_sensor_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_stage_thresholds
    ADD CONSTRAINT crop_stage_thresholds_crop_stage_id_sensor_type_id_key UNIQUE (crop_stage_id, sensor_type_id);


--
-- Name: crop_stage_thresholds crop_stage_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_stage_thresholds
    ADD CONSTRAINT crop_stage_thresholds_pkey PRIMARY KEY (id);


--
-- Name: crop_stages crop_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_stages
    ADD CONSTRAINT crop_stages_pkey PRIMARY KEY (id);


--
-- Name: crops crops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crops
    ADD CONSTRAINT crops_pkey PRIMARY KEY (id);


--
-- Name: data_entries data_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entries
    ADD CONSTRAINT data_entries_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: sensor_readings sensor_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_pkey PRIMARY KEY (id);


--
-- Name: sensor_types sensor_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensor_types
    ADD CONSTRAINT sensor_types_pkey PRIMARY KEY (id);


--
-- Name: sensors sensors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensors
    ADD CONSTRAINT sensors_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_org_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_org_id_key UNIQUE (user_id, org_id);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: crop_stage_thresholds_stage_metric_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX crop_stage_thresholds_stage_metric_key ON public.crop_stage_thresholds USING btree (crop_stage_id, metric) WHERE (metric IS NOT NULL);


--
-- Name: idx_readings_device_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_readings_device_time ON public.sensor_readings USING btree (device_id, recorded_at DESC);


--
-- Name: sensors_dev_eui_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sensors_dev_eui_unique_idx ON public.sensors USING btree (dev_eui) WHERE (dev_eui IS NOT NULL);


--
-- Name: user_roles_master_admin_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_roles_master_admin_unique ON public.user_roles USING btree (user_id) WHERE (role = 'master_admin'::public.app_role);


--
-- Name: sensor_readings evaluate_reading_alerts_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER evaluate_reading_alerts_trg AFTER INSERT ON public.sensor_readings FOR EACH ROW EXECUTE FUNCTION public.evaluate_reading_alerts();


--
-- Name: sensor_readings link_reading_device_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER link_reading_device_trg BEFORE INSERT ON public.sensor_readings FOR EACH ROW EXECUTE FUNCTION public.link_reading_device();


--
-- Name: alerts on_alert_log_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_alert_log_activity AFTER INSERT ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.log_alert_activity();


--
-- Name: crop_stages update_crop_stages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_crop_stages_updated_at BEFORE UPDATE ON public.crop_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: crops update_crops_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_crops_updated_at BEFORE UPDATE ON public.crops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: platform_settings update_platform_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sensors update_sensors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sensors_updated_at BEFORE UPDATE ON public.sensors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: zones update_zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_logs activity_logs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: alerts alerts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensors(id) ON DELETE SET NULL;


--
-- Name: crop_stage_thresholds crop_stage_thresholds_crop_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_stage_thresholds
    ADD CONSTRAINT crop_stage_thresholds_crop_stage_id_fkey FOREIGN KEY (crop_stage_id) REFERENCES public.crop_stages(id) ON DELETE CASCADE;


--
-- Name: crop_stage_thresholds crop_stage_thresholds_sensor_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_stage_thresholds
    ADD CONSTRAINT crop_stage_thresholds_sensor_type_id_fkey FOREIGN KEY (sensor_type_id) REFERENCES public.sensor_types(id) ON DELETE CASCADE;


--
-- Name: crop_stages crop_stages_crop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crop_stages
    ADD CONSTRAINT crop_stages_crop_id_fkey FOREIGN KEY (crop_id) REFERENCES public.crops(id) ON DELETE CASCADE;


--
-- Name: crops crops_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crops
    ADD CONSTRAINT crops_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: data_entries data_entries_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entries
    ADD CONSTRAINT data_entries_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: data_entries data_entries_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entries
    ADD CONSTRAINT data_entries_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensors(id) ON DELETE SET NULL;


--
-- Name: data_entries data_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entries
    ADD CONSTRAINT data_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sensor_readings sensor_readings_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensors(id) ON DELETE CASCADE;


--
-- Name: sensors sensors_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensors
    ADD CONSTRAINT sensors_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sensors sensors_sensor_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensors
    ADD CONSTRAINT sensors_sensor_type_id_fkey FOREIGN KEY (sensor_type_id) REFERENCES public.sensor_types(id);


--
-- Name: sensors sensors_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensors
    ADD CONSTRAINT sensors_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- Name: user_roles user_roles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: zones zones_crop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_crop_id_fkey FOREIGN KEY (crop_id) REFERENCES public.crops(id) ON DELETE SET NULL;


--
-- Name: zones zones_crop_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_crop_stage_id_fkey FOREIGN KEY (crop_stage_id) REFERENCES public.crop_stages(id) ON DELETE SET NULL;


--
-- Name: zones zones_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: crop_stages Admins can delete crop stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete crop stages" ON public.crop_stages FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.crops c
  WHERE ((c.id = crop_stages.crop_id) AND public.has_role(auth.uid(), c.org_id, 'admin'::public.app_role)))));


--
-- Name: crops Admins can delete crops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete crops" ON public.crops FOR DELETE TO authenticated USING (public.has_role(auth.uid(), org_id, 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), org_id, 'admin'::public.app_role));


--
-- Name: sensors Admins can delete sensors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete sensors" ON public.sensors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), org_id, 'admin'::public.app_role));


--
-- Name: crop_stage_thresholds Admins can delete thresholds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete thresholds" ON public.crop_stage_thresholds FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.crop_stages cs
     JOIN public.crops c ON ((c.id = cs.crop_id)))
  WHERE ((cs.id = crop_stage_thresholds.crop_stage_id) AND public.has_role(auth.uid(), c.org_id, 'admin'::public.app_role)))));


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (((org_id IS NOT NULL) AND (role <> 'master_admin'::public.app_role) AND (public.has_role(auth.uid(), org_id, 'admin'::public.app_role) OR (NOT (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE (ur.org_id = user_roles.org_id)))))));


--
-- Name: organizations Admins can update orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update orgs" ON public.organizations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), id, 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), org_id, 'admin'::public.app_role));


--
-- Name: data_entries Admins/operators can add entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can add entries" ON public.data_entries FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), org_id, 'operator'::public.app_role)));


--
-- Name: sensors Admins/operators can add sensors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can add sensors" ON public.sensors FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), org_id, 'operator'::public.app_role)));


--
-- Name: alerts Admins/operators can create alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can create alerts" ON public.alerts FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), org_id, 'operator'::public.app_role)));


--
-- Name: crop_stages Admins/operators can insert crop stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can insert crop stages" ON public.crop_stages FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.crops c
  WHERE ((c.id = crop_stages.crop_id) AND (public.has_role(auth.uid(), c.org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), c.org_id, 'operator'::public.app_role))))));


--
-- Name: crops Admins/operators can insert crops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can insert crops" ON public.crops FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), org_id, 'operator'::public.app_role)));


--
-- Name: sensor_readings Admins/operators can insert readings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can insert readings" ON public.sensor_readings FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sensors s
  WHERE ((s.id = sensor_readings.sensor_id) AND (public.has_role(auth.uid(), s.org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), s.org_id, 'operator'::public.app_role))))));


--
-- Name: crop_stage_thresholds Admins/operators can insert thresholds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can insert thresholds" ON public.crop_stage_thresholds FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.crop_stages cs
     JOIN public.crops c ON ((c.id = cs.crop_id)))
  WHERE ((cs.id = crop_stage_thresholds.crop_stage_id) AND (public.has_role(auth.uid(), c.org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), c.org_id, 'operator'::public.app_role))))));


--
-- Name: zones Admins/operators can manage zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can manage zones" ON public.zones FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), org_id, 'operator'::public.app_role)));


--
-- Name: crop_stages Admins/operators can update crop stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can update crop stages" ON public.crop_stages FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.crops c
  WHERE ((c.id = crop_stages.crop_id) AND (public.has_role(auth.uid(), c.org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), c.org_id, 'operator'::public.app_role))))));


--
-- Name: crops Admins/operators can update crops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can update crops" ON public.crops FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), org_id, 'operator'::public.app_role)));


--
-- Name: data_entries Admins/operators can update entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can update entries" ON public.data_entries FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), org_id, 'operator'::public.app_role)));


--
-- Name: sensors Admins/operators can update sensors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can update sensors" ON public.sensors FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), org_id, 'operator'::public.app_role)));


--
-- Name: crop_stage_thresholds Admins/operators can update thresholds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can update thresholds" ON public.crop_stage_thresholds FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.crop_stages cs
     JOIN public.crops c ON ((c.id = cs.crop_id)))
  WHERE ((cs.id = crop_stage_thresholds.crop_stage_id) AND (public.has_role(auth.uid(), c.org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), c.org_id, 'operator'::public.app_role))))));


--
-- Name: zones Admins/operators can update zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/operators can update zones" ON public.zones FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), org_id, 'admin'::public.app_role) OR public.has_role(auth.uid(), org_id, 'operator'::public.app_role)));


--
-- Name: sensor_types Anyone can view sensor types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view sensor types" ON public.sensor_types FOR SELECT TO authenticated USING (true);


--
-- Name: organizations Authenticated can create orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can create orgs" ON public.organizations FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: sensor_readings Gateway can insert readings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gateway can insert readings" ON public.sensor_readings FOR INSERT TO anon WITH CHECK (((device_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sensors s
  WHERE (s.device_id = sensor_readings.device_id)))));


--
-- Name: platform_settings Master admins can update platform branding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admins can update platform branding" ON public.platform_settings FOR UPDATE TO authenticated USING (public.is_master_admin(auth.uid())) WITH CHECK (((id = 'platform'::text) AND public.is_master_admin(auth.uid())));


--
-- Name: sensor_types Master admins delete sensor types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admins delete sensor types" ON public.sensor_types FOR DELETE TO authenticated USING (public.is_master_admin(auth.uid()));


--
-- Name: sensor_types Master admins insert sensor types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admins insert sensor types" ON public.sensor_types FOR INSERT TO authenticated WITH CHECK (public.is_master_admin(auth.uid()));


--
-- Name: sensor_types Master admins update sensor types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admins update sensor types" ON public.sensor_types FOR UPDATE TO authenticated USING (public.is_master_admin(auth.uid())) WITH CHECK (public.is_master_admin(auth.uid()));


--
-- Name: activity_logs Members can insert logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), org_id));


--
-- Name: alerts Members can mark alerts read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can mark alerts read" ON public.alerts FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), org_id));


--
-- Name: alerts Org members can view alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view alerts" ON public.alerts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));


--
-- Name: crop_stages Org members can view crop stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view crop stages" ON public.crop_stages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.crops c
  WHERE ((c.id = crop_stages.crop_id) AND public.is_org_member(auth.uid(), c.org_id)))));


--
-- Name: crops Org members can view crops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view crops" ON public.crops FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));


--
-- Name: data_entries Org members can view entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view entries" ON public.data_entries FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));


--
-- Name: activity_logs Org members can view logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));


--
-- Name: organizations Org members can view orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view orgs" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id));


--
-- Name: sensor_readings Org members can view readings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view readings" ON public.sensor_readings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.sensors s
  WHERE ((s.id = sensor_readings.sensor_id) AND public.is_org_member(auth.uid(), s.org_id)))));


--
-- Name: user_roles Org members can view roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));


--
-- Name: sensors Org members can view sensors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view sensors" ON public.sensors FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));


--
-- Name: crop_stage_thresholds Org members can view thresholds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view thresholds" ON public.crop_stage_thresholds FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.crop_stages cs
     JOIN public.crops c ON ((c.id = cs.crop_id)))
  WHERE ((cs.id = crop_stage_thresholds.crop_stage_id) AND public.is_org_member(auth.uid(), c.org_id)))));


--
-- Name: zones Org members can view zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view zones" ON public.zones FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));


--
-- Name: platform_settings Platform branding is publicly visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform branding is publicly visible" ON public.platform_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: profiles System inserts profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System inserts profiles" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_master_admin(auth.uid())));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: crop_stage_thresholds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crop_stage_thresholds ENABLE ROW LEVEL SECURITY;

--
-- Name: crop_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crop_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: crops; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;

--
-- Name: data_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: sensor_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

--
-- Name: sensor_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sensor_types ENABLE ROW LEVEL SECURITY;

--
-- Name: sensors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




-- ============================================================
-- TABLE GRANTS (required for the Data API / PostgREST)
-- Row-level security below decides what each role may actually see.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================================
-- FUNCTION EXECUTE PRIVILEGES
-- (matches production: sensitive helpers are not callable by everyone)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_reading_device() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_alert_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_master_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.master_admin_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_member_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.master_admin_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_member_details(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_sensor_reading(text, uuid, integer, integer, text, integer, boolean, numeric, integer, numeric, numeric, integer, numeric, integer, integer, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_zone_stages(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_reading_alerts() TO anon, authenticated, service_role;

-- ============================================================
-- AUTH TRIGGER — create a profile row on every signup
-- ============================================================

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('zone-images', 'zone-images', true, NULL, NULL),
  ('profile-pictures', 'profile-pictures', false, 5242880, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

-- Zone images: public to read, any signed-in user may manage (org-scoped in app logic)
CREATE POLICY "Anyone can view zone images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'zone-images');

CREATE POLICY "Authenticated users can upload zone images"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'zone-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update zone images"
ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'zone-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete zone images"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'zone-images' AND auth.uid() IS NOT NULL);

-- Profile pictures: private, each user restricted to their own folder
CREATE POLICY "Users can view own profile pictures"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Users can upload own profile pictures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Users can replace own profile pictures"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = (auth.uid())::text)
WITH CHECK (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Users can delete own profile pictures"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = (auth.uid())::text);
