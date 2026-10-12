# AgriSense — Supabase migration kit

Everything the app needs in the database, extracted from the production
project and cleaned up so it runs on a **fresh** Supabase project.

## Files

| File | What it is |
|---|---|
| `01_schema.sql` | **Required.** Full schema: 14 tables, all functions, triggers (including the signup profile trigger on `auth.users`), indexes, row-level security policies, grants, and both storage buckets (`zone-images` public, `profile-pictures` private with a 5 MB limit) with their policies. |
| `02_seed_optional.sql` | **Optional.** Baseline data: the Soil 8-in-1 (LoRaWAN) sensor type, the platform branding row, and two crop templates (Tomato with stages + thresholds, Lettuce). |

## How to run

1. Create the new project at supabase.com.
2. Open **SQL Editor → New query**, paste the whole of `01_schema.sql`, and run it. It takes a few seconds.
3. (Optional) Paste and run `02_seed_optional.sql`.
4. In **Authentication → Providers**, configure Email (and Google if you use Google sign-in).
5. In **Authentication → URL configuration**, add your app's URL to the redirect allow-list.
6. Deploy the two edge functions (`master-admin-manage`, `bootstrap-master-admin`) — they live in the app's `supabase/functions/` folder and are separate from the database.
7. Put your project URL and anon key into the app's `.env`:
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
8. Create your first master admin: run the `bootstrap-master-admin` edge function (or insert a row into `public.user_roles` with `role = 'master_admin'` for your user id).

## Notes

- Row-level security is enabled on every table — with no policies nothing is readable, and all policies are included here, so the app works the same as production.
- All 14 tables are granted to `anon`, `authenticated` and `service_role`; RLS decides what each role can actually touch. The LoRaWAN gateway inserts readings through the anon key using the `insert_sensor_reading` function.
- One production bug was fixed while extracting: `insert_sensor_reading` referenced a `companies` table that does not exist; that dead fallback was removed.
- The seed uses placeholder UUIDs so it cannot collide with real data you add later.
- Sensitive helper functions (`handle_new_user`, `log_alert_activity`, `org_member_details`, `master_admin_overview`, etc.) have their EXECUTE rights restricted to match production.
