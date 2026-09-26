import { NextRequest, NextResponse } from "next/server";
import { callAdminRpc, getAdminSession, getAdminToken } from "@/lib/admin/server";

export async function POST(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { kind?: unknown; payload?: Record<string, unknown> } | null;
  const adminToken = await getAdminToken();
  if (!adminToken) return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  try {
    if (body?.kind === "report") await callAdminRpc("admin_update_report", { ...body.payload, requested_token: adminToken });
    else if (body?.kind === "module") await callAdminRpc("admin_upsert_module", { ...body.payload, requested_token: adminToken });
    else if (body?.kind === "quest") await callAdminRpc("admin_upsert_quest", { ...body.payload, requested_token: adminToken });
    else return NextResponse.json({ error: "Unknown admin action." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin action failed." }, { status: 400 });
  }
}
