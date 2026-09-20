import { supabase } from "@/integrations/supabase/client";

export const PROFILE_PICTURE_BUCKET = "profile-pictures";
export const PROFILE_UPDATED_EVENT = "agrisense:profile-updated";

export const isStoredProfilePicture = (value?: string | null) =>
  Boolean(value && !value.startsWith("http://") && !value.startsWith("https://") && !value.startsWith("data:"));

export async function resolveProfilePicture(value?: string | null) {
  if (!value) return null;
  if (!isStoredProfilePicture(value)) return value;

  const { data, error } = await supabase.storage
    .from(PROFILE_PICTURE_BUCKET)
    .createSignedUrl(value, 60 * 60);

  return error ? null : data.signedUrl;
}