CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_whatsapp_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.severity IN ('warning','critical') THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://ibzfrlkmojekmbbsglqc.supabase.co/functions/v1/send-whatsapp-alert',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('alert_id', NEW.id)
      );
    EXCEPTION WHEN OTHERS THEN NULL; -- never block alert creation
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_whatsapp_alert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS alerts_whatsapp_notify ON public.alerts;
CREATE TRIGGER alerts_whatsapp_notify AFTER INSERT ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.notify_whatsapp_alert();