import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

type RouteParams = { params: Promise<{ endpoint?: string[] }> };
type ProviderResult = { status: number; data: unknown; failed: boolean };

const load = (url: string) => unstable_cache(
  async (): Promise<ProviderResult> => {
    const key = process.env.APIFOOTBALL_KEY;
    if (!key) return { status: 500, data: { error: "Falta APIFOOTBALL_KEY en el servidor" }, failed: true };
    try {
      const res = await fetch(url, { headers: { "x-apisports-key": key }, cache: "no-store", signal: AbortSignal.timeout(12000) });
      const data: unknown = await res.json();
      const errors = (data && typeof data === "object" && "errors" in data) ? (data as {errors?: unknown}).errors : null;
      const failed = !res.ok || Boolean(errors && typeof errors === "object" && Object.keys(errors).length);
      return { status: failed ? 503 : 200, data: failed ? { error: "API-Football no disponible", upstreamStatus: res.status } : data, failed };
    } catch {
      return { status: 503, data: { error: "API-Football no disponible" }, failed: true };
    }
  },
  ["irvin-stats-v2", url],
  { revalidate: 3600 }
);

export async function GET(req: Request, route: RouteParams) {
  const { endpoint } = await route.params;
  const path = endpoint?.join("/") || "status";
  if (!/^[a-zA-Z0-9/_-]+$/.test(path) || path.includes("..")) {
    return NextResponse.json({ error: "Endpoint inválido" }, { status: 400 });
  }
  const params = new URL(req.url).searchParams;
  params.sort();
  const url = `https://v3.football.api-sports.io/${path}${params.size ? `?${params.toString()}` : ""}`;
  const result = await load(url)();
  return NextResponse.json(result.data, { status: result.status, headers: result.failed ? { "Retry-After": "300" } : {} });
}
