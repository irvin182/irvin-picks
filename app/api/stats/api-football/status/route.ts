import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getApiFootballBudget } from "@/lib/apiFootballBudget";

export const dynamic = "force-dynamic";

// Admin-only local metadata. Polling this route never calls the provider.
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const expiry = token?.expires_at ? Date.parse(String(token.expires_at)) : null;
  if (!token || String(token.role ?? "").toUpperCase() !== "ADMIN" ||
      token.blocked === true || token.active === false ||
      (expiry !== null && (!Number.isFinite(expiry) || expiry < Date.now()))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getApiFootballBudget(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Contador no disponible" }, { status: 503 });
  }
}
