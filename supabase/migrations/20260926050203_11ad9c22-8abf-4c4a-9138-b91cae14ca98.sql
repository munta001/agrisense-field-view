CREATE POLICY "Master admins insert sensor types" ON public.sensor_types FOR INSERT TO authenticated WITH CHECK (public.is_master_admin(auth.uid()));
CREATE POLICY "Master admins update sensor types" ON public.sensor_types FOR UPDATE TO authenticated USING (public.is_master_admin(auth.uid())) WITH CHECK (public.is_master_admin(auth.uid()));
CREATE POLICY "Master admins delete sensor types" ON public.sensor_types FOR DELETE TO authenticated USING (public.is_master_admin(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensor_types TO authenticated;

CREATE OR REPLACE FUNCTION public.org_member_details(p_org_id uuid)
RETURNS TABLE(id uuid, user_id uuid, role app_role, is_active boolean, created_at timestamptz, full_name text, email text, last_sign_in_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
REVOKE EXECUTE ON FUNCTION public.org_member_details(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.org_member_details(uuid) TO authenticated;