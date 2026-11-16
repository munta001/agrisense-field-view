# ThirdEye — fresh-project migration kit

Updated 16 November 2026. This recreates the application schema, not a copy of existing customer data or login accounts. Use a **fresh external project**, not the existing live database.

## Run in this order

1. Run `01_schema.sql`: all 17 application tables, constraints, indexes, 14 functions, triggers, access policies and grants. Includes appliances, rules, queued automation, manual On/Off permissions, capped stop timers and error details.
2. Run `02_setup_required.sql`: the required LoRaWAN sensor type, ThirdEye branding with blue `#055299`, and both storage buckets. Do not skip this step.
3. `02_seed_optional.sql` contains demo crops only. Skip it for production; its sample thresholds and durations are not agronomic recommendations.

Paste each whole file into the new project's SQL editor and run it. The schema file is intended to run once. Startup setup can be rerun without replacing saved records.

## Configuration that SQL cannot transfer

- Configure email confirmation, SMTP and redirect URLs on the new account. Google sign-in currently uses Lovable-managed OAuth in application code; an external deployment needs its own Google provider setup and the corresponding client sign-in change.
- Deploy **all five** folders under `supabase/functions/`: `master-admin-manage`, `bootstrap-master-admin`, `reset-user-password`, `manual-automation`, and `dispatch-automation`. For the dispatcher use `--no-verify-jwt`; its `x-dispatch-secret` check is the authentication guard. Keep the other functions' own session checks.
- Set `EMQX_API_URL`, `EMQX_API_KEY`, `EMQX_API_SECRET` and `DISPATCH_SECRET` privately on the destination. Never paste keys into SQL or chat. The destination provides its own backend service credentials.
- Recreate any external scheduler that calls the dispatcher with `x-dispatch-secret`. SQL creates the queue but does not schedule dispatch calls.
- Point a separately configured application checkout at the new account using its URL and publishable key. This bundle does **not** switch this live app away from Lovable Cloud.
- Upload the application logo and organisation/zone/profile images to the destination and update their paths. This SQL contains no old-account storage URLs or image binaries.
- Create your own confirmed sign-in account, then assign that account `master_admin` in `public.user_roles` with a null organisation. No passwords or preassigned admins are included. Inspect `bootstrap-master-admin` before deploying it: it contains an existing account email and must be adapted to your intended owner.
- Existing organisations, readings, profiles, memberships and Auth users require a separate data-transfer process; none are included here. For a full current-data export use **More → Database → Manage → Settings → Export data**.

## Security and compatibility notes

- RLS is enabled on all 17 tables. Anonymous table access is limited to reading branding and the existing gateway insert policy; internal automation queue writes are server-only.
- Role editing in this export prevents organisation admins creating/promoting Master Admins and removes the recursive first-member role fallback.
- Application user IDs are plain UUIDs except the profiles and user_roles Auth links.
- The obsolete `companies` fallback is removed from ingestion. `whatsapp_sent_at` is retained as deprecated for compatibility; no Meta/WhatsApp sending hook or Twilio integration is included.
- Existing gateway ingestion and other access policies are preserved; review gateway credentials and tenant/storage policies before exposing a new production deployment.
