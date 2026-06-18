import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/security";
import { supabase } from "@/lib/supabase";

let cachedData: any = null;
let cachedAt = 0;

const CACHE_TIME = 30000;

async function getValidToken(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) return null;
  if ((token as any).blocked) return null;

  return token as any;
}

async function updateLastSeen(token: any) {
  if (!token?.id || token.id === "admin") return;

  await supabase
    .from("app_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", token.id);
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

  updateLastSeen(token);

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