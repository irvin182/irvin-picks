import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  if ((token as any).role === "ADMIN") {
    return NextResponse.json({ valid: true });
  }

  const userId = (token as any).id;
  const sessionId = (token as any).sessionId;

  const { data: user, error } = await supabaseAdmin
    .from("app_users")
    .select("active,blocked,expires_at,active_session_id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  if (user.active === false || user.blocked === true) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  if (user.expires_at && new Date(user.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ valid: false, reason: "expired" }, { status: 401 });
  }

  if (user.active_session_id !== sessionId) {
    return NextResponse.json({ valid: false, reason: "session_replaced" }, { status: 401 });
  }

  await supabaseAdmin
    .from("app_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);

  return NextResponse.json({ valid: true });
}
