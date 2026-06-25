import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/security";

type CacheValue = {
  data: any;
  cachedAt: number;
};

const CACHE_TIME = 60000;
const cache = new Map<string, CacheValue>();
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

  return token;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limited = rateLimit(`fixture:${ip}`, 120, 60_000);

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

  const API_KEY = process.env.APIFOOTBALL_KEY;

  if (!API_KEY) {
    return NextResponse.json(
      { error: "Falta APIFOOTBALL_KEY" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const fixtureId = searchParams.get("id");

  if (!fixtureId || !/^\d+$/.test(fixtureId)) {
    return NextResponse.json(
      { error: "Fixture id inválido" },
      { status: 400 }
    );
  }

  const now = Date.now();
  const cached = cache.get(fixtureId);

  if (cached && now - cached.cachedAt < CACHE_TIME) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
      cachedAt: cached.cachedAt,
    });
  }

  try {
    const [statisticsRes, eventsRes] = await Promise.all([
      fetch(
        `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`,
        {
          headers: {
            "x-apisports-key": API_KEY,
          },
          cache: "no-store",
        }
      ),
      fetch(
        `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`,
        {
          headers: {
            "x-apisports-key": API_KEY,
          },
          cache: "no-store",
        }
      ),
    ]);

    if (!statisticsRes.ok || !eventsRes.ok) {
      throw new Error(
        `API-Football error statistics=${statisticsRes.status} events=${eventsRes.status}`
      );
    }

    const statisticsJson = await statisticsRes.json();
    const eventsJson = await eventsRes.json();

    const payload = {
      fixtureId,
      statistics: Array.isArray(statisticsJson?.response)
        ? statisticsJson.response
        : [],
      events: Array.isArray(eventsJson?.response) ? eventsJson.response : [],
      rawStatisticsErrors: statisticsJson?.errors ?? null,
      rawEventsErrors: eventsJson?.errors ?? null,
      cached: false,
      cachedAt: now,
    };

    cache.set(fixtureId, {
      data: payload,
      cachedAt: now,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Fixture API error:", error);

    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        warning: "API failed, showing cached fixture data",
      });
    }

    return NextResponse.json(
      {
        fixtureId,
        statistics: [],
        events: [],
        error: "Error cargando detalles del partido",
      },
      { status: 200 }
    );
  }
}