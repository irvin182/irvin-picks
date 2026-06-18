import { NextRequest, NextResponse } from "next/server";

type CacheValue = {
  data: any;
  cachedAt: number;
};

const CACHE_TIME = 60000;
const cache = new Map<string, CacheValue>();

export async function GET(req: NextRequest) {
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