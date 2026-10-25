import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Vercel/Next Data Cache: shared between serverless instances within a deployment.
// Failed provider responses are cached as values too, preventing request storms.
const LIVE_CACHE_SECONDS = 300;
type LiveResult =
  | { ok: true; data: { response: unknown[]; [key: string]: unknown }; updatedAt: number }
  | { ok: false; message: string; providerStatus: number; updatedAt: number };

const readLiveFromProvider = unstable_cache(
  async (): Promise<LiveResult> => {
    const key = process.env.APIFOOTBALL_KEY;
    if (!key) return { ok: false, message: "API-Football no está configurada", providerStatus: 500, updatedAt: Date.now() };
    try {
      const response = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
        headers: { "x-apisports-key": key },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        return { ok: false, message: "El proveedor deportivo no está disponible o ha limitado las solicitudes", providerStatus: response.status, updatedAt: Date.now() };
      }
      const data = await response.json();
      if (data?.errors && Object.keys(data.errors).length > 0) {
        return { ok: false, message: "API-Football ha comunicado un error o un límite de cuota", providerStatus: 503, updatedAt: Date.now() };
      }
      if (!Array.isArray(data?.response)) {
        return { ok: false, message: "Respuesta inesperada de API-Football", providerStatus: 502, updatedAt: Date.now() };
      }
      return { ok: true, data, updatedAt: Date.now() };
    } catch {
      return { ok: false, message: "No se pudo conectar con API-Football", providerStatus: 503, updatedAt: Date.now() };
    }
  },
  ["irvin-live-fixtures-v2"],
  { revalidate: LIVE_CACHE_SECONDS, tags: ["irvin-live-fixtures"] }
);

const ALLOWED_PLANS = ["beta", "premium", "vip"];

async function getValidToken(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) return null;

  const role = String((token as any).role ?? "").toUpperCase();
  const plan = String((token as any).plan ?? "").toLowerCase();

  if (role === "ADMIN") return token as any;

  if (!ALLOWED_PLANS.includes(plan)) return null;

  const userId = (token as any).id;
  const sessionId = (token as any).sessionId;

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
    new Date(user.expires_at).getTime() < Date.now()
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

  return token as any;
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

  const result = await readLiveFromProvider();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, providerStatus: result.providerStatus, retryAfterSeconds: LIVE_CACHE_SECONDS },
      { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": String(LIVE_CACHE_SECONDS) } }
    );
  }
  return NextResponse.json(
    { ...result.data, cachedAt: result.updatedAt },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
