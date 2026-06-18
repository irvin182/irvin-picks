// app/api/stats/api-football/[...endpoint]/route.ts
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{
    endpoint?: string[];
  }>;
};

export async function GET(req: Request, route: RouteParams) {
  // ⬇️ NECESARIO EN NEXT 15/16: params es un Promise
  const { endpoint } = await route.params;

  const key = process.env.APIFOOTBALL_KEY;

  if (!key) {
    console.error("APIFOOTBALL_KEY falta o está vacía");
    return NextResponse.json(
      { error: "Falta APIFOOTBALL_KEY en el servidor" },
      { status: 500 }
    );
  }

  // Qué endpoint de la API queremos: fixtures, leagues, status, etc.
  const endpointPath = endpoint?.join("/") || "status";

  // Copiamos la query string original (?live=all, etc.)
  const urlFromReq = new URL(req.url);
  const qs = urlFromReq.searchParams.toString();

  const url = `https://v3.football.api-sports.io/${endpointPath}${
    qs ? `?${qs}` : ""
  }`;

  console.log("[API-FOOTBALL PROXY] →", url);

  try {
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

    if (!res.ok) {
      console.error("Error desde API-Football:", res.status, data);
      return NextResponse.json(
        {
          error: "Error desde API-Football",
          upstreamStatus: res.status,
          upstreamBody: data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    console.error("ERROR FETCH API-FOOTBALL:", e);
    return NextResponse.json(
      {
        error: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
