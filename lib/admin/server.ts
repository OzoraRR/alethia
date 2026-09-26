import { cookies } from "next/headers";

export const ADMIN_COOKIE = "alethia_admin_session";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

export type AdminSession = { username: string; expiresAt: string };

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.ADMIN_COOKIE_SECURE === "true",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  };
}

export async function getAdminToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value ?? null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = await getAdminToken();
  if (!token) return null;
  const rows = await callAdminRpc<Array<{ username: string; expires_at: string }>>("admin_session_info", {
    requested_token: token,
  });
  const row = rows?.[0];
  return row ? { username: row.username, expiresAt: row.expires_at } : null;
}

export async function callAdminRpc<T = unknown>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase admin environment is not configured.");
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload ? payload.message : "Admin operation failed.";
    throw new Error(message);
  }
  return payload as T;
}
