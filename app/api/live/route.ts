import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

let cachedData: any = null;
let cachedAt = 0;

const CACHE_TIME = 120000;
let pendingFetch: Promise<any> | null = null;
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

  const now = Date.now();

  if (cachedData && now - cachedAt < CACHE_TIME) {
    return NextResponse.json({
      ...cachedData,
      cached: true,
      cachedAt,
    });
  }

  const API_KEY = process.env.APIFOOTBALL_KEY;

  if (!API_KEY) {
    return NextResponse.json(
      { error: "Falta APIFOOTBALL_KEY" },
      { status: 500 }
    );
  }

  try {
    // Coalesce simultaneous requests within one server instance.
    if (!pendingFetch) {
      pendingFetch = (async () => {
        const res = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
          headers: { "x-apisports-key": API_KEY },
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          const error = new Error(`Proveedor deportivo HTTP ${res.status}`);
          (error as Error & { status?: number }).status = res.status;
          throw error;
        }
        const data = await res.json();
        if (data?.errors && Object.keys(data.errors).length > 0) {
          const error = new Error("API-Football ha devuelto un error de servicio o cuota");
          (error as Error & { status?: number }).status = 503;
          throw error;
        }
        if (!Array.isArray(data?.response)) {
          throw new Error("Respuesta del proveedor sin lista de partidos");
        }
        cachedData = data;
        cachedAt = Date.now();
        return data;
      })().finally(() => { pendingFetch = null; });
    }
    const data = await pendingFetch;
    return NextResponse.json({ ...data, cached: false, cachedAt });
  } catch (error) {
    console.error("Live API error:", error);
    if (cachedData) {
      return NextResponse.json({
        ...cachedData,
        cached: true,
        cachedAt,
        warning: "No se pudo actualizar; mostrando la última información disponible",
      });
    }
    const status = (error as Error & { status?: number })?.status;
    return NextResponse.json(
      { error: status === 429 ? "Límite de consultas del proveedor deportivo" : "No se pudieron cargar los partidos del proveedor deportivo" },
      { status: status === 429 ? 429 : 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
