import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

let cachedData: any = null;
let cachedAt = 0;

const CACHE_TIME = 30000;
const ALLOWED_PLANS = ["beta", "premium", "vip"];

async function getValidToken(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) return null;

  const role = String((token as any).role ?? "").toUpperCase();
  const plan = String((token as any).plan ?? "").toLowerCase();
  const blocked = (token as any).blocked === true;
  const active = (token as any).active !== false;
  const expiresAt = (token as any).expires_at ?? null;

  if (blocked || !active) return null;

  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return null;
  }

  if (role !== "ADMIN" && !ALLOWED_PLANS.includes(plan)) {
    return null;
  }

  return token as any;
}

async function updateLastSeen(token: any) {
  if (!token?.id || token.id === "admin") return;

  const sessionId = token.sessionId;

  await supabaseAdmin
    .from("app_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", token.id)
    .eq("active_session_id", sessionId);
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
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await updateLastSeen(token);

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
    const res = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers: {
          "x-apisports-key": API_KEY,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error(`API-Football HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data?.errors && Object.keys(data.errors).length > 0) {
      return NextResponse.json({
        ...data,
        cached: false,
        warning: "API-Football devolvió error",
      });
    }

    cachedData = data;
    cachedAt = now;

    return NextResponse.json({
      ...data,
      cached: false,
      cachedAt,
    });
  } catch (error) {
    console.error("Live API error:", error);

    if (cachedData) {
      return NextResponse.json({
        ...cachedData,
        cached: true,
        warning: "API failed, showing cached data",
      });
    }

    return NextResponse.json(
      { error: "Error cargando partidos live" },
      { status: 500 }
    );
  }
}