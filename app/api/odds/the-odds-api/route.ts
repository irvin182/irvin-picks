// app/api/stats/api-football/status/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.APIFOOTBALL_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "Falta APIFOOTBALL_KEY" },
      { status: 500 }
    );
  }

  const url = "https://v3.football.api-sports.io/status";
  console.log("[STATUS] Llamando a:", url);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-apisports-key": key,
    },
    cache: "no-store",
  });

  const raw = await res.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }

  return NextResponse.json(
    { status: res.status, data },
    { status: res.ok ? 200 : 500 }
  );
}
