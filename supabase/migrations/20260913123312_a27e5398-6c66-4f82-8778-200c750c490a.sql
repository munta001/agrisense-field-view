CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id)
$$;

DROP POLICY IF EXISTS "Master admins can view platform admins" ON public.platform_admins;
CREATE POLICY "Master admins can view platform admins"
ON public.platform_admins FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_master_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.master_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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
      'created_at', org.created_at,
      'sensor_count', (SELECT count(*) FROM public.sensors s WHERE s.org_id = org.id),
      'active_sensor_count', (SELECT count(*) FROM public.sensors s WHERE s.org_id = org.id AND s.is_active),
      'zone_count', (SELECT count(*) FROM public.zones z WHERE z.org_id = org.id),
      'reading_count', (SELECT count(*) FROM public.sensor_readings r JOIN public.sensors s ON s.id = r.sensor_id WHERE s.org_id = org.id),
      'storage_bytes', COALESCE((
        SELECT sum(COALESCE((ob.metadata->>'size')::bigint, 0))
        FROM storage.objects ob
        WHERE ob.bucket_id = 'zone-images'
          AND (storage.foldername(ob.name))[1] = org.id::text
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

REVOKE ALL ON FUNCTION public.master_admin_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.master_admin_overview() TO authenticated;