
-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User Roles (per org)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Sensor Types
CREATE TABLE public.sensor_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sensor_types ENABLE ROW LEVEL SECURITY;

-- 5. Zones (field areas)
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#22c55e',
  boundaries JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

-- 6. Sensors
CREATE TABLE public.sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sensor_type_id UUID NOT NULL REFERENCES public.sensor_types(id),
  zone_id UUID REFERENCES public.zones(id),
  name TEXT NOT NULL,
  ip_address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  map_x NUMERIC,
  map_y NUMERIC,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;

-- 7. Sensor Readings
CREATE TABLE public.sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES public.sensors(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

-- 8. Alerts
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sensor_id UUID REFERENCES public.sensors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- 9. Activity Logs
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 10. Data Entries (manual input)
CREATE TABLE public.data_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sensor_id UUID REFERENCES public.sensors(id) ON DELETE SET NULL,
  value NUMERIC NOT NULL,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.data_entries ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sensors_updated_at BEFORE UPDATE ON public.sensors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _org_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND org_id = _org_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND org_id = _org_id
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System inserts profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- Organizations: members can view
CREATE POLICY "Org members can view orgs" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "Authenticated can create orgs" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update orgs" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), id, 'admin'));

-- User Roles
CREATE POLICY "Org members can view roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin') OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.org_id = user_roles.org_id));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin'));

-- Sensor Types: all authenticated can view
CREATE POLICY "Anyone can view sensor types" ON public.sensor_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage sensor types" ON public.sensor_types FOR INSERT TO authenticated WITH CHECK (true);

-- Zones
CREATE POLICY "Org members can view zones" ON public.zones FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins/operators can manage zones" ON public.zones FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'operator'));
CREATE POLICY "Admins/operators can update zones" ON public.zones FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'operator'));

-- Sensors
CREATE POLICY "Org members can view sensors" ON public.sensors FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins/operators can add sensors" ON public.sensors FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'operator'));
CREATE POLICY "Admins/operators can update sensors" ON public.sensors FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'operator'));
CREATE POLICY "Admins can delete sensors" ON public.sensors FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin'));

-- Sensor Readings
CREATE POLICY "Org members can view readings" ON public.sensor_readings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sensors s WHERE s.id = sensor_id AND public.is_org_member(auth.uid(), s.org_id)));
CREATE POLICY "Admins/operators can insert readings" ON public.sensor_readings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sensors s WHERE s.id = sensor_id AND (public.has_role(auth.uid(), s.org_id, 'admin') OR public.has_role(auth.uid(), s.org_id, 'operator'))));

-- Alerts
CREATE POLICY "Org members can view alerts" ON public.alerts FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins/operators can create alerts" ON public.alerts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'operator'));
CREATE POLICY "Members can mark alerts read" ON public.alerts FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

-- Activity Logs
CREATE POLICY "Org members can view logs" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "System can insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Data Entries
CREATE POLICY "Org members can view entries" ON public.data_entries FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins/operators can add entries" ON public.data_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'operator'));
CREATE POLICY "Admins/operators can update entries" ON public.data_entries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'operator'));

-- Seed 5 sensor types
INSERT INTO public.sensor_types (name, unit, icon, description, min_value, max_value) VALUES
  ('Temperature', '°C', 'thermometer', 'Measures ambient or soil temperature', -10, 60),
  ('Humidity', '%', 'droplets', 'Measures relative humidity levels', 0, 100),
  ('Soil Moisture', '%', 'cloud-rain', 'Measures soil water content', 0, 100),
  ('Light Intensity', 'lux', 'sun', 'Measures light exposure for crops', 0, 120000),
  ('pH Level', 'pH', 'flask-conical', 'Measures soil or water acidity', 0, 14);
