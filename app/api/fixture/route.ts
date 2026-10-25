import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/security";
import { unstable_cache } from "next/cache";

const loadFixture = (fixtureId: string) => unstable_cache(async () => {
  const API_KEY = process.env.APIFOOTBALL_KEY;
  if (!API_KEY) throw new Error("Falta APIFOOTBALL_KEY");
  const [statisticsRes, eventsRes] = await Promise.all([
    fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, { headers: { "x-apisports-key": API_KEY }, cache: "no-store", signal: AbortSignal.timeout(12000) }),
    fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, { headers: { "x-apisports-key": API_KEY }, cache: "no-store", signal: AbortSignal.timeout(12000) }),
  ]);
  if (!statisticsRes.ok || !eventsRes.ok) throw new Error("API-Football no disponible");
  const [statisticsJson, eventsJson] = await Promise.all([statisticsRes.json(), eventsRes.json()]);
  if (Object.keys(statisticsJson?.errors ?? {}).length || Object.keys(eventsJson?.errors ?? {}).length) throw new Error("API-Football ha rechazado la consulta");
  return {
    fixtureId,
    statistics: Array.isArray(statisticsJson?.response) ? statisticsJson.response : [],
    events: Array.isArray(eventsJson?.response) ? eventsJson.response : [],
    rawStatisticsErrors: statisticsJson?.errors ?? null,
    rawEventsErrors: eventsJson?.errors ?? null,
    cached: true,
    cachedAt: Date.now(),
  };
}, ["irvin-fixture-v2", fixtureId], { revalidate: 600 });

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

  try {
    return NextResponse.json(await loadFixture(fixtureId)());
  } catch (error) {
    console.error("Fixture API error:", error);
    return NextResponse.json({ fixtureId, statistics: [], events: [], error: "Error cargando detalles del partido" }, { status: 503, headers: { "Retry-After": "300" } });
  }
}
