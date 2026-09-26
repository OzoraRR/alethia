"use client";

import { createClient } from "@/lib/supabase/client";

export type ProfileBadgeSelection = {
  code: string;
  selected: boolean;
};

export async function changeUsername(username: string): Promise<{ username: string | null; error: string | null }> {
  const client = createClient();
  if (!client) return { username: null, error: "Database profil belum dikonfigurasi." };
  const result = await client.rpc("change_username", { requested_username: username });
  if (result.error) return { username: null, error: mapUsernameError(result.error.message) };
  const value = Array.isArray(result.data) ? result.data[0] : result.data;
  return { username: typeof value === "string" ? value : username, error: null };
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ error: string | null }> {
  const client = createClient();
  if (!client) return { error: "Database profil belum dikonfigurasi." };
  if (newPassword.length < 8) return { error: "Password baru minimal 8 karakter." };
  const result = await client.auth.changePassword({ currentPassword, newPassword });
  return { error: result.error ? "Password saat ini salah atau tidak dapat diubah." : null };
}

export async function loadProfileBadgeSelections(): Promise<ProfileBadgeSelection[]> {
  const client = createClient();
  if (!client) return [];
  const result = await client.from("user_profile_badges").select("badge_code, selected");
  if (result.error) return [];
  return ((result.data ?? []) as Array<{ badge_code?: unknown; selected?: unknown }>)
    .map((row) => ({ code: typeof row.badge_code === "string" ? row.badge_code : null, selected: row.selected === true }))
    .filter((row): row is ProfileBadgeSelection => row.code !== null);
}

export async function setProfileBadge(code: string, selected: boolean): Promise<boolean> {
  const client = createClient();
  if (!client) return false;
  const result = await client.rpc("set_profile_badge", {
    requested_badge_code: code,
    requested_selected: selected,
  });
  return !result.error && result.data === true;
}

function mapUsernameError(message: string): string {
  const value = message.toLowerCase();
  if (value.includes("username_taken") || value.includes("23505")) return "Username sudah dipakai user lain.";
  if (value.includes("invalid_username") || value.includes("22023")) return "Username harus 3–24 karakter: huruf, angka, atau underscore.";
  return "Username tidak dapat diubah.";
}
