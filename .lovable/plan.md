# Editable platform branding

## What will be built
- Add a Master Admin-only **Platform branding** page.
- Let a Master Admin edit the platform name, upload/replace the platform logo, and choose the main tone color.
- Show a live preview before saving.
- Apply the saved name, logo, and tone color across both the organisation workspace and Master Admin header.
- Keep the current AgriSense branding as the default when no custom value has been saved.

## Access and safety
- Store one shared platform-branding record in the database.
- Everyone may read the branding so login and application screens stay consistent.
- Only an active Master Admin may change it.
- Validate logo type/size and the tone color before saving.

## Technical details
- Add a `platform_settings` table with `platform_name`, `logo_url`, and `tone_color`, protected by row-level access rules.
- Extend the existing protected Master Admin function to upload the logo and update settings.
- Add a shared branding provider that converts the selected hex color into semantic theme variables without hardcoded page colors.
- Add the new route and navigation entry, then verify desktop and mobile layouts.
