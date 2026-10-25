import { apiFootballFetch } from "@/lib/apiFootballFetch";
import { validApiFootballQuery } from "@/lib/apiFootballQuery";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getToken } from "next-auth/jwt";
import { rateLimit, getClientIp } from "@/lib/security";
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

type RouteParams = { params: Promise<{ endpoint?: string[] }> };

const load = (url: string) => unstable_cache(
  async (): Promise<unknown> => {
    const res = await apiFootballFetch(url, { signal: AbortSignal.timeout(12000) });
    // Only successful provider payloads are cached. Errors throw and remain retryable after reset.
    return res.json();
  },
  ["irvin-stats-v3", url],
  { revalidate: 3600 }
);

export async function GET(req: NextRequest, route: RouteParams) {
  const { endpoint } = await route.params;
  const path = endpoint?.join("/") || "status";
  if (!/^[a-zA-Z0-9/_-]+$/.test(path) || path.includes("..")) {
    return NextResponse.json({ error: "Endpoint inválido" }, { status: 400 });
  }
  const params = new URL(req.url).searchParams;
  if (!validApiFootballQuery(path, params)) {
    return NextResponse.json({ error: "Consulta inválida" }, { status: 400 });
  }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = String(token?.role ?? "").toUpperCase();
  const plan = String(token?.plan ?? "").toLowerCase();
  const expiry = token?.expires_at ? new Date(String(token.expires_at)).getTime() : null;
  if (!token || token.blocked === true || token.active === false ||
      (expiry !== null && (!Number.isFinite(expiry) || expiry < Date.now())) ||
      (role !== "ADMIN" && !["beta", "premium", "vip"].includes(plan))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (role !== "ADMIN") {
    if (!token.id || !token.sessionId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    const { data: user, error } = await supabaseAdmin.from("app_users")
      .select("active,blocked,expires_at,active_session_id").eq("id", token.id).maybeSingle();
    if (error || !user || user.active === false || user.blocked === true ||
        user.active_session_id !== token.sessionId ||
        (user.expires_at && (!Number.isFinite(Date.parse(user.expires_at)) || Date.parse(user.expires_at) < Date.now()))) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }
  }
  if (!rateLimit(`stats:${getClientIp(req)}`, 120, 60000).ok) {
    return NextResponse.json({ error: "Demasiadas consultas" }, { status: 429 });
  }
  params.sort();
  const url = `https://v3.football.api-sports.io/${path}${params.size ? `?${params.toString()}` : ""}`;
  try {
    return NextResponse.json(await load(url)());
  } catch {
    return NextResponse.json({ error: "API-Football no disponible" }, { status: 503, headers: { "Retry-After": "300", "Cache-Control": "private, no-store" } });
  }
}
