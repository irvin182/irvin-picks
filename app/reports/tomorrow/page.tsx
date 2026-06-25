"use client";

import { useEffect, useState } from "react";
import {
  apiGet,
  computeLambdasByNames,
  computeLambdasFromFixture,
} from "../../utils/stats";
import {
  TEAM_NAME_ES,
  LEAGUE_NAME_ES,
  COUNTRY_NAME_ES,
} from "../../utils/teamNamesES";

/* ========= CONFIG ========= */



const MAX_FIXTURES_PER_PART = 20;

/* ========= HELPERS NUMÉRICOS ========= */
const factorial = (n: number) => {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};

const pois = (l: number, k: number) =>
  Math.exp(-l) * Math.pow(l, k) / factorial(k);

type Probs = {
  pH: number;
  pD: number;
  pA: number;
  mostLikely: { home: number; away: number; prob: number };
};

function calcProbs1X2(lH: number, lA: number, max = 10): Probs {
  let pH = 0,
    pD = 0,
    pA = 0;
  let best = { home: 0, away: 0, prob: 0 };

  for (let h = 0; h <= max; h++) {
    const pHk = pois(lH, h);
    for (let a = 0; a <= max; a++) {
      const p = pHk * pois(lA, a);
      if (p > best.prob) best = { home: h, away: a, prob: p };

      if (h > a) pH += p;
      else if (h === a) pD += p;
      else pA += p;
    }
  }

  return { pH, pD, pA, mostLikely: best };
}

function probBTTS(lH: number, lA: number, max = 10) {
  let yes = 0;
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      const p = pois(lH, h) * pois(lA, a);
      if (h > 0 && a > 0) yes += p;
    }
  }
  return yes;
}

function probOver25(lH: number, lA: number, max = 10) {
  let over = 0;
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      const p = pois(lH, h) * pois(lA, a);
      if (h + a > 2) over += p;
    }
  }
  return over;
}

function probOver15(lH: number, lA: number, max = 10) {
  let over = 0;
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      const p = pois(lH, h) * pois(lA, a);
      if (h + a > 1) over += p;
    }
  }
  return over;
}

const fmtDateISO = (d: Date) => d.toISOString().slice(0, 10);

/* ========= TIPOS ========= */

type FixtureApi = {
  fixture: { id: number; date: string };
  league: { id: number; name: string; country?: string; season?: number };
  teams: { home: { name: string }; away: { name: string } };
};

type ReportRow = {
  id: number;
  date: string;
  league: string;
  home: string;
  away: string;
  lambdaH: number;
  lambdaA: number;
  probs: Probs;
  pBTTS: number;
  pOver15: number;
  pOver25: number;
  isFallback: boolean;
};

type LeagueGroup = {
  leagueId: number;
  leagueLabel: string;
  fixtures: FixtureApi[];
};

/* ========= CONSTRUCTOR DE UNA FILA ========= */

async function buildReportRow(f: FixtureApi): Promise<ReportRow> {
  const rawHome = f.teams.home.name;
  const rawAway = f.teams.away.name;
  const lid = f.league.id;
  const seasonApi =
    f.league?.season ?? new Date(f.fixture.date).getUTCFullYear();

  let lambdaRes: {
    lambdaHome: number;
    lambdaAway: number;
    meta: any;
  };

  const safeLeagueId =
    typeof lid === "number" && !Number.isNaN(lid) ? lid : undefined;
  const safeSeason =
    typeof seasonApi === "number" && !Number.isNaN(seasonApi)
      ? seasonApi
      : undefined;

  try {
    lambdaRes = await computeLambdasByNames(
      rawHome,
      rawAway,
      safeLeagueId,
      safeSeason,
    );

    let isGeneric =
      (!lambdaRes.meta?.leagueId &&
        lambdaRes.lambdaHome === 1.55 &&
        lambdaRes.lambdaAway === 1.25);

    if (isGeneric && safeLeagueId && safeSeason && safeSeason > 2000) {
      try {
        const alt = await computeLambdasByNames(
          rawHome,
          rawAway,
          safeLeagueId,
          safeSeason - 1,
        );

        const altIsBetter =
          alt.meta?.leagueId &&
          !(alt.lambdaHome === 1.55 && alt.lambdaAway === 1.25);

        if (altIsBetter) lambdaRes = alt;
      } catch {}
    }

    if (
      (!lambdaRes.meta?.leagueId &&
        lambdaRes.lambdaHome === 1.55 &&
        lambdaRes.lambdaAway === 1.25)
    ) {
      try {
        const fx = await computeLambdasFromFixture(f.fixture.id);
        const ok =
          fx.meta?.leagueId &&
          !(fx.lambdaHome === 1.55 && fx.lambdaAway === 1.25);
        if (ok) lambdaRes = fx;
      } catch {}
    }
  } catch {
    try {
      lambdaRes = await computeLambdasFromFixture(f.fixture.id);
    } catch {
      lambdaRes = {
        lambdaHome: 1.55,
        lambdaAway: 1.25,
        meta: {},
      };
    }
  }

  const lH = Number(lambdaRes.lambdaHome.toFixed(2));
  const lA = Number(lambdaRes.lambdaAway.toFixed(2));

  const isFallback =
    (!lambdaRes.meta?.leagueId && lH === 1.55 && lA === 1.25);

  const probs = calcProbs1X2(lH, lA);
  const pBTTS = probBTTS(lH, lA);
  const pOver15 = probOver15(lH, lA);
  const pOver25 = probOver25(lH, lA);

  const rawLeagueName = f.league.name;
  const rawCountry = f.league.country;

  const leagueNameES = LEAGUE_NAME_ES[rawLeagueName] ?? rawLeagueName;
  const countryNameES = rawCountry
    ? COUNTRY_NAME_ES[rawCountry] ?? rawCountry
    : undefined;

  const leagueLabel = countryNameES
    ? `${leagueNameES} (${countryNameES})`
    : leagueNameES;

  const homeName = TEAM_NAME_ES[f.teams.home.name] ?? f.teams.home.name;
  const awayName = TEAM_NAME_ES[f.teams.away.name] ?? f.teams.away.name;

  return {
    id: f.fixture.id,
    date: f.fixture.date,
    league: leagueLabel,
    home: homeName,
    away: awayName,
    lambdaH: lH,
    lambdaA: lA,
    probs,
    pBTTS,
    pOver15,
    pOver25,
    isFallback,
  };
}

/* ========= COMPONENTE PRINCIPAL ========= */

export default function InformeManana() {
  const [status, setStatus] = useState("Cargando fixtures de mañana…");
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [leagues, setLeagues] = useState<LeagueGroup[]>([]);

  const [partReports, setPartReports] = useState<Record<string, ReportRow[]>>({});
  const [partLoading, setPartLoading] = useState<Record<string, boolean>>({});
  const [partStatus, setPartStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadFixtures() {
      try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const dateStr = fmtDateISO(tomorrow);

        setStatus(`Buscando partidos programados para mañana (${dateStr})…`);

        const data = await apiGet("fixtures", { date: dateStr });
        const fixtures: FixtureApi[] = data?.response ?? [];

        if (!fixtures.length) {
          setStatus("No hay partidos para mañana.");
          setLeagues([]);
          return;
        }

        const map = new Map<number, LeagueGroup>();
        for (const f of fixtures) {
          const id = f.league.id;
          const name = f.league.name;
          const country = f.league.country;

          const nameES = LEAGUE_NAME_ES[name] ?? name;
          const countryES = country
            ? COUNTRY_NAME_ES[country] ?? country
            : undefined;

          const label = countryES ? `${nameES} (${countryES})` : nameES;

          if (!map.has(id)) map.set(id, { leagueId: id, leagueLabel: label, fixtures: [] });

          map.get(id)!.fixtures.push(f);
        }

        const groups = Array.from(map.values()).map((g) => ({
          ...g,
          fixtures: g.fixtures.sort(
            (a, b) =>
              new Date(a.fixture.date).getTime() -
              new Date(b.fixture.date).getTime(),
          ),
        }));

        setLeagues(groups);
        setStatus(
          `Encontrados ${fixtures.length} partidos en ${groups.length} ligas.`
        );
      } catch (e: any) {
        setStatus("Error cargando fixtures.");
      } finally {
        setLoadingFixtures(false);
      }
    }

    loadFixtures();
  }, []);

  const getPartsForLeague = (fixtures: FixtureApi[]) => {
    const parts: FixtureApi[][] = [];
    for (let i = 0; i < fixtures.length; i += MAX_FIXTURES_PER_PART) {
      parts.push(fixtures.slice(i, i + MAX_FIXTURES_PER_PART));
    }
    return parts;
  };

  const generatePart = async (
    league: LeagueGroup,
    partIndex: number,
    fixtures: FixtureApi[],
  ) => {
    const key = `${league.leagueId}-${partIndex}`;

    if (partReports[key]?.length) return;

    setPartLoading((p) => ({ ...p, [key]: true }));
    setPartStatus((p) => ({
      ...p,
      [key]: `Generando estadísticas para ${fixtures.length} partidos…`,
    }));

    try {
      const rows: ReportRow[] = [];

      for (const f of fixtures) {
        const row = await buildReportRow(f);
        rows.push(row);
      }

      rows.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      setPartReports((p) => ({ ...p, [key]: rows }));
      setPartStatus((p) => ({
        ...p,
        [key]: `Parte ${partIndex + 1} lista (${rows.length} partidos).`,
      }));
    } catch (e: any) {
      setPartStatus((p) => ({ ...p, [key]: "Error generando esta parte." }));
    } finally {
      setPartLoading((p) => ({ ...p, [key]: false }));
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-dvh bg-zinc-900 text-zinc-100">
      <div className="max-w-5xl mx-auto px-4 py-6">

        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              Informe de partidos — Mañana (por ligas)
            </h1>
            <p className="text-xs text-zinc-300">
              Genera las estadísticas reales por partes.
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-lg bg-white text-black text-sm"
          >
            Guardar PDF
          </button>
        </header>

        <div className="text-xs px-3 py-2 rounded-lg bg-zinc-800 mb-4">
          {status}
        </div>

        {!loadingFixtures &&
          leagues.map((lg) => {
            const parts = getPartsForLeague(lg.fixtures);
            return (
              <section
                key={lg.leagueId}
                className="rounded-2xl bg-zinc-950 p-4 mb-6"
              >
                <h2 className="text-lg font-bold mb-2">{lg.leagueLabel}</h2>
                <p className="text-xs text-zinc-400 mb-3">
                  {lg.fixtures.length} partidos — Máx {MAX_FIXTURES_PER_PART} por parte
                </p>

                <div className="space-y-4">
                  {parts.map((fixturesPart, idx) => {
                    const key = `${lg.leagueId}-${idx}`;
                    const rows = partReports[key];
                    const loading = partLoading[key];
                    const msg = partStatus[key] ?? `Parte ${idx + 1}`;

                    return (
                      <div key={key} className="rounded-xl bg-zinc-900 p-3">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <div className="text-sm font-semibold">
                              Parte {idx + 1}
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              {msg}
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              generatePart(lg, idx, fixturesPart)
                            }
                            disabled={loading}
                            className="px-3 py-1.5 bg-white text-black rounded-lg text-xs"
                          >
                            {loading
                              ? "Generando…"
                              : rows
                              ? "Regenerar"
                              : "Generar informe"}
                          </button>
                        </div>

                        {rows && (
                          <div className="space-y-4 pt-2">
                            {rows.map((m) => {
                              const { pH, pD, pA } = m.probs;
                              const totalGoals = (m.lambdaH + m.lambdaA).toFixed(2);

                              return (
                                <div
                                  key={m.id}
                                  className="rounded-xl bg-zinc-950 p-4 ring-1 ring-white/10"
                                >
                                  <div className="flex justify-between mb-1">
                                    <div className="text-xs text-zinc-400">
                                      {new Date(m.date).toLocaleString()}
                                      <br />
                                      {m.league}
                                    </div>
                                    <div className="text-xs text-indigo-300">
                                      Fixture ID: {m.id}
                                    </div>
                                  </div>

                                  <h3 className="text-lg font-bold mb-1">
                                    {m.home} vs {m.away}
                                  </h3>

                                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <div className="font-semibold">1X2</div>
                                      <div>1: {(pH * 100).toFixed(1)}%</div>
                                      <div>X: {(pD * 100).toFixed(1)}%</div>
                                      <div>2: {(pA * 100).toFixed(1)}%</div>
                                    </div>

                                    <div>
                                      <div className="font-semibold">Goles</div>
                                      <div>Esperados: {totalGoals}</div>
                                      <div>BTTS: {(m.pBTTS * 100).toFixed(1)}%</div>
                                      <div>+1.5: {(m.pOver15 * 100).toFixed(1)}%</div>
                                      <div>+2.5: {(m.pOver25 * 100).toFixed(1)}%</div>
                                    </div>

                                    <div>
                                      <div className="font-semibold">λ</div>
                                      <div>Local: {m.lambdaH.toFixed(2)}</div>
                                      <div>Visitante: {m.lambdaA.toFixed(2)}</div>
                                      <div className="text-[11px] text-zinc-500 mt-1">
                                        {m.isFallback
                                          ? "Genérico (datos insuficientes)"
                                          : "Datos reales"}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!rows && !loading && (
                          <p className="text-xs text-zinc-400">
                            Genera esta parte para ver estadísticas reales.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}
