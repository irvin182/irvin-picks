import { apiFootballFetch } from "@/lib/apiFootballFetch";
import { rateLimit, getClientIp } from "@/lib/security";
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

const loadDemo = unstable_cache(async () => {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) throw new Error("Falta APIFOOTBALL_KEY");
  const res = await apiFootballFetch("https://v3.football.api-sports.io/fixtures?live=all", {
    headers: { "x-apisports-key": key }, cache: "no-store", signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error("API-Football no disponible");
  const data = await res.json();
  if (Object.keys(data?.errors ?? {}).length || !Array.isArray(data?.response)) throw new Error("API-Football ha rechazado la consulta");
  return { response: data.response, results: data.results ?? data.response.length };
}, ["irvin-demo-live-v2"], { revalidate: 300 });

export async function GET(req: NextRequest) {
  if (!rateLimit(`demo-live:${getClientIp(req)}`, 12, 60000).ok) {
    return NextResponse.json({ error: "Demasiadas consultas" }, { status: 429 });
  }
  try {
    return NextResponse.json(await loadDemo());
  } catch {
    return NextResponse.json({ error: "Error cargando demo en vivo" }, { status: 503, headers: { "Retry-After": "300" } });
  }
}
