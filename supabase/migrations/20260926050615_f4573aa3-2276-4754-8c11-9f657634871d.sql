create or replace function public.log_alert_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

drop trigger if exists on_alert_log_activity on public.alerts;
create trigger on_alert_log_activity
  after insert on public.alerts
  for each row execute function public.log_alert_activity();