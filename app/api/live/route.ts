import { apiFootballFetch } from "@/lib/apiFootballFetch";
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Only validated data enters the cache. A failed refresh cannot replace good data with an error.
const LIVE_CACHE_SECONDS = 300;
const readLiveFromProvider = unstable_cache(
  async () => {
    const response = await apiFootballFetch("https://v3.football.api-sports.io/fixtures?live=all", {
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    return { data, updatedAt: Date.now() };
  },
  ["irvin-live-fixtures-v3"],
  { revalidate: LIVE_CACHE_SECONDS, tags: ["irvin-live-fixtures"] }
);

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
    const result = await readLiveFromProvider();
    return NextResponse.json(
      { ...result.data, cachedAt: result.updatedAt },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "API-Football no disponible", retryAfterSeconds: LIVE_CACHE_SECONDS },
      { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": String(LIVE_CACHE_SECONDS) } }
    );
  }
}
