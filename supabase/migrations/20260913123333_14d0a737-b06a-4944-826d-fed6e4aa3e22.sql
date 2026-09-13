REVOKE ALL ON FUNCTION public.is_master_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.master_admin_overview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.master_admin_overview() TO authenticated, service_role;