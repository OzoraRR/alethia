import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, adminCookieOptions, callAdminRpc } from "@/lib/admin/server";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  if (typeof body?.username !== "string" || typeof body?.password !== "string") {
    return NextResponse.json({ error: "Username dan password wajib diisi." }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  try {
    const rows = await callAdminRpc<Array<{ token: string }>>("admin_login", {
      requested_username: body.username,
      requested_password: body.password,
      request_ip: ip,
    });
    const token = rows?.[0]?.token;
    if (!token) return NextResponse.json({ error: "Login admin gagal." }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, token, { ...adminCookieOptions(), maxAge: ADMIN_SESSION_SECONDS });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login admin gagal." }, { status: 401 });
  }
}
