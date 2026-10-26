import { readLiveFixtures, LIVE_POLL_SECONDS } from "@/lib/liveFixturesCache";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_PLANS = ["beta", "premium", "vip"];

async function getValidToken(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token || token.blocked === true || token.active === false) return null;
  const expiry = token.expires_at ? Date.parse(String(token.expires_at)) : null;
  if (expiry !== null && (!Number.isFinite(expiry) || expiry < Date.now())) return null;

  const role = String(token.role ?? "").toUpperCase();
  const plan = String(token.plan ?? "").toLowerCase();

  if (role === "ADMIN") return token;

  if (!ALLOWED_PLANS.includes(plan)) return null;

  const userId = token.id;
  const sessionId = token.sessionId;

  if (!userId || !sessionId) return null;

  const { data: user, error } = await supabaseAdmin
    .from("app_users")
    .select("active,blocked,expires_at,active_session_id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) return null;

  if (user.active === false || user.blocked === true) return null;

  if (
    user.expires_at &&
    (!Number.isFinite(Date.parse(user.expires_at)) || Date.parse(user.expires_at) < Date.now())
  ) {
    return null;
  }

  if (user.active_session_id !== sessionId) {
    return null;
  }

  await supabaseAdmin
    .from("app_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("active_session_id", sessionId);

  return token;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limited = rateLimit(`live:${ip}`, 60, 60_000);

  if (!limited.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Intenta de nuevo en un momento." },
      { status: 429 }
    );
  }

  const token = await getValidToken(req);

  if (!token) {
    return NextResponse.json(
      { error: "Sesión inválida o reemplazada" },
      { status: 401 }
    );
  }

  try {
    const result = await readLiveFixtures();
    return NextResponse.json(
      { ...result.data, cachedAt: result.updatedAt, stale: result.stale },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "API-Football no disponible", retryAfterSeconds: LIVE_POLL_SECONDS },
      { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": String(LIVE_POLL_SECONDS) } }
    );
  }
}
