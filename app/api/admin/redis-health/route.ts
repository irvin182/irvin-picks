import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getApiFootballRedis } from "@/lib/apiFootballRedis";

export async function GET(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (String((token as any)?.role ?? "").toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const redis = getApiFootballRedis();
    const result = await redis.ping();

    return NextResponse.json({
      redis: result === "PONG" ? "connected" : "unexpected_response",
    });
  } catch {
    return NextResponse.json(
      { redis: "unavailable" },
      { status: 503 }
    );
  }
}
