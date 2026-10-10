ALTER TABLE public.profiles ADD COLUMN phone_number text;
COMMENT ON COLUMN public.profiles.phone_number IS 'User contact phone number, editable by the user and master admins';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'phone_number', '')
  );
  RETURN NEW;
END;
$function$;