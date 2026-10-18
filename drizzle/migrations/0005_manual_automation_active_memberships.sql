CREATE OR REPLACE FUNCTION public.request_manual_automation(p_appliance_id uuid, p_command text, p_alert_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;
REVOKE ALL ON FUNCTION public.request_manual_automation(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_manual_automation(uuid,text,uuid) TO authenticated;