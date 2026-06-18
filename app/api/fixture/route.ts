import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/security";

type CacheValue = {
  data: any;
  cachedAt: number;
};

const CACHE_TIME = 60000;
const cache = new Map<string, CacheValue>();

async function isAllowed(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) return false;
  if ((token as any).blocked) return false;

  return true;
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
  if (!(await isAllowed(req))) {
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

    const statistics = await statisticsRes.json();
    const events = await eventsRes.json();

    const payload = {
      fixtureId,
      statistics: statistics.response ?? [],
      events: events.response ?? [],
      cached: false,
      cachedAt: now,
    };

    cache.set(fixtureId, {
      data: payload,
      cachedAt: now,
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        warning: "API failed, showing cached fixture data",
      });
    }

    return NextResponse.json(
      { error: "Error cargando detalles del partido" },
      { status: 500 }
    );
  }
}