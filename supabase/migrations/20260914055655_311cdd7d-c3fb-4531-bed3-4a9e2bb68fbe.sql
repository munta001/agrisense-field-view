ALTER TABLE public.user_roles ALTER COLUMN org_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_master_admin_unique
  ON public.user_roles (user_id) WHERE role = 'master_admin';

INSERT INTO public.user_roles (user_id, org_id, role, is_active)
SELECT pa.user_id, NULL, 'master_admin'::app_role, true
FROM public.platform_admins pa
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'master_admin'
      AND is_active
  )
$$;

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  org_id IS NOT NULL AND role <> 'master_admin'::app_role AND (
    has_role(auth.uid(), org_id, 'admin'::app_role)
    OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.org_id = user_roles.org_id)
  )
);

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_master_admin(auth.uid()));

DROP TABLE public.platform_admins;