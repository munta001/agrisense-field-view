# Editable user profiles

## What will change
- Add an edit area on the Profile page for every role.
- Let a signed-in user update their display name.
- Let a signed-in user upload, replace, or remove their profile picture with clear loading and error states.
- Refresh the Profile page and account menu immediately after saving.

## Image storage
- Create a dedicated private storage area named `profile-pictures` (shown in the product as “Profile Pictures”).
- Store each user’s image inside a folder identified by their account ID.
- Allow users to read, upload, replace, and delete only their own images.
- Accept image files up to 5 MB.
- When replacing a picture, upload the new file, update the profile, then delete the previous stored file. If updating the profile fails, remove the newly uploaded file so no unused copy remains.

## Technical details
- Keep the existing `profiles.full_name` and `profiles.avatar_url` fields; no new profile table is needed.
- Add storage access rules scoped to the signed-in user’s folder.
- Use signed image URLs because the storage area is private.
- Preserve external sign-in avatars as a fallback until a user uploads their own picture.
- Verify name editing, first upload, replacement, old-file deletion, and the account-menu display.
