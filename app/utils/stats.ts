  // app/utils/stats.ts

  export type LambdaResult = {
    lambdaHome: number;
    lambdaAway: number;
    meta: {
      leagueId?: number;
      season?: number;
      homeId?: number;
      awayId?: number;
      source?: string;
    };
  };

  /** Helper HTTP al proxy local con retry suave */
  export async function apiGet(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
    retries = 2
  ) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      search.set(k, String(v));
    }
    const qs = search.toString();
    const url = `/api/stats/api-football/${endpoint}${qs ? `?${qs}` : ""}`;

    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text();
         console.warn(`API error ${res.status}: ${text}`);

return {
  response: [],
  results: 0,
  error: text,
};
        }
        return res.json();
      } catch (e) {
        lastErr = e;
        // backoff pequeñito
        await new Promise(r => setTimeout(r, 250 * (i + 1)));
      }
    }
    throw lastErr;
  }

  /* ---------------- Helpers ---------------- */

  const clamp = (x: number, min = 0.2, max = 4) =>
    Math.min(max, Math.max(min, x));

  function lambdaFromTeamStats(
    stat: any,
    side: "home" | "away"
  ): number | undefined {
    const gfor = stat?.response?.goals?.for;

    const avgSide =
      Number(gfor?.average?.[side]) ||
      Number(gfor?.total?.average?.[side]) ||
      undefined;

    const avgAll =
      Number(gfor?.average?.total) ||
      Number(gfor?.total?.average?.total) ||
      undefined;

    const raw = avgSide ?? avgAll;
    if (!raw || !isFinite(raw)) return undefined;

    return clamp(raw);
  }

  function avgGoalsFromFixtures(
    fixtures: any[],
    teamId: number
  ): number | undefined {
    if (!fixtures?.length) return undefined;

    let goals = 0;
    let count = 0;

    for (const fx of fixtures) {
      const hId = fx?.teams?.home?.id;
      const aId = fx?.teams?.away?.id;
      if (hId !== teamId && aId !== teamId) continue;

      const gFor =
        hId === teamId ? fx?.goals?.home ?? 0 : fx?.goals?.away ?? 0;

      goals += gFor;
      count++;
    }

    if (!count) return undefined;
    return clamp(goals / count);
  }

  /* =========== 1) Stats por equipo =========== */

  async function lambdasFromTeamStats(
    leagueId: number,
    season: number,
    homeId: number,
    awayId: number
  ) {
    const [statH, statA] = await Promise.all([
      apiGet("teams/statistics", { league: leagueId, season, team: homeId }),
      apiGet("teams/statistics", { league: leagueId, season, team: awayId }),
    ]);

    return {
      lambdaHome: lambdaFromTeamStats(statH, "home"),
      lambdaAway: lambdaFromTeamStats(statA, "away"),
    };
  }

  /* =========== 2) Últimos partidos =========== */

  async function lambdasFromRecentFixtures(homeId: number, awayId: number) {
    const [fH, fA] = await Promise.all([
      apiGet("fixtures", { team: homeId, last: 10 }),
      apiGet("fixtures", { team: awayId, last: 10 }),
    ]);

    return {
      lambdaHome: avgGoalsFromFixtures(fH?.response ?? [], homeId),
      lambdaAway: avgGoalsFromFixtures(fA?.response ?? [], awayId),
    };
  }

  /* =========== 3) Promedio de liga =========== */

  async function lambdasFromLeagueAverage(leagueId: number, season?: number) {
    const params: Record<string, string | number> = { league: leagueId };
    if (season) params.season = season;

const data = await apiGet("leagues", params);
    const list: any[] = data?.response ?? [];
    if (!list.length) return {};

    let goals = 0;
    let matches = 0;

    for (const fx of list) {
      goals += (fx?.goals?.home ?? 0) + (fx?.goals?.away ?? 0);
      matches++;
    }

    if (!matches) return {};

    const avgTotal = goals / matches;
    const avgPerTeam = avgTotal / 2;

    return {
      lambdaHome: clamp(avgPerTeam * 1.1),
      lambdaAway: clamp(avgPerTeam * 0.9),
    };
  }

  /* =========== 4) H2H =========== */

  async function lambdasFromH2H(homeId?: number, awayId?: number) {
    if (!homeId || !awayId) return {};

    const h2h = await apiGet("fixtures/headtohead", {
      h2h: `${homeId}-${awayId}`,
      last: 10,
    });

    const matches: any[] = h2h?.response ?? [];
    if (!matches.length) return {};

    let gH = 0,
      gA = 0,
      cH = 0,
      cA = 0;

    for (const m of matches) {
      if (m?.teams?.home?.id === homeId) {
        gH += m?.goals?.home ?? 0;
        cH++;
      }
      if (m?.teams?.away?.id === awayId) {
        gA += m?.goals?.away ?? 0;
        cA++;
      }
    }

    return {
      lambdaHome: cH ? clamp(gH / cH) : undefined,
      lambdaAway: cA ? clamp(gA / cA) : undefined,
    };
  }

  /* =============== FUNCIÓN PRINCIPAL =============== */

  function hasValid(lh: number | undefined, la: number | undefined) {
    return (
      lh !== undefined &&
      la !== undefined &&
      isFinite(lh) &&
      isFinite(la)
    );
  }

  export async function computeLambdasFromFixture(
    fixtureId: number
  ): Promise<LambdaResult> {
    try {
      const fj = await apiGet("fixtures", { id: fixtureId });
      const f = fj?.response?.[0];

      // si no hay fixture, no rompas el informe:
      if (!f) {
        return {
          lambdaHome: 1.0,
          lambdaAway: 1.0,
          meta: { source: "generic_fallback" },
        };
      }

      const leagueId = f?.league?.id;
      const season = f?.league?.season;
      const homeId = f?.teams?.home?.id;
      const awayId = f?.teams?.away?.id;

      /* 1) Stats */
      if (leagueId && season && homeId && awayId) {
        const S = await lambdasFromTeamStats(leagueId, season, homeId, awayId);
        if (hasValid(S.lambdaHome, S.lambdaAway)) {
          return {
            lambdaHome: S.lambdaHome!,
            lambdaAway: S.lambdaAway!,
            meta: { leagueId, season, homeId, awayId, source: "team_stats" },
          };
        }
      }

      /* 2) Últimos partidos */
      if (homeId && awayId) {
        const R = await lambdasFromRecentFixtures(homeId, awayId);
        if (hasValid(R.lambdaHome, R.lambdaAway)) {
          return {
            lambdaHome: R.lambdaHome!,
            lambdaAway: R.lambdaAway!,
            meta: { leagueId, season, homeId, awayId, source: "recent_fixtures" },
          };
        }
      }

      /* 3) Promedio de liga */
      if (leagueId) {
        const L = await lambdasFromLeagueAverage(leagueId, season);
        if (hasValid(L.lambdaHome, L.lambdaAway)) {
          return {
            lambdaHome: L.lambdaHome!,
            lambdaAway: L.lambdaAway!,
            meta: { leagueId, season, homeId, awayId, source: "league_avg" },
          };
        }
      }

      /* 4) H2H */
      const H = await lambdasFromH2H(homeId, awayId);
      if (hasValid(H.lambdaHome, H.lambdaAway)) {
        return {
          lambdaHome: H.lambdaHome!,
          lambdaAway: H.lambdaAway!,
          meta: { leagueId, season, homeId, awayId, source: "h2h" },
        };
      }

      /* 5) Fallback final */
      return {
        lambdaHome: 1.55,
        lambdaAway: 1.25,
        meta: { leagueId, season, homeId, awayId, source: "generic_fallback" },
      };
    } catch (e) {
      console.error("computeLambdasFromFixture error:", e);
      return {
        lambdaHome: 1.55,
        lambdaAway: 1.25,
        meta: { source: "error" },
      };
    }
  }

  /* ==================== POR NOMBRES ==================== */

  export async function computeLambdasByNames(
    homeName: string,
    awayName: string,
    leagueId?: number,
    season?: number
  ): Promise<LambdaResult> {
    try {
      const sH = await apiGet("teams", { search: homeName });
      const sA = await apiGet("teams", { search: awayName });

      const homeId = sH?.response?.[0]?.team?.id;
      const awayId = sA?.response?.[0]?.team?.id;

      if (!homeId || !awayId) throw new Error("No se encontraron IDs");

      let L = leagueId;
      let S = season;

      if (!L || !S) {
const lg = await apiGet("leagues", { team: homeId, current: "true" });
        const r = lg?.response?.[0];
        L = L || r?.league?.id;
        S = S || r?.seasons?.find?.((x: any) => x.current)?.year;
      }

      /* 1) Stats */
      if (L && S) {
        const ST = await lambdasFromTeamStats(L, S, homeId, awayId);
        if (hasValid(ST.lambdaHome, ST.lambdaAway)) {
          return {
            lambdaHome: ST.lambdaHome!,
            lambdaAway: ST.lambdaAway!,
            meta: { leagueId: L, season: S, homeId, awayId, source: "team_stats" },
          };
        }
      }

      /* 2) Recent */
      const R = await lambdasFromRecentFixtures(homeId, awayId);
      if (hasValid(R.lambdaHome, R.lambdaAway)) {
        return {
          lambdaHome: R.lambdaHome!,
          lambdaAway: R.lambdaAway!,
          meta: { leagueId: L, season: S, homeId, awayId, source: "recent_fixtures" },
        };
      }

      /* 3) League avg */
      if (L) {
        const LA = await lambdasFromLeagueAverage(L, S);
        if (hasValid(LA.lambdaHome, LA.lambdaAway)) {
          return {
            lambdaHome: LA.lambdaHome!,
            lambdaAway: LA.lambdaAway!,
            meta: { leagueId: L, season: S, homeId, awayId, source: "league_avg" },
          };
        }
      }

      /* 4) H2H */
      const H = await lambdasFromH2H(homeId, awayId);
      if (hasValid(H.lambdaHome, H.lambdaAway)) {
        return {
          lambdaHome: H.lambdaHome!,
          lambdaAway: H.lambdaAway!,
          meta: { leagueId: L, season: S, homeId, awayId, source: "h2h" },
        };
      }

      return {
        lambdaHome: 1.55,
        lambdaAway: 1.25,
        meta: { leagueId: L, season: S, homeId, awayId, source: "generic_fallback" },
      };
    } catch (e) {
      console.error("computeLambdasByNames error:", e);
      return { lambdaHome: 1.55, lambdaAway: 1.25, meta: { source: "error" } };
    }
  }
