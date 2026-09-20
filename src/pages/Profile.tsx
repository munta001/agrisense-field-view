import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Building2, CalendarDays, Camera, Clock3, Loader2, Mail, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { MasterAdminLayout } from "@/components/MasterAdminLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isStoredProfilePicture,
  PROFILE_PICTURE_BUCKET,
  PROFILE_UPDATED_EVENT,
  resolveProfilePicture,
} from "@/lib/profile-picture";

type ProfileRecord = {
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

type Membership = {
  id: string;
  org_id: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

const displayRole = (role: string) =>
  role === "master_admin"
    ? "Master Admin"
    : role.charAt(0).toUpperCase() + role.slice(1);

const displayDate = (value?: string | null, includeTime = false) => {
  if (!value) return "Not available";
  return format(new Date(value), includeTime ? "dd MMM yyyy, HH:mm" : "dd MMM yyyy");
};

function DetailItem({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-3 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function ProfileContent() {
  const { user, isMasterAdmin } = useAuth();
  const { orgs, currentOrg, currentRole } = useOrg();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullNameInput, setFullNameInput] = useState("");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [selectedPicture, setSelectedPicture] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [removePicture, setRemovePicture] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    Promise.all([
      supabase
        .from("profiles")
        .select("full_name, avatar_url, created_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("id, org_id, role, is_active, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]).then(async ([profileResult, rolesResult]) => {
      const nextProfile = profileResult.data as ProfileRecord | null;
      setProfile(nextProfile);
      setFullNameInput(nextProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "");
      setAvatarSrc(await resolveProfilePicture(nextProfile?.avatar_url || user.user_metadata?.avatar_url));
      setMemberships((rolesResult.data || []) as Membership[]);
      setLoading(false);
    });
  }, [user?.id]);

  useEffect(() => () => {
    if (picturePreview) URL.revokeObjectURL(picturePreview);
  }, [picturePreview]);

  const handlePictureSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a PNG, JPG, or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile picture must be under 5 MB");
      return;
    }
    setSelectedPicture(file);
    setPicturePreview(URL.createObjectURL(file));
    setRemovePicture(false);
  };

  const markPictureForRemoval = () => {
    setSelectedPicture(null);
    setPicturePreview(null);
    setRemovePicture(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    const trimmedName = fullNameInput.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    let newPicturePath: string | null = null;
    const previousPicturePath = isStoredProfilePicture(profile?.avatar_url) ? profile?.avatar_url || null : null;

    try {
      if (selectedPicture) {
        const extension = selectedPicture.name.split(".").pop()?.toLowerCase() || "jpg";
        newPicturePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(PROFILE_PICTURE_BUCKET)
          .upload(newPicturePath, selectedPicture, { contentType: selectedPicture.type, upsert: false });
        if (uploadError) throw uploadError;
      }

      const avatarUrl = newPicturePath || (removePicture ? null : profile?.avatar_url || null);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName, avatar_url: avatarUrl })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      if (previousPicturePath && (newPicturePath || removePicture)) {
        const { error: deleteError } = await supabase.storage
          .from(PROFILE_PICTURE_BUCKET)
          .remove([previousPicturePath]);
        if (deleteError) toast.error("Profile saved, but the previous picture could not be removed");
      }

      const nextProfile = { ...profile, full_name: trimmedName, avatar_url: avatarUrl } as ProfileRecord;
      setProfile(nextProfile);
      setAvatarSrc(await resolveProfilePicture(avatarUrl || user.user_metadata?.avatar_url));
      setSelectedPicture(null);
      setPicturePreview(null);
      setRemovePicture(false);
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
      toast.success("Profile updated");
    } catch (error) {
      if (newPicturePath) {
        await supabase.storage.from(PROFILE_PICTURE_BUCKET).remove([newPicturePath]);
      }
      toast.error(error instanceof Error ? error.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "User";
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "U";
  const provider = user?.app_metadata?.provider === "google" ? "Google" : "Email and password";
  const activeMemberships = memberships.filter(membership => membership.is_active);
  const organisationRoles = useMemo(
    () => activeMemberships.filter(membership => membership.org_id),
    [memberships],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-20 w-full max-w-md" />
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">My account</p>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your personal and access details.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          <div className="h-2 bg-primary" />
          <CardContent className="flex flex-col items-center px-6 py-8 text-center">
            <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
              <AvatarImage className="object-cover" src={picturePreview || (removePicture ? undefined : avatarSrc || undefined)} alt={fullName} />
              <AvatarFallback className="bg-secondary text-xl font-semibold text-secondary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handlePictureSelection}
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={saving}>
                <Camera className="mr-2 h-4 w-4" /> {avatarSrc || picturePreview ? "Replace photo" : "Add photo"}
              </Button>
              {(avatarSrc || picturePreview) && !removePicture && (
                <Button type="button" variant="ghost" size="icon" onClick={markPictureForRemoval} disabled={saving} aria-label="Remove profile picture" title="Remove profile picture">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <h2 className="mt-4 font-display text-xl font-bold">{fullName}</h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">{user?.email || "No email address"}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Badge variant="secondary">Active account</Badge>
              <Badge variant="outline">{isMasterAdmin ? "Master Admin" : displayRole(currentRole?.role || "viewer")}</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRound className="h-5 w-5 text-primary" /> Edit profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" value={fullNameInput} onChange={event => setFullNameInput(event.target.value)} maxLength={100} disabled={saving} />
              </div>
              <Button className="mt-4" onClick={saveProfile} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRound className="h-5 w-5 text-primary" /> Account details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid divide-y sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
              <DetailItem icon={Mail} label="Email address" value={user?.email || "Not available"} />
              <DetailItem icon={ShieldCheck} label="Sign-in method" value={provider} />
              <DetailItem icon={CalendarDays} label="Account created" value={displayDate(user?.created_at || profile?.created_at)} />
              <DetailItem icon={Clock3} label="Last sign-in" value={displayDate(user?.last_sign_in_at, true)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" /> Access and organisations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isMasterAdmin && (
                <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 p-4">
                  <div>
                    <p className="font-medium">Platform administration</p>
                    <p className="mt-1 text-sm text-muted-foreground">Access across all organisations</p>
                  </div>
                  <Badge>Master Admin</Badge>
                </div>
              )}

              {!isMasterAdmin && organisationRoles.map(membership => {
                const organisation = orgs.find(org => org.id === membership.org_id);
                const isCurrent = currentOrg?.id === membership.org_id;
                return (
                  <div key={membership.id} className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{organisation?.name || "Organisation"}</p>
                        {isCurrent && <Badge variant="secondary">Current</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">Member since {displayDate(membership.created_at)}</p>
                    </div>
                    <Badge variant={membership.role === "admin" ? "default" : "outline"}>{displayRole(membership.role)}</Badge>
                  </div>
                );
              })}

              {!isMasterAdmin && organisationRoles.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No active organisation membership found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage({ masterAdmin = false }: { masterAdmin?: boolean }) {
  if (masterAdmin) {
    return (
      <MasterAdminLayout>
        <ProfileContent />
      </MasterAdminLayout>
    );
  }

  return <ProfileContent />;
}