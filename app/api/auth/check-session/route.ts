import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { saveLogin } from "@/lib/loginLogger";

export async function GET(req: NextRequest) {
  console.log("🔥 CHECK-SESSION EJECUTADO");

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    console.log("❌ CHECK-SESSION SIN TOKEN");

    return NextResponse.json({ valid: false }, { status: 401 });
  }

  if ((token as any).role === "ADMIN") {
    console.log("🟢 CHECK-SESSION ADMIN OK");

    return NextResponse.json({ valid: true });
  }

  const userId = (token as any).id;
  const sessionId = (token as any).sessionId;

  console.log("🟢 CHECK-SESSION TOKEN:", {
    userId,
    sessionId,
  });

  const { data: user, error } = await supabaseAdmin
    .from("app_users")
    .select("active,blocked,expires_at,active_session_id,email")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) {
    console.error("❌ CHECK-SESSION USER ERROR:", error);

    return NextResponse.json({ valid: false }, { status: 401 });
  }

  if (user.active === false || user.blocked === true) {
    console.log("❌ CHECK-SESSION USUARIO BLOQUEADO:", user.email);

    return NextResponse.json({ valid: false }, { status: 401 });
  }

  if (user.expires_at && new Date(user.expires_at).getTime() < Date.now()) {
    console.log("❌ CHECK-SESSION EXPIRADO:", user.email);

    return NextResponse.json(
      { valid: false, reason: "expired" },
      { status: 401 }
    );
  }

  if (user.active_session_id !== sessionId) {
    console.log("❌ CHECK-SESSION REEMPLAZADA:", {
      email: user.email,
      dbSession: user.active_session_id,
      tokenSession: sessionId,
    });

    return NextResponse.json(
      { valid: false, reason: "session_replaced" },
      { status: 401 }
    );
  }

  console.log("🔥 ANTES DE SAVELOGIN:", user.email);

const shouldLog = Math.random() < 0.05;

if (shouldLog) {
  await saveLogin(req, {
    id: userId,
    email: user.email,
    role: "USER",
  });
}

  console.log("🔥 DESPUÉS DE SAVELOGIN:", user.email);

  await supabaseAdmin
    .from("app_users")
    .update({
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", userId);

  console.log("✅ CHECK-SESSION FINAL OK:", user.email);

  return NextResponse.json({ valid: true });
}