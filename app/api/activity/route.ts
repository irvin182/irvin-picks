import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectBrowser } from "@/lib/browserParser";
import { detectOS, detectDevice } from "@/lib/deviceParser";

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");

  return (
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "Desconocida"
  );
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.email) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const path = String(body?.path ?? "").trim();

    if (!path) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || "Desconocido";

    const browser = detectBrowser(userAgent);
    const os = detectOS(userAgent);
    const device = detectDevice(userAgent);
    const ip = getClientIp(req);

    await supabaseAdmin.from("page_views").insert({
      user_id: String((token as any).id ?? ""),
      email: String(token.email ?? ""),
      role: String((token as any).role ?? ""),
      path,
      ip,
      user_agent: userAgent,
      browser,
      os,
      device,
    });

    if ((token as any).role === "USER" && (token as any).id) {
      await supabaseAdmin
        .from("app_users")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", String((token as any).id));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error guardando actividad:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}