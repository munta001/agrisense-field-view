DROP TRIGGER IF EXISTS alerts_whatsapp_notify ON public.alerts;
DROP FUNCTION IF EXISTS public.notify_whatsapp_alert();
COMMENT ON COLUMN public.alerts.whatsapp_sent_at IS 'DEPRECATED: WhatsApp (Meta) alert sending removed; no longer written or read.';