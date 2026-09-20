"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const avatarBucket = "avatars";
const maxAvatarBytes = 2 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export type AvatarError = "no_session" | "invalid_file" | "upload_failed" | null;
type AvatarResult = { avatarUrl: string | null; error: AvatarError };

export async function loadAvatar(): Promise<AvatarResult> {
  const client = createClient();
  if (!client) return { avatarUrl: null, error: "no_session" };

  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return { avatarUrl: null, error: "no_session" };

  const { data: profile } = await client.from("profiles").select("avatar_path").eq("id", userData.user.id).maybeSingle();
  if (!profile?.avatar_path) return { avatarUrl: null, error: null };

  const { data, error } = await client.storage.from(avatarBucket).createSignedUrl(profile.avatar_path, 60 * 60);
  return { avatarUrl: error || !data ? null : data.signedUrl, error: error ? "upload_failed" : null };
}

export async function uploadAvatar(file: File): Promise<AvatarResult> {
  const extension = allowedTypes.get(file.type);
  if (!extension || file.size > maxAvatarBytes) return { avatarUrl: null, error: "invalid_file" };

  const client = createClient();
  if (!client) return { avatarUrl: null, error: "no_session" };

  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return { avatarUrl: null, error: "no_session" };

  const { data: existing } = await client.from("profiles").select("avatar_path").eq("id", userData.user.id).maybeSingle();
  const path = `${userData.user.id}/avatar.${extension}`;
  const { error: uploadError } = await client.storage.from(avatarBucket).upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { avatarUrl: null, error: "upload_failed" };

  const { error: profileError } = await client.from("profiles").upsert({ id: userData.user.id, avatar_path: path }, { onConflict: "id" });
  if (profileError) {
    if (existing?.avatar_path !== path) await client.storage.from(avatarBucket).remove([path]);
    return { avatarUrl: null, error: "upload_failed" };
  }

  if (existing?.avatar_path && existing.avatar_path !== path) await client.storage.from(avatarBucket).remove([existing.avatar_path]);
  const { data: signed, error: signError } = await client.storage.from(avatarBucket).createSignedUrl(path, 60 * 60);
  return { avatarUrl: signError || !signed ? null : signed.signedUrl, error: signError ? "upload_failed" : null };
}

export function useProfileAvatar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<AvatarError>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    const result = await loadAvatar();
    setAvatarUrl(result.avatarUrl);
    setError(result.error);
    return result;
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback(async (file: File) => {
    setIsSaving(true);
    const result = await uploadAvatar(file);
    setAvatarUrl(result.avatarUrl);
    setError(result.error);
    setIsSaving(false);
    return result;
  }, []);

  return { avatarUrl, error, isSaving, refresh, save };
}
