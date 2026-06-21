import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const API_KEY = process.env.APIFOOTBALL_KEY;

    if (!API_KEY) {
      return NextResponse.json({ error: "Falta APIFOOTBALL_KEY" }, { status: 500 });
    }

    const res = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
      headers: {
        "x-apisports-key": API_KEY,
      },
      cache: "no-store",
    });

    const data = await res.json();

    return NextResponse.json({
      response: data.response ?? [],
      results: data.results ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Error cargando demo en vivo" },
      { status: 500 }
    );
  }
}