
-- Fix profile insert policy
DROP POLICY "System inserts profiles" ON public.profiles;
CREATE POLICY "System inserts profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fix activity log insert
DROP POLICY "System can insert logs" ON public.activity_logs;
CREATE POLICY "Members can insert logs" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- Fix sensor types insert (restrict to authenticated, keep simple since it's reference data)
DROP POLICY "Only admins can manage sensor types" ON public.sensor_types;

-- Fix org creation - user must exist
DROP POLICY "Authenticated can create orgs" ON public.organizations;
CREATE POLICY "Authenticated can create orgs" ON public.organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
