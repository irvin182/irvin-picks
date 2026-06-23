// app/probador/page.tsx
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  computeLambdasFromFixture,
  computeLambdasByNames,
  apiGet,
} from "../utils/stats";

/* ---------------------- Helpers numéricos ---------------------- */
const toNum = (s: string) => parseFloat(String(s).replace(",", ".")) || 0;
const factorial = (n: number) => {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};
const pois = (l: number, k: number) =>
  Math.exp(-l) * Math.pow(l, k) / factorial(k);

/* ================= PRIMER TIEMPO 1X2 ================= */

function poissonPMF(lambda: number, k: number): number {
  if (k < 0) return 0;
  let term = 1;
  for (let i = 1; i <= k; i++) term *= lambda / i;
  return Math.exp(-lambda) * term;
}

function halfTime1X2(lambdaHome: number, lambdaAway: number, factor = 0.5) {
  const lh = lambdaHome * factor;
  const la = lambdaAway * factor;

  let pH = 0,
    pD = 0,
    pA = 0;
  const max = 10;

  for (let h = 0; h <= max; h++) {
    const pHk = poissonPMF(lh, h);
    for (let a = 0; a <= max; a++) {
      const p = pHk * poissonPMF(la, a);
      if (h > a) pH += p;
      else if (h === a) pD += p;
      else pA += p;
    }
  }

  const total = pH + pD + pA || 1;

  return {
    homeHT: pH / total,
    drawHT: pD / total,
    awayHT: pA / total,
  };
}

/* ------- Tipos ------- */
type FxLiveItem = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed?: number };
  };
  league: { id: number; name: string };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
};

type Probs = {
  pH: number;
  pD: number;
  pA: number;
  mostLikely: { home: number; away: number; prob: number };
};

type Market = {
  home?: number;
  draw?: number;
  away?: number;
  bookmaker?: string;
};

type AdvMarkets = {
  over05: number;
  over15: number;
  over25: number;
  over35: number;
  over45: number;
  btts: number;
  cleanSheetHome: number;
  cleanSheetAway: number;
  homeScores2plus: number;
  awayScores2plus: number;
};

type BestBet = {
  sel: "1" | "X" | "2";
  prob: number;
  edge?: number;
  kelly?: number;
  confidence: "alta" | "media" | "baja" | "sin valor";
};

type Result = {
  probs: Probs;
  fair: { home: number; draw: number; away: number };
  pBTTS: number;
  pOver25: number;
  adv?: AdvMarkets;
  market?: Market;
  value?: { H?: number; D?: number; A?: number };
  kelly?: { H?: number; D?: number; A?: number };
  best?: BestBet;
};

type FxTeam = { id: number; name: string; logo?: string };
type FxLeague = { id: number; name: string; round?: string; season?: number };
type FxItem = {
  fixture: { id: number; date: string; venue?: { name?: string } };
  teams: { home: FxTeam; away: FxTeam };
  league: FxLeague;
};

type ApiLeague = {
  league: { id: number; name: string; type: string };
  country?: { name?: string; code?: string };
  seasons?: Array<{ year: number; current: boolean }>;
};

/* -------------------- Cálculos del modelo -------------------- */
function calcProbs1X2(lH: number, lA: number, max = 10): Probs {
  let pH = 0,
    pD = 0,
    pA = 0;
  let best = { home: 0, away: 0, prob: 0 };
  for (let h = 0; h <= max; h++) {
    const pHk = pois(lH, h);
    for (let a = 0; a <= max; a++) {
      const p = pHk * pois(lA, a);
      if (h > a) pH += p;
      else if (h === a) pD += p;
      else pA += p;
      if (p > best.prob) best = { home: h, away: a, prob: p };
    }
  }
  return { pH, pD, pA, mostLikely: best };
}

const fairOdds = (p: number) => (p > 0 ? 1 / p : Infinity);
const value = (p: number, o?: number) => (o ? p * o - 1 : undefined);
const kelly = (p: number, o?: number, f = 1) =>
  o ? Math.max(0, f * ((p * (o - 1) - (1 - p)) / (o - 1))) : undefined;

function probBTTS(lH: number, lA: number, max = 10) {
  let yes = 0;
  for (let h = 0; h <= max; h++)
    for (let a = 0; a <= max; a++) {
      const p = pois(lH, h) * pois(lA, a);
      if (h > 0 && a > 0) yes += p;
    }
  return yes;
}

function probOver25(lH: number, lA: number, max = 10) {
  let over = 0;
  for (let h = 0; h <= max; h++)
    for (let a = 0; a <= max; a++) {
      const p = pois(lH, h) * pois(lA, a);
      if (h + a > 2) over += p;
    }
  return over;
}

function probOverLine(lH: number, lA: number, line: number, max = 10) {
  // line: 0.5, 1.5, 2.5, 3.5, 4.5...
  const threshold = Math.floor(line + 1); // 0.5 -> 1, 1.5 -> 2, 2.5 -> 3...
  let over = 0;
  for (let h = 0; h <= max; h++)
    for (let a = 0; a <= max; a++) {
      const p = pois(lH, h) * pois(lA, a);
      if (h + a >= threshold) over += p;
    }
  return over;
}

function computeAdvancedMarkets(lH: number, lA: number, max = 10): AdvMarkets {
  let btts = 0;
  let cleanH = 0;
  let cleanA = 0;
  let home2plus = 0;
  let away2plus = 0;

  for (let h = 0; h <= max; h++)
    for (let a = 0; a <= max; a++) {
      const p = pois(lH, h) * pois(lA, a);
      if (h > 0 && a > 0) btts += p;
      if (a === 0) cleanH += p;
      if (h === 0) cleanA += p;
      if (h >= 2) home2plus += p;
      if (a >= 2) away2plus += p;
    }

  const over05 = probOverLine(lH, lA, 0.5, max);
  const over15 = probOverLine(lH, lA, 1.5, max);
  const over25 = probOverLine(lH, lA, 2.5, max);
  const over35 = probOverLine(lH, lA, 3.5, max);
  const over45 = probOverLine(lH, lA, 4.5, max);

  return {
    over05,
    over15,
    over25,
    over35,
    over45,
    btts,
    cleanSheetHome: cleanH,
    cleanSheetAway: cleanA,
    homeScores2plus: home2plus,
    awayScores2plus: away2plus,
  };
}

function computeBestBet(
  probs: Probs,
  market?: Market,
  val?: { H?: number; D?: number; A?: number },
  kel?: { H?: number; D?: number; A?: number },
): BestBet | undefined {
  if (!market || !val || !kel) return undefined;

  const entries = [
    { sel: "1" as const, p: probs.pH, edge: val.H ?? -Infinity, kelly: kel.H ?? 0 },
    { sel: "X" as const, p: probs.pD, edge: val.D ?? -Infinity, kelly: kel.D ?? 0 },
    { sel: "2" as const, p: probs.pA, edge: val.A ?? -Infinity, kelly: kel.A ?? 0 },
  ];

  const best = entries.reduce((a, b) => (b.edge > a.edge ? b : a));

  if (best.edge <= 0 || best.kelly <= 0) {
    return {
      sel: best.sel,
      prob: best.p,
      edge: best.edge,
      kelly: best.kelly,
      confidence: "sin valor",
    };
  }

  let confidence: BestBet["confidence"] = "baja";

  if (best.edge > 0.08 && best.p >= 0.55 && best.kelly > 0.03) {
    confidence = "alta";
  } else if (best.edge > 0.04 && best.p >= 0.45 && best.kelly > 0.015) {
    confidence = "media";
  } else {
    confidence = "baja";
  }

  return {
    sel: best.sel,
    prob: best.p,
    edge: best.edge,
    kelly: best.kelly,
    confidence,
  };
}

/* ---------------------- Ligas especiales (IDs) ---------------------- */
const SPECIAL_LEAGUES = [
  { id: 10, name: "Amistosos Internacionales" },
  { id: 32, name: "Eliminatorias Mundial — UEFA" },
  { id: 31, name: "Eliminatorias Mundial — CAF" },
  { id: 29, name: "Eliminatorias Mundial — CONMEBOL" },
];

const FAVORITES = [
  { id: 2, name: "UEFA Champions League" },
  { id: 39, name: "Premier League (ENG)" },
  { id: 140, name: "LaLiga (ESP)" },
  { id: 135, name: "Serie A (ITA)" },
  { id: 78, name: "Bundesliga (GER)" },
  { id: 61, name: "Ligue 1 (FRA)" },
  { id: 88, name: "Eredivisie (NED)" },
];

function currentSeasonGuess() {
  const now = new Date();
  const m = now.getMonth();
  return m >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}
const fmt = (d: Date) => d.toISOString().slice(0, 10);

/* ======================= PÁGINA ======================= */
function ProbadorContent() {
  const searchParams = useSearchParams();

  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [lambdaH, setLambdaH] = useState(1.55);
  const [lambdaA, setLambdaA] = useState(1.25);
  const [genericLambdas, setGenericLambdas] = useState(false);
  const [notes, setNotes] = useState("");

  const [fixtureId, setFixtureId] = useState("");
  const [leagueId, setLeagueId] = useState<number | "">("");
  const [season, setSeason] = useState<number | "">(currentSeasonGuess());

  const [oddH, setOddH] = useState<string>("");
  const [oddD, setOddD] = useState<string>("");
  const [oddA, setOddA] = useState<string>("");

  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<string>("Listo");

  const [leagues, setLeagues] = useState<Array<{ id: number; name: string }>>(
    [],
  );
  const [leaguesLoading, setLeaguesLoading] = useState<boolean>(false);

  const [selLeague, setSelLeague] = useState<number>(2);
  const [fxLoading, setFxLoading] = useState<boolean>(false);
  const [upcoming, setUpcoming] = useState<FxItem[]>([]);

  const [liveGames, setLiveGames] = useState<FxLiveItem[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [autoRefreshLive, setAutoRefreshLive] = useState(true);
  const LIVE_INTERVAL_MS = 120000;

  const currentMarket: Market | undefined = useMemo(() => {
    const h = toNum(oddH);
    const d = toNum(oddD);
    const a = toNum(oddA);
    if (h > 1 && d > 1 && a > 1)
      return { home: h, draw: d, away: a, bookmaker: "Manual" };
    return undefined;
  }, [oddH, oddD, oddA]);

  const recompute = (lH: number, lA: number, market?: Market) => {
    const probs = calcProbs1X2(lH, lA);
    const fair = {
      home: fairOdds(probs.pH),
      draw: fairOdds(probs.pD),
      away: fairOdds(probs.pA),
    };
    const pBTTS = probBTTS(lH, lA);
    const pOver25 = probOver25(lH, lA);
    const adv = computeAdvancedMarkets(lH, lA);

    const val = market
      ? {
          H: value(probs.pH, market.home),
          D: value(probs.pD, market.draw),
          A: value(probs.pA, market.away),
        }
      : undefined;

    const kel = market
      ? {
          H: kelly(probs.pH, market.home),
          D: kelly(probs.pD, market.draw),
          A: kelly(probs.pA, market.away),
        }
      : undefined;

    const best = computeBestBet(probs, market, val, kel);

    setResult({
      probs,
      fair,
      pBTTS,
      pOver25,
      adv,
      market,
      value: val,
      kelly: kel,
      best,
    });
  };

  async function loadFixture(fxId: string) {
    try {
      setStatus(`Cargando fixture ${fxId}…`);
      const fj = await apiGet("fixtures", { id: fxId });
      const f = fj?.response?.[0];
      if (f) {
        setHomeTeam(f.teams?.home?.name ?? "");
        setAwayTeam(f.teams?.away?.name ?? "");
        const lg = Number(f.league?.id);
        const seasonFromDate = f.fixture?.date
          ? new Date(f.fixture.date).getUTCFullYear()
          : undefined;
        const ssn = Number(
          f.league?.season ?? seasonFromDate ?? currentSeasonGuess(),
        );
        setLeagueId(lg as any);
        setSeason(ssn as any);
      }
      const { lambdaHome, lambdaAway, meta } =
        await computeLambdasFromFixture(Number(fxId));
      const newH = Number(lambdaHome.toFixed(2));
      const newA = Number(lambdaAway.toFixed(2));
      setLambdaH(newH);
      setLambdaA(newA);

      const isGeneric =
        (meta as any)?.generic ||
        (Math.abs(newH - 1.55) < 0.01 && Math.abs(newA - 1.25) < 0.01);
      setGenericLambdas(!!isGeneric);

      recompute(newH, newA, currentMarket);
      setStatus(
        `OK · λH=${newH} λA=${newA} · ${
          currentMarket ? "con cuotas" : "sin cuotas"
        } (L:${(meta as any).leagueId} S:${(meta as any).season})`,
      );
    } catch (e: any) {
      console.error("loadFixture", e);
      setStatus(`Error: ${String(e?.message || e)}`);
    }
  }

  async function computeByNames() {
    try {
      setStatus("Calculando por nombres…");
      const lid = leagueId ? Number(leagueId) : undefined;
      const sea = season ? Number(season) : undefined;
      const { lambdaHome, lambdaAway, meta } = await computeLambdasByNames(
        homeTeam,
        awayTeam,
        lid,
        sea,
      );
      const newH = Number(lambdaHome.toFixed(2));
      const newA = Number(lambdaAway.toFixed(2));
      setLambdaH(newH);
      setLambdaA(newA);

      const isGeneric =
        (meta as any)?.generic ||
        (Math.abs(newH - 1.55) < 0.01 && Math.abs(newA - 1.25) < 0.01);
      setGenericLambdas(!!isGeneric);

      recompute(newH, newA, currentMarket);
      setStatus(
        `OK · λH=${newH} λA=${newA} · ${
          lid && sea ? "con liga/temporada" : "fallback por forma"
        }`,
      );
    } catch (e: any) {
      console.error("computeByNames", e);
      setStatus(`Error: ${String(e?.message || e)}`);
    }
  }

  async function recalcSmart() {
    // cuando recalculas manual, asumimos que NO es genérico
    setGenericLambdas(false);

    if (homeTeam.trim() && awayTeam.trim()) {
      try {
        await computeByNames();
        return;
      } catch (e) {
        console.error(e);
      }
    }
    recompute(lambdaH, lambdaA, result?.market ?? currentMarket);
  }

  // ===== Próximos por liga =====
  async function loadUpcomingByLeague(lid: number, sea?: number) {
    try {
      setFxLoading(true);
      setUpcoming([]);
      setStatus(`Cargando próximos partidos de la liga ${lid}…`);

      let ssn = sea as number | undefined;

      // 1) Pregunta la season actual/última
      try {
        const li = await apiGet("leagues", { id: lid });
        const seasonsArr: Array<{ year: number; current?: boolean }> =
          li?.response?.[0]?.seasons ?? [];
        const current =
          seasonsArr.find((s: any) => s?.current) ?? seasonsArr.at(-1);
        const apiSeason = current?.year as number | undefined;
        if (apiSeason) ssn = apiSeason;
      } catch {
        // ignore
      }

      let data, list: FxItem[] = [];

      // 2) Próximos por season
      if (ssn) {
        data = await apiGet("fixtures", { league: lid, season: ssn, next: 20 });
        list = data?.response ?? [];
      }

      // 3) Ventana amplia con season
      if (!list.length && ssn) {
        const from = new Date();
        const to = new Date();
        to.setDate(from.getDate() + 365);
        data = await apiGet("fixtures", {
          league: lid,
          season: ssn,
          from: fmt(from),
          to: fmt(to),
        });
        list = data?.response ?? [];
      }

      // 4) Ventana amplia sin season
      if (!list.length) {
        const from = new Date();
        const to = new Date();
        to.setDate(from.getDate() + 365);
        data = await apiGet("fixtures", {
          league: lid,
          from: fmt(from),
          to: fmt(to),
        });
        list = data?.response ?? [];
      }

      // 5) Últimos 20 si aún no hay
      if (!list.length) {
        const qsLast: Record<string, string | number> = {
          league: lid,
          last: 20,
        };
        data = await apiGet("fixtures", qsLast);
        list = data?.response ?? [];
        if (list.length)
          setStatus(`No hay próximos; mostrando últimos ${list.length}.`);
      }

      setUpcoming(list);
      if (ssn) setSeason(ssn as any);

      setStatus(
        list.length
          ? `Partidos cargados: ${list.length}${
              ssn ? ` (season ${ssn})` : ""
            }`
          : "Sin partidos próximos en la API para esta liga/temporada.",
      );
    } catch (e: any) {
      console.error("loadUpcomingByLeague", e);
      setStatus(`Error fixtures liga: ${String(e?.message || e)}`);
    } finally {
      setFxLoading(false);
    }
  }

  async function loadLive(lids?: number[]) {
    try {
      setLiveLoading(true);
      setStatus("Cargando partidos en vivo…");
      const qs: Record<string, string> = lids?.length
        ? { live: lids.join("-") }
        : { live: "all" };
      const data = await apiGet("fixtures", qs);
      const list: FxLiveItem[] = data?.response ?? [];
      setLiveGames(list);
      setStatus(`En vivo: ${list.length} partidos`);
    } catch (e: any) {
      console.error("loadLive", e);
      setStatus(`Error live: ${String(e?.message || e)}`);
    } finally {
      setLiveLoading(false);
    }
  }

  async function loadLeagues() {
    try {
      setLeaguesLoading(true);
      setStatus("Cargando ligas…");

      const data = await apiGet("leagues", { current: "true" });
      const resp: ApiLeague[] = data?.response ?? [];

      const apiLeagues = resp
        .map((x) => ({
          id: x.league.id,
          name:
            x.league.name +
            (x.country?.name ? ` (${x.country.name})` : ""),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const map = new Map<number, string>();
      [...FAVORITES, ...SPECIAL_LEAGUES, ...apiLeagues].forEach((l) => {
        if (!map.has(l.id)) map.set(l.id, l.name);
      });

      const merged = Array.from(map.entries()).map(([id, name]) => ({
        id,
        name,
      }));
      setLeagues(merged);

      if (!merged.find((l) => l.id === selLeague)) setSelLeague(2);

      setStatus(`Ligas cargadas: ${merged.length}`);
    } catch (e: any) {
      console.error("loadLeagues", e);
      setStatus(`Error ligas: ${String(e?.message || e)}`);
      const fallback = [...FAVORITES, ...SPECIAL_LEAGUES];
      setLeagues(fallback);
    } finally {
      setLeaguesLoading(false);
    }
  }

  /* Efectos */
  useEffect(() => {
    const fx = searchParams.get("fixtureId");
    if (fx) {
      setFixtureId(fx);
      loadFixture(fx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    recompute(lambdaH, lambdaA);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (result) recompute(lambdaH, lambdaA, currentMarket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lambdaH, lambdaA, oddH, oddD, oddA]);

  useEffect(() => {
    loadLeagues();
    loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selLeague) {
      loadUpcomingByLeague(
        selLeague,
        typeof season === "number" ? season : undefined,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selLeague]);

  useEffect(() => {
    if (!autoRefreshLive) return;
    const id = setInterval(() => loadLive(), LIVE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshLive]);

  const recommendation = useMemo(() => {
    if (!result) {
      return {
        label: "Calcula o carga un partido",
        color: "bg-zinc-700/40 text-zinc-100",
      };
    }
    if (!result.best || !result.value || !result.kelly || !result.market) {
      return {
        label: "Sin cuotas: no apostar",
        color: "bg-zinc-700/40 text-zinc-100",
      };
    }

    const b = result.best;

    if (b.confidence === "sin valor" || (b.edge ?? 0) <= 0) {
      return {
        label: `No apostar (sin value claro)`,
        color: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
      };
    }

    const edgePct = ((b.edge ?? 0) * 100).toFixed(1);
    const kellyPct = ((b.kelly ?? 0) * 100).toFixed(1);
    const probPct = (b.prob * 100).toFixed(1);

    const confText =
      b.confidence === "alta"
        ? "ALTA"
        : b.confidence === "media"
        ? "MEDIA"
        : "BAJA";

    const color =
      b.confidence === "alta"
        ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
        : b.confidence === "media"
        ? "bg-emerald-500/10 text-emerald-200 border border-emerald-500/30"
        : "bg-emerald-500/5 text-emerald-100 border border-emerald-500/20";

    return {
      label: `Apuesta sugerida: ${b.sel} · Confianza ${confText} · Prob ${probPct}% · Value +${edgePct}% · Kelly ${kellyPct}%`,
      color,
    };
  }, [result]);

  /* ======================= UI ======================= */

  return (
    <div className="min-h-dvh bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-zinc-100">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6">
          <div className="text-4xl">⚽</div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-wide">
              Probador de Picks y Marcadores — Irvin
            </h1>
            <div className="flex gap-2">
              <Link
                href="/reports/today"
                className="px-3 py-2 rounded-xl bg-white text-black text-sm hover:bg-zinc-200"
              >
                Informe de HOY
              </Link>
              <Link
                href="/reports/tomorrow"
                className="px-3 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-zinc-200 hover:text-black"
              >
                Informe de MAÑANA
              </Link>
            </div>
          </div>
        </div>

        <p className="text-zinc-300 mb-5">
          Modelo Poisson + conectores online. Ajusta los promedios de goles
          esperados (λ), carga un fixture o calcula por nombres. Añade cuotas
          si quieres ver «valor» y Kelly.
        </p>

        {/* ESTADO */}
        <div className="inline-flex flex-col gap-2 mb-6">
          <div className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-zinc-800/60 ring-1 ring-white/5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span>{status}</span>
          </div>

          {genericLambdas && (
            <div className="text-xs px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 max-w-xl">
              ⚠️ Aviso: la API no tenía estadísticas completas para este
              partido. Se usan λ genéricos (≈ 1.55 local, 1.25 visitante).
              Ajusta los promedios manualmente o no uses solo este informe para
              apostar fuerte.
            </div>
          )}
        </div>

        {/* EN VIVO */}
        <div className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5 mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-sm font-semibold">Partidos en vivo</div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => loadLive()}
                className="px-3 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-sm"
                disabled={liveLoading}
              >
                {liveLoading ? "Actualizando…" : "Actualizar"}
              </button>
              <label className="text-xs text-zinc-300 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefreshLive}
                  onChange={(e) => setAutoRefreshLive(e.target.checked)}
                />
                Autorefresco 20s
              </label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-300">
                <tr>
                  <th className="text-left font-semibold py-2">Min</th>
                  <th className="text-left font-semibold py-2">Liga</th>
                  <th className="text-left font-semibold py-2">Partido</th>
                  <th className="text-left font-semibold py-2">Marcador</th>
                  <th className="text-left font-semibold py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {liveLoading && (
                  <tr>
                    <td className="py-3 text-zinc-400" colSpan={5}>
                      Cargando…
                    </td>
                  </tr>
                )}
                {!liveLoading && liveGames.length === 0 && (
                  <tr>
                    <td className="py-3 text-zinc-400" colSpan={5}>
                      No hay partidos en vivo ahora mismo.
                    </td>
                  </tr>
                )}
                {liveGames.map((g) => (
                  <tr
                    key={g.fixture.id}
                    className="border-t border-white/10"
                  >
                    <td className="py-3">
                      {g.fixture.status.elapsed ?? "—"}'
                      <span className="text-xs text-zinc-400 ml-1">
                        {g.fixture.status.short}
                      </span>
                    </td>
                    <td className="py-3">{g.league.name}</td>
                    <td className="py-3">
                      {g.teams.home.name} vs {g.teams.away.name}
                    </td>
                    <td className="py-3">
                      {g.goals.home ?? 0} — {g.goals.away ?? 0}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setFixtureId(String(g.fixture.id));
                          loadFixture(String(g.fixture.id));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="px-3 py-1 rounded-lg bg-white text-black hover:bg-zinc-200"
                      >
                        Analizar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* EXPLORADOR LIGAS */}
        <div className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5 mb-8">
          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
            <div className="grow">
              <label className="text-xs text-zinc-400">Liga</label>
              <select
                className="w-full bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 focus:outline-none"
                value={selLeague}
                onChange={(e) => setSelLeague(Number(e.target.value))}
                disabled={leaguesLoading}
              >
                {FAVORITES.filter((f) =>
                  leagues.find((l) => l.id === f.id),
                ).length > 0 && (
                  <optgroup label="Favoritas">
                    {FAVORITES.filter((f) =>
                      leagues.find((l) => l.id === f.id),
                    ).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Internacionales / Especiales">
                  {SPECIAL_LEAGUES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Todas (API)">
                  {leagues
                    .filter(
                      (l) =>
                        !FAVORITES.find((f) => f.id === l.id) &&
                        !SPECIAL_LEAGUES.find((s) => s.id === l.id),
                    )
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400">Temporada</label>
              <input
                className="w-full bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 focus:outline-none"
                value={typeof season === "number" ? season : ""}
                onChange={(e) => setSeason(toNum(e.target.value) as any)}
                placeholder="2024 / 2025"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                loadUpcomingByLeague(
                  selLeague,
                  typeof season === "number" ? season : undefined,
                )
              }
              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200"
              disabled={leaguesLoading}
            >
              {leaguesLoading ? "Cargando..." : "Buscar próximos"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-300">
                <tr>
                  <th className="text-left font-semibold py-2">Fecha</th>
                  <th className="text-left font-semibold py-2">
                    Liga/Ronda
                  </th>
                  <th className="text-left font-semibold py-2">Partido</th>
                  <th className="text-left font-semibold py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {(fxLoading || leaguesLoading) && (
                  <tr>
                    <td className="py-3 text-zinc-400" colSpan={4}>
                      Cargando…
                    </td>
                  </tr>
                )}
                {!fxLoading && !leaguesLoading && upcoming.length === 0 && (
                  <tr>
                    <td className="py-3 text-zinc-400" colSpan={4}>
                      Sin partidos próximos.
                    </td>
                  </tr>
                )}
                {upcoming.map((m) => (
                  <tr
                    key={m.fixture.id}
                    className="border-t border-white/10"
                  >
                    <td className="py-3">
                      {new Date(m.fixture.date).toLocaleString()}
                    </td>
                    <td className="py-3">
                      {m.league.name}
                      {m.league.round ? ` — ${m.league.round}` : ""}
                    </td>
                    <td className="py-3">
                      {m.teams.home.name} vs {m.teams.away.name}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setFixtureId(String(m.fixture.id));
                          loadFixture(String(m.fixture.id));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="px-3 py-1 rounded-lg bg-white text-black hover:bg-zinc-200"
                      >
                        Analizar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fila: datos + fixture + nombres */}
        <div className="grid md:grid-cols-2 gap-5 mb-6">
          <div className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5">
            <div className="text-sm font-semibold mb-4">Datos del partido</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400">Equipo local</label>
                <input
                  className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  placeholder="Ej. Real Madrid"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">
                  Equipo visitante
                </label>
                <input
                  className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  placeholder="Ej. Barcelona"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-zinc-400">Notas</label>
                <textarea
                  className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bajas, cansancio, clima, motivación, derbi, rotaciones..."
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5">
            <div className="text-sm font-semibold mb-4">
              Cargar por Fixture ID
            </div>
            <div className="flex gap-2">
              <input
                className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                placeholder="Ej. 1485751"
                value={fixtureId}
                onChange={(e) => setFixtureId(e.target.value)}
              />
              <button
                type="button"
                onClick={() => fixtureId && loadFixture(fixtureId)}
                className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200"
              >
                Cargar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div>
                <label className="text-xs text-zinc-400">
                  leagueId (opcional)
                </label>
                <input
                  className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                  placeholder="Ej. 39, 140…"
                  value={leagueId}
                  onChange={(e) =>
                    setLeagueId(toNum(e.target.value) as any)
                  }
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">
                  season (año, opcional)
                </label>
                <input
                  className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                  placeholder="Ej. 2024, 2025…"
                  value={typeof season === "number" ? season : ""}
                  onChange={(e) =>
                    setSeason(toNum(e.target.value) as any)
                  }
                />
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={computeByNames}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/10"
              >
                Calcular por nombres
              </button>
              <span className="text-xs text-zinc-400 self-center">
                (Usa estadísticas si hay; si no, forma reciente)
              </span>
            </div>
          </div>
        </div>

        {/* Mercados avanzados */}
        <div className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5 mb-6">
          <div className="text-sm font-semibold mb-3">
            Mercados avanzados (modelo)
          </div>
          {result?.adv ? (
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="font-semibold mb-1">Línea de goles</div>
                <div>Over 0.5: {(result.adv.over05 * 100).toFixed(1)}%</div>
                <div>Over 1.5: {(result.adv.over15 * 100).toFixed(1)}%</div>
                <div>Over 2.5: {(result.adv.over25 * 100).toFixed(1)}%</div>
                <div>Over 3.5: {(result.adv.over35 * 100).toFixed(1)}%</div>
                <div>Over 4.5: {(result.adv.over45 * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="font-semibold mb-1">Ambos marcan</div>
                <div>
                  ⚽ BTTS (Sí): {(result.adv.btts * 100).toFixed(1)}%
                </div>
                <div>
                  🧱 Portería a 0 local:{" "}
                  {(result.adv.cleanSheetHome * 100).toFixed(1)}%
                </div>
                <div>
                  🧱 Portería a 0 visitante:{" "}
                  {(result.adv.cleanSheetAway * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="font-semibold mb-1">Goles por equipo</div>
                <div>
                  Local 2+ goles:{" "}
                  {(result.adv.homeScores2plus * 100).toFixed(1)}%
                </div>
                <div>
                  Visitante 2+ goles:{" "}
                  {(result.adv.awayScores2plus * 100).toFixed(1)}%
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Usa estos porcentajes para comparar con cuotas del mercado
                  (Over, BTTS, Team Total, Clean Sheet…).
                </p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-300">
              Calcula un partido para ver los mercados avanzados.
            </div>
          )}
        </div>

        {/* PRIMER TIEMPO 1X2 */}
        <div className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5 mb-6">
          <div className="text-sm font-semibold mb-3">
            Probabilidades 1X2 — Primer Tiempo
          </div>
          {lambdaH && lambdaA ? (
            (() => {
              const ht = halfTime1X2(lambdaH, lambdaA, 0.45); // 45% de los goles en 1ª parte
              return (
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-black/30 ring-1 ring-white/10 p-3">
                    <div className="text-xs text-zinc-400">1 (Local HT)</div>
                    <div className="text-2xl font-bold">
                      {(ht.homeHT * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/30 ring-1 ring-white/10 p-3">
                    <div className="text-xs text-zinc-400">
                      X (Empate HT)
                    </div>
                    <div className="text-2xl font-bold">
                      {(ht.drawHT * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/30 ring-1 ring-white/10 p-3">
                    <div className="text-xs text-zinc-400">
                      2 (Visitante HT)
                    </div>




                    
                    <div className="text-2xl font-bold">
                      {(ht.awayHT * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="text-sm text-zinc-300">
              Introduce λ para ver las probabilidades al descanso.
            </div>
          )}
        </div>

        {/* Fila: modelo + marcador + recomendación */}
        <div className="grid md:grid-cols-3 gap-5 mb-6">
          <div className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5">
            <div className="text-sm font-semibold mb-4">
              Promedios de goles esperados
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400">Local (λ)</label>
                <input
                  className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                  inputMode="decimal"
                  value={lambdaH}
                  onChange={(e) => setLambdaH(toNum(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Visitante (λ)</label>
                <input
                  className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                  inputMode="decimal"
                  value={lambdaA}
                  onChange={(e) => setLambdaA(toNum(e.target.value))}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={recalcSmart}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Recalcular
            </button>
          </div>

          <div className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5">
            <div className="text-sm font-semibold mb-4">Goles & marcador</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl ring-1 ring-white/10 bg-black/30 p-3">
                <div className="text-xs text-zinc-400">
                  Goles esperados totales
                </div>
                <div className="text-2xl font-bold">
                  {(lambdaH + lambdaA).toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl ring-1 ring-white/10 bg-black/30 p-3">
                <div className="text-xs text-zinc-400">
                  Resultado más probable
                </div>
                <div className="text-2xl font-bold">
                  {result
                    ? `${result.probs.mostLikely.home}-${result.probs.mostLikely.away}`
                    : "—"}
                </div>
              </div>
              <div className="rounded-xl ring-1 ring-white/10 bg-black/30 p-3 col-span-2">
                <div className="space-y-1 text-sm">
                  {result ? (
                    <>
                      <div>
                        ⚽ <b>Ambos equipos marcan:</b>{" "}
                        {(result.pBTTS * 100).toFixed(1)}%
                      </div>
                      <div>
                        🔥 <b>Más de 2.5 goles:</b>{" "}
                        {(result.pOver25 * 100).toFixed(1)}%
                      </div>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5">
            <div className="text-sm font-semibold mb-4">
              Apuesta sugerida
            </div>
            <div
              className={`inline-block px-3 py-2 rounded-xl ${recommendation.color}`}
            >
              {recommendation.label}
            </div>
            {result?.market && (
              <div className="text-xs text-zinc-300 mt-3">
                Book: <b>{result.market.bookmaker ?? "—"}</b> • Cuotas:{" "}
                {result.market.home} / {result.market.draw} /{" "}
                {result.market.away}
              </div>
            )}
          </div>
        </div>

        {/* Fila: 1X2 + justas + mercado + value/kelly */}
        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {["1 (Local)", "X (Empate)", "2 (Visitante)"].map((lbl, i) => {
            const p = result?.probs;
            const fair = result?.fair;
            const mkt = result?.market ?? currentMarket;
            const val = result?.value;
            const kel = result?.kelly;

            const prob =
              i === 0 ? p?.pH : i === 1 ? p?.pD : p === undefined ? undefined : p?.pA;
            const fairOdd =
              i === 0 ? fair?.home : i === 1 ? fair?.draw : fair?.away;
            const mOdd = i === 0 ? mkt?.home : i === 1 ? mkt?.draw : mkt?.away;
            const v = i === 0 ? val?.H : i === 1 ? val?.D : val?.A;
            const k = i === 0 ? kel?.H : i === 1 ? kel?.D : kel?.A;

            return (
              <div
                key={lbl}
                className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5"
              >
                <div className="text-sm font-semibold mb-2">{lbl}</div>
                <div className="text-3xl font-extrabold">
                  {prob != null ? `${(prob * 100).toFixed(1)}%` : "—"}
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  Cuota justa (modelo):{" "}
                  {fairOdd != null ? Number(fairOdd).toFixed(2) : "—"}
                </div>
                <div className="text-xs text-zinc-400">
                  Cuota mercado: {mOdd ?? "—"}
                </div>
                <div
                  className={`mt-2 text-sm ${
                    v != null && v > 0
                      ? "text-emerald-300"
                      : "text-zinc-300"
                  }`}
                >
                  Valor (edge):{" "}
                  {v != null ? `${(v * 100).toFixed(1)}%` : "—"}
                </div>
                <div className="text-xs text-zinc-400">
                  Kelly sugerido:{" "}
                  {k != null ? `${(k * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cuotas manuales */}
        <div className="rounded-3xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-5">
          <div className="text-sm font-semibold mb-4">
            Cuotas del mercado (opcional)
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-400">1 (Local)</label>
              <input
                className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                placeholder="Ej. 1.95"
                value={oddH}
                onChange={(e) => setOddH(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">X (Empate)</label>
              <input
                className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                placeholder="Ej. 3.30"
                value={oddD}
                onChange={(e) => setOddD(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">2 (Visitante)</label>
              <input
                className="bg-black/30 ring-1 ring-white/10 rounded-xl px-3 py-2 w-full focus:outline-none"
                placeholder="Ej. 4.00"
                value={oddA}
                onChange={(e) => setOddA(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOddH("");
                setOddD("");
                setOddA("");
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/10"
            >
              Limpiar cuotas
            </button>
            <span className="text-xs text-zinc-400 self-center">
              Si completas las tres, activas «valor» y Kelly automáticamente.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Probador() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Cargando...</div>}>
      <ProbadorContent />
    </Suspense>
  );
}