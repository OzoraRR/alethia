"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeGetItem, safeSetItem, STORAGE_KEYS } from "@/lib/storage/safe-storage";

const avatarBucket = "avatars";
const maxAvatarBytes = 2 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export type AvatarError = "no_session" | "invalid_file" | "upload_failed" | null;
type AvatarResult = { avatarUrl: string | null; error: AvatarError };

type StoredLocalAvatar = {
  dataUrl: string;
  updatedAt: string;
};

function isStoredLocalAvatar(val: unknown): val is StoredLocalAvatar {
  return typeof val === "object" && val !== null && typeof (val as StoredLocalAvatar).dataUrl === "string";
}

export async function loadAvatar(): Promise<AvatarResult> {
  const localAvatar = safeGetItem<StoredLocalAvatar | null>(
    STORAGE_KEYS.AVATAR,
    null,
    isStoredLocalAvatar,
  );

  try {
    const client = createClient();
    if (!client) {
      return { avatarUrl: localAvatar?.dataUrl ?? null, error: null };
    }

    const { data: userData } = await client.auth.getUser();
    if (!userData.user) {
      return { avatarUrl: localAvatar?.dataUrl ?? null, error: null };
    }

    const { data: profile } = await client
      .from("profiles")
      .select("avatar_path")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.avatar_path) {
      return { avatarUrl: localAvatar?.dataUrl ?? null, error: null };
    }

    const { data, error } = await client.storage
      .from(avatarBucket)
      .createSignedUrl(profile.avatar_path, 60 * 60);

    if (error || !data) {
      return { avatarUrl: localAvatar?.dataUrl ?? null, error: null };
    }

    return { avatarUrl: data.signedUrl, error: null };
  } catch {
    return { avatarUrl: localAvatar?.dataUrl ?? null, error: null };
  }
}

async function fileToDataUrl(file: File): Promise<string | null> {
  try {
    if (typeof FileReader !== "undefined") {
      return new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${file.type};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function uploadAvatar(file: File): Promise<AvatarResult> {
  const extension = allowedTypes.get(file.type);
  if (!extension || file.size > maxAvatarBytes) {
    return { avatarUrl: null, error: "invalid_file" };
  }

  const dataUrl = await fileToDataUrl(file);

  try {
    const client = createClient();
    if (!client) {
      if (dataUrl) {
        safeSetItem(STORAGE_KEYS.AVATAR, { dataUrl, updatedAt: new Date().toISOString() });
        return { avatarUrl: dataUrl, error: null };
      }
      return { avatarUrl: null, error: "upload_failed" };
    }

    const { data: userData } = await client.auth.getUser();
    if (!userData.user) {
      if (dataUrl) {
        safeSetItem(STORAGE_KEYS.AVATAR, { dataUrl, updatedAt: new Date().toISOString() });
        return { avatarUrl: dataUrl, error: null };
      }
      return { avatarUrl: null, error: "no_session" };
    }

    const { data: existing } = await client
      .from("profiles")
      .select("avatar_path")
      .eq("id", userData.user.id)
      .maybeSingle();

    const path = `${userData.user.id}/avatar.${extension}`;
    const { error: uploadError } = await client.storage
      .from(avatarBucket)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      if (dataUrl) {
        safeSetItem(STORAGE_KEYS.AVATAR, { dataUrl, updatedAt: new Date().toISOString() });
        return { avatarUrl: dataUrl, error: null };
      }
      return { avatarUrl: null, error: "upload_failed" };
    }

    const { error: profileError } = await client
      .from("profiles")
      .upsert({ id: userData.user.id, avatar_path: path }, { onConflict: "id" });

    if (profileError) {
      if (existing?.avatar_path !== path) {
        await client.storage.from(avatarBucket).remove([path]);
      }
      if (dataUrl) {
        safeSetItem(STORAGE_KEYS.AVATAR, { dataUrl, updatedAt: new Date().toISOString() });
        return { avatarUrl: dataUrl, error: null };
      }
      return { avatarUrl: null, error: "upload_failed" };
    }

    if (existing?.avatar_path && existing.avatar_path !== path) {
      await client.storage.from(avatarBucket).remove([existing.avatar_path]);
    }

    const { data: signed, error: signError } = await client.storage
      .from(avatarBucket)
      .createSignedUrl(path, 60 * 60);

    const remoteUrl = signError || !signed ? null : signed.signedUrl;
    if (dataUrl) {
      safeSetItem(STORAGE_KEYS.AVATAR, { dataUrl, updatedAt: new Date().toISOString() });
    }

    return { avatarUrl: remoteUrl ?? dataUrl, error: null };
  } catch {
    if (dataUrl) {
      safeSetItem(STORAGE_KEYS.AVATAR, { dataUrl, updatedAt: new Date().toISOString() });
      return { avatarUrl: dataUrl, error: null };
    }
    return { avatarUrl: null, error: "upload_failed" };
  }
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
