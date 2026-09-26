import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, callAdminRpc, getAdminToken } from "@/lib/admin/server";

export async function POST() {
  const token = await getAdminToken();
  if (token) await callAdminRpc("admin_logout", { requested_token: token }).catch(() => null);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  return response;
}
