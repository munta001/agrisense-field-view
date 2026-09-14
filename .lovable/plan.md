# Profile page

## What will be added
- Add a Profile page available to every signed-in user, including Master Admin, Admin, Operator, and Viewer.
- Show the user's name, email address, account status, sign-in method, account creation date, and last sign-in.
- Show organisation membership details and the user's role for the selected organisation.
- Add Profile to both the organisation sidebar and the Master Admin navigation.
- Include clear loading and unavailable-data states, with a mobile-friendly layout.

## Technical details
- Read account data from the signed-in session, the existing profile record, organisation context, and role records.
- Reuse existing protected layouts and design components; no database schema changes are required.
- Add protected routes for regular users and Master Admin users.
- Verify the page for both navigation modes and check the application build.
