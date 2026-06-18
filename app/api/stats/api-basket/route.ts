import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE_URL = "https://v1.basketball.api-sports.io/games";
const REQUEST_TIMEOUT_MS = 15000;

export async function GET(req: NextRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const apiKey = process.env.APIBASKET_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta APIBASKET_KEY en .env.local" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const upstreamParams = new URLSearchParams();

    for (const [key, value] of searchParams.entries()) {
      const trimmed = value.trim();
      if (trimmed !== "") {
        upstreamParams.set(key, trimmed);
      }
    }

    if ([...upstreamParams.keys()].length === 0) {
      return NextResponse.json(
        { error: "Debes enviar al menos un parámetro." },
        { status: 400 }
      );
    }

    const upstreamUrl = `${API_BASE_URL}?${upstreamParams.toString()}`;

    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await upstream.text();

    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    const responseCount = Array.isArray(data?.response) ? data.response.length : 0;

    console.log("BASKET API DEBUG", {
      query: Object.fromEntries(upstreamParams.entries()),
      upstreamStatus: upstream.status,
      responseCount,
      firstItem:
        Array.isArray(data?.response) && data.response.length > 0
          ? {
              id: data.response[0]?.id,
              date: data.response[0]?.date,
              leagueId: data.response[0]?.league?.id,
              leagueName: data.response[0]?.league?.name,
              season: data.response[0]?.league?.season,
              homeTeamId: data.response[0]?.teams?.home?.id,
              awayTeamId: data.response[0]?.teams?.away?.id,
              status:
                data.response[0]?.status?.short ||
                data.response[0]?.status?.long,
              homeScore: data.response[0]?.scores?.home?.total,
              awayScore: data.response[0]?.scores?.away?.total,
            }
          : null,
    });

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: "Error desde API-BASKETBALL",
          upstreamStatus: upstream.status,
          upstreamUrl,
          upstreamBody: data,
        },
        { status: upstream.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    const isAbort =
      error instanceof Error && error.name === "AbortError";

    return NextResponse.json(
      {
        error: isAbort
          ? "Timeout consultando API-BASKETBALL"
          : "Error interno en route basket",
        message:
          error instanceof Error ? error.message : "unknown error",
      },
      { status: isAbort ? 504 : 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}