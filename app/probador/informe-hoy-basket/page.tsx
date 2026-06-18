"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { apiGetBasket } from "@/app/utils/statsBasket";

type TeamRef = {
  id?: number | string;
  name?: string;
};

type LeagueRef = {
  id?: number | string;
  name?: string;
  country?: string;
  season?: number | string;
};

type ScoreRef = {
  total?: number | string | null;
};

type GameStatus = {
  short?: string;
  long?: string;
};

type Game = {
  id: number | string;
  date: string;
  league?: LeagueRef;
  teams?: {
    home?: TeamRef;
    away?: TeamRef;
  };
  scores?: {
    home?: ScoreRef;
    away?: ScoreRef;
  };
  status?: GameStatus;
};

type BasketApiResponse = {
  response?: Game[];
  results?: Game[];
};

type AnalysisSource = "team" | "partial" | "league" | "global" | "none";
type FinalSignal = "FIJA" | "BUENA" | "REVISAR" | "NO ENTRAR";
type QualityLevel = "ALTA" | "MEDIA" | "BAJA" | "MUY BAJA" | "-";

type LeidyModule = {
  values: number[];
  promedio?: number;
  desviacion?: number;
  rango?: number;
  estabilidad: "ALTA" | "MEDIA" | "BAJA";
};

type AnalysisDebug = {
  homeTeamId?: number;
  awayTeamId?: number;
  leagueId?: number;
  homeRecentFound: number;
  awayRecentFound: number;
  homeScoredCount: number;
  homeAllowedCount: number;
  awayScoredCount: number;
  awayAllowedCount: number;
  leagueGamesFound: number;
  source: AnalysisSource;
};

type AnalysisResult = {
  pick: string;
  confidence: number;
  note: string;
  expectedHome?: number;
  expectedAway?: number;
  rangeHome?: [number, number];
  rangeAway?: [number, number];
  stdHome?: number;
  stdAway?: number;
  hasData: boolean;
  finalSignal: FinalSignal;
  finalReason: string;
  leidy: LeidyModule;
  debug?: AnalysisDebug;
};

type ScoringStats = {
  homeScores: number[];
  awayScores: number[];
  homeAvg: number;
  awayAvg: number;
  homeStd: number;
  awayStd: number;
};

type ApiReturn = {
  ok: boolean;
  status?: number;
  data?: BasketApiResponse;
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateEs(date: string) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeEs(date: string) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdDev(nums: number[]) {
  if (nums.length <= 1) return 0;
  const mean = avg(nums);
  const variance =
    nums.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / nums.length;
  return Math.sqrt(variance);
}

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const cleaned = value.trim().replace(",", ".");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function safeId(value: unknown): number | null {
  const n = safeNumber(value);
  return n === null ? null : Math.trunc(n);
}

function formatScore(value: number | string | null | undefined) {
  const n = safeNumber(value);
  return n === null ? "-" : String(n);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDateMs(date?: string) {
  if (!date) return 0;
  const t = new Date(date).getTime();
  return Number.isFinite(t) ? t : 0;
}

function getStatusText(game: Game) {
  return (game.status?.short || game.status?.long || "").trim().toUpperCase();
}

function isGameNotStarted(game: Game) {
  const status = getStatusText(game);
  return [
    "NS",
    "TBD",
    "NOT STARTED",
    "TIME TO BE DEFINED",
    "SCHEDULED",
  ].includes(status);
}

function isGameLive(game: Game) {
  const status = getStatusText(game);
  return ["Q1", "Q2", "Q3", "Q4", "HT", "OT", "LIVE"].includes(status);
}

function isCompletedGame(game: Game) {
  const status = getStatusText(game);
  return [
    "FT",
    "AOT",
    "FT_OT",
    "FINISHED",
    "AFTER EXTRA TIME",
    "FULL TIME",
  ].includes(status);
}

function isValidFinishedGame(game: Game) {
  return (
    isCompletedGame(game) &&
    safeNumber(game.scores?.home?.total) !== null &&
    safeNumber(game.scores?.away?.total) !== null
  );
}

function sortGamesForAnalysis(list: Game[]) {
  return [...list].sort((a, b) => {
    const aLeague = a.league?.name || "";
    const bLeague = b.league?.name || "";

    if (aLeague !== bLeague) {
      return aLeague.localeCompare(bLeague, "es");
    }

    return parseDateMs(a.date) - parseDateMs(b.date);
  });
}

function extractLeagueScoringStats(games: Game[]): ScoringStats {
  const homeScores = games
    .map((g) => safeNumber(g.scores?.home?.total))
    .filter((n): n is number => n !== null);

  const awayScores = games
    .map((g) => safeNumber(g.scores?.away?.total))
    .filter((n): n is number => n !== null);

  return {
    homeScores,
    awayScores,
    homeAvg: homeScores.length ? avg(homeScores) : 78,
    awayAvg: awayScores.length ? avg(awayScores) : 76,
    homeStd: homeScores.length > 1 ? stdDev(homeScores) : 8,
    awayStd: awayScores.length > 1 ? stdDev(awayScores) : 8,
  };
}

function teamFingerprint(teamId?: number | null, name?: string) {
  const idPart = teamId ?? 0;
  const namePart = (name || "")
    .split("")
    .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1), 0);

  const raw = Math.sin(idPart * 12.9898 + namePart * 0.017) * 43758.5453;
  const frac = raw - Math.floor(raw);

  return frac;
}

function teamStyleAdjustments(teamId?: number | null, name?: string) {
  const fp = teamFingerprint(teamId, name);

  const attackAdj = round1((fp - 0.5) * 6);
  const defenseAdj = round1((0.5 - fp) * 4);
  const varianceAdj = round1(Math.abs(fp - 0.5) * 4);

  return {
    attackAdj,
    defenseAdj,
    varianceAdj,
  };
}

function decidePick(expectedHome: number, expectedAway: number) {
  const diff = expectedHome - expectedAway;
  if (diff > 1.2) return "Local";
  if (diff < -1.2) return "Visitante";
  return "Igualado";
}

function buildRanges(
  expectedHome: number,
  expectedAway: number,
  stdHome: number,
  stdAway: number
) {
  const rangeHome: [number, number] = [
    Math.max(0, round1(expectedHome - stdHome)),
    round1(expectedHome + stdHome),
  ];

  const rangeAway: [number, number] = [
    Math.max(0, round1(expectedAway - stdAway)),
    round1(expectedAway + stdAway),
  ];

  return { rangeHome, rangeAway };
}

function buildLeidyModule(values: number[]): LeidyModule {
  if (!values.length) {
    return {
      values: [],
      estabilidad: "BAJA",
    };
  }

  const promedio = round1(avg(values));
  const desviacion = round1(stdDev(values));
  const rango = round1(Math.max(...values) - Math.min(...values));

  let estabilidad: LeidyModule["estabilidad"] = "BAJA";

  if (desviacion <= 10 && rango <= 25) estabilidad = "ALTA";
  else if (desviacion <= 18 && rango <= 40) estabilidad = "MEDIA";
  else estabilidad = "BAJA";

  return {
    values,
    promedio,
    desviacion,
    rango,
    estabilidad,
  };
}

function getDisplayPromedio(a?: AnalysisResult) {
  if (!a) return undefined;
  if (a.leidy.promedio !== undefined) return a.leidy.promedio;

  if (a.expectedHome !== undefined && a.expectedAway !== undefined) {
    return round1(a.expectedHome + a.expectedAway);
  }

  return undefined;
}

function getDisplayDesviacion(a?: AnalysisResult) {
  if (!a) return undefined;
  if (a.leidy.desviacion !== undefined) return a.leidy.desviacion;

  if (a.stdHome !== undefined && a.stdAway !== undefined) {
    return round1(a.stdHome + a.stdAway);
  }

  return undefined;
}

function getDisplayRango(a?: AnalysisResult) {
  if (!a) return undefined;
  if (a.leidy.rango !== undefined) return a.leidy.rango;

  if (a.rangeHome && a.rangeAway) {
    const minTotal = a.rangeHome[0] + a.rangeAway[0];
    const maxTotal = a.rangeHome[1] + a.rangeAway[1];
    return round1(maxTotal - minTotal);
  }

  return undefined;
}

function computeFinalSignal(params: {
  source: AnalysisSource;
  confidence: number;
  pick: string;
  diff: number;
  homeRecentFound: number;
  awayRecentFound: number;
  hasData: boolean;
  leidy: LeidyModule;
}): { signal: FinalSignal; reason: string } {
  const { source, confidence, pick, diff, hasData, leidy } = params;

  if (!hasData || pick === "Igualado") {
    return {
      signal: "NO ENTRAR",
      reason: "Sin base sólida o partido equilibrado.",
    };
  }

  const absDiff = Math.abs(diff);

  if (
    source === "team" &&
    confidence >= 60 &&
    absDiff >= 2.5 &&
    leidy.estabilidad !== "BAJA"
  ) {
    return {
      signal: "FIJA",
      reason: "Base de equipo sólida y ventaja clara.",
    };
  }

  if (
    (source === "team" || source === "partial") &&
    confidence >= 56 &&
    absDiff >= 1.8
  ) {
    return {
      signal: "BUENA",
      reason: "Base aceptable con ventaja útil.",
    };
  }

  if (source === "league" && confidence >= 52) {
    return {
      signal: "REVISAR",
      reason: "Basado en tendencia de liga. Revisar cuota y contexto.",
    };
  }

  return {
    signal: "NO ENTRAR",
    reason: "Base demasiado débil para entrar con dinero serio.",
  };
}

function signalBadgeClass(signal: FinalSignal) {
  switch (signal) {
    case "FIJA":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "BUENA":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
    case "REVISAR":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
}

function pickBadgeClass(pick?: string) {
  if (pick === "Local") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (pick === "Visitante") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
  if (pick === "Igualado") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  if (pick === "Sin datos") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }
  return "border-zinc-700 bg-zinc-900 text-zinc-200";
}

function sourceLabel(source?: AnalysisSource) {
  switch (source) {
    case "team":
      return "EQUIPO";
    case "partial":
      return "PARCIAL";
    case "league":
      return "LIGA";
    case "global":
      return "GLOBAL";
    default:
      return "-";
  }
}

function sourceQuality(source?: AnalysisSource): QualityLevel {
  switch (source) {
    case "team":
      return "ALTA";
    case "partial":
      return "MEDIA";
    case "league":
      return "BAJA";
    case "global":
      return "MUY BAJA";
    default:
      return "-";
  }
}

function qualityClass(level: QualityLevel) {
  switch (level) {
    case "ALTA":
      return "text-emerald-300";
    case "MEDIA":
      return "text-cyan-300";
    case "BAJA":
      return "text-yellow-300";
    case "MUY BAJA":
      return "text-rose-300";
    default:
      return "text-zinc-300";
  }
}

function finalizeAnalysis(
  base: Omit<AnalysisResult, "finalSignal" | "finalReason">
): AnalysisResult {
  const diff =
    base.expectedHome !== undefined && base.expectedAway !== undefined
      ? base.expectedHome - base.expectedAway
      : 0;

  const source = base.debug?.source ?? "none";

  const finalMeta = computeFinalSignal({
    source,
    confidence: base.confidence,
    pick: base.pick,
    diff,
    homeRecentFound: base.debug?.homeRecentFound ?? 0,
    awayRecentFound: base.debug?.awayRecentFound ?? 0,
    hasData: base.hasData,
    leidy: base.leidy,
  });

  return {
    ...base,
    finalSignal: finalMeta.signal,
    finalReason: finalMeta.reason,
  };
}

function buildLeagueFallbackAnalysis(
  game: Game,
  leagueGames: Game[],
  leidyValues: number[],
  debugBase?: Partial<AnalysisDebug>
): AnalysisResult {
  const homeName = game.teams?.home?.name || "Local";
  const awayName = game.teams?.away?.name || "Visitante";
  const homeId = safeId(game.teams?.home?.id);
  const awayId = safeId(game.teams?.away?.id);

  if (leagueGames.length < 2) {
    return finalizeAnalysis({
      pick: "Sin datos",
      confidence: 50,
      note: "Sin histórico suficiente.",
      hasData: false,
      leidy: buildLeidyModule(leidyValues),
      debug: {
        homeRecentFound: 0,
        awayRecentFound: 0,
        homeScoredCount: 0,
        homeAllowedCount: 0,
        awayScoredCount: 0,
        awayAllowedCount: 0,
        leagueGamesFound: leagueGames.length,
        source: "none",
       
      },
    });
  }

  const stats = extractLeagueScoringStats(leagueGames);
  const homeAdj = teamStyleAdjustments(homeId, homeName);
  const awayAdj = teamStyleAdjustments(awayId, awayName);

  const expectedHome = round1(
    stats.homeAvg + 1.6 + homeAdj.attackAdj * 0.5 - awayAdj.defenseAdj * 0.3
  );
  const expectedAway = round1(
    stats.awayAvg + awayAdj.attackAdj * 0.45 - homeAdj.defenseAdj * 0.3
  );

  const stdHome = round1(stats.homeStd + homeAdj.varianceAdj * 0.35);
  const stdAway = round1(stats.awayStd + awayAdj.varianceAdj * 0.35);

  const { rangeHome, rangeAway } = buildRanges(
    expectedHome,
    expectedAway,
    stdHome,
    stdAway
  );

  const pick = decidePick(expectedHome, expectedAway);
  const absDiff = Math.abs(expectedHome - expectedAway);
  const confidence = clamp(
    Math.round(52 + absDiff * 2.4 - (stdHome + stdAway) * 0.25),
    51,
    64
  );

  return finalizeAnalysis({
    pick,
    confidence,
    note: `${homeName} ${expectedHome.toFixed(
      1
    )} pts estimados · ${awayName} ${expectedAway.toFixed(
      1
    )} pts estimados. Base por liga.`,
    expectedHome,
    expectedAway,
    rangeHome,
    rangeAway,
    stdHome,
    stdAway,
    hasData: true,
    leidy: buildLeidyModule(leidyValues),
    debug: {
      homeRecentFound: 0,
      awayRecentFound: 0,
      homeScoredCount: 0,
      homeAllowedCount: 0,
      awayScoredCount: 0,
      awayAllowedCount: 0,
      leagueGamesFound: leagueGames.length,
      source: "league",
   
    },
  });
}

function buildPartialFallbackAnalysis(
  game: Game,
  homeScored: number[],
  homeAllowed: number[],
  awayScored: number[],
  awayAllowed: number[],
  leagueGames: Game[],
  leidyValues: number[]
): AnalysisResult {
  const homeName = game.teams?.home?.name || "Local";
  const awayName = game.teams?.away?.name || "Visitante";
  const homeId = safeId(game.teams?.home?.id);
  const awayId = safeId(game.teams?.away?.id);

  const stats = extractLeagueScoringStats(leagueGames);
  const homeAdj = teamStyleAdjustments(homeId, homeName);
  const awayAdj = teamStyleAdjustments(awayId, awayName);

  const effectiveHomeAttack = homeScored.length ? avg(homeScored) : stats.homeAvg;
  const effectiveHomeDefense = homeAllowed.length ? avg(homeAllowed) : stats.awayAvg;
  const effectiveAwayAttack = awayScored.length ? avg(awayScored) : stats.awayAvg;
  const effectiveAwayDefense = awayAllowed.length ? avg(awayAllowed) : stats.homeAvg;

  const stdHomeBase = homeScored.length > 1 ? stdDev(homeScored) : stats.homeStd;
  const stdAwayBase = awayScored.length > 1 ? stdDev(awayScored) : stats.awayStd;

  const expectedHome = round1(
    (effectiveHomeAttack + effectiveAwayDefense) / 2 +
      2.1 +
      homeAdj.attackAdj * 0.35 -
      awayAdj.defenseAdj * 0.25
  );

  const expectedAway = round1(
    (effectiveAwayAttack + effectiveHomeDefense) / 2 +
      awayAdj.attackAdj * 0.3 -
      homeAdj.defenseAdj * 0.25
  );

  const stdHome = round1(stdHomeBase + homeAdj.varianceAdj * 0.25);
  const stdAway = round1(stdAwayBase + awayAdj.varianceAdj * 0.25);

  const { rangeHome, rangeAway } = buildRanges(
    expectedHome,
    expectedAway,
    stdHome,
    stdAway
  );

  const pick = decidePick(expectedHome, expectedAway);
  const absDiff = Math.abs(expectedHome - expectedAway);
  const confidence = clamp(
    Math.round(53 + absDiff * 2.2 - (stdHome + stdAway) * 0.22),
    52,
    66
  );

  return finalizeAnalysis({
    pick,
    confidence,
    note: `${homeName} ${expectedHome.toFixed(1)} · ${awayName} ${expectedAway.toFixed(
      1
    )}. Estimación híbrida con base parcial.`,
    expectedHome,
    expectedAway,
    rangeHome,
    rangeAway,
    stdHome,
    stdAway,
    hasData: true,
    leidy: buildLeidyModule(leidyValues),
    debug: {
      homeRecentFound: homeScored.length,
      awayRecentFound: awayScored.length,
      homeScoredCount: homeScored.length,
      homeAllowedCount: homeAllowed.length,
      awayScoredCount: awayScored.length,
      awayAllowedCount: awayAllowed.length,
      leagueGamesFound: leagueGames.length,
      source: "partial",
    },
  });
}

function buildTodayLeagueFallbackAnalysis(
  game: Game,
  sameLeagueTodayGames: Game[],
  allTodayGames: Game[],
  leidyValues: number[],
  debugBase?: Partial<AnalysisDebug>
): AnalysisResult {
  const homeName = game.teams?.home?.name || "Local";
  const awayName = game.teams?.away?.name || "Visitante";
  const homeId = safeId(game.teams?.home?.id);
  const awayId = safeId(game.teams?.away?.id);

  const leagueFinishedToday = sameLeagueTodayGames.filter(isValidFinishedGame);
  const usableLeagueGames =
    leagueFinishedToday.length >= 2
      ? leagueFinishedToday
      : sameLeagueTodayGames.filter((g) => safeId(g.id) !== safeId(game.id));

  const globalFinishedToday = allTodayGames.filter(isValidFinishedGame);
  const sourceGames =
    usableLeagueGames.length >= 2
      ? usableLeagueGames
      : globalFinishedToday.length >= 4
      ? globalFinishedToday
      : [];

  const homeAdj = teamStyleAdjustments(homeId, homeName);
  const awayAdj = teamStyleAdjustments(awayId, awayName);

  if (!sourceGames.length) {
    const expectedHome = round1(
      79 + homeAdj.attackAdj * 0.4 - awayAdj.defenseAdj * 0.2
    );
    const expectedAway = round1(
      77 + awayAdj.attackAdj * 0.35 - homeAdj.defenseAdj * 0.2
    );

    const stdHome = round1(8.2 + homeAdj.varianceAdj * 0.2);
    const stdAway = round1(8.2 + awayAdj.varianceAdj * 0.2);

    const { rangeHome, rangeAway } = buildRanges(
      expectedHome,
      expectedAway,
      stdHome,
      stdAway
    );

    return finalizeAnalysis({
      pick: decidePick(expectedHome, expectedAway),
      confidence: clamp(
        Math.round(52 + Math.abs(expectedHome - expectedAway) * 2),
        51,
        58
      ),
      note: `${homeName} ${expectedHome.toFixed(
        1
      )} · ${awayName} ${expectedAway.toFixed(
        1
      )}. Base global básica.`,
      expectedHome,
      expectedAway,
      rangeHome,
      rangeAway,
      stdHome,
      stdAway,
      hasData: true,
      leidy: buildLeidyModule(leidyValues),
      debug: {
        homeRecentFound: 0,
        awayRecentFound: 0,
        homeScoredCount: 0,
        homeAllowedCount: 0,
        awayScoredCount: 0,
        awayAllowedCount: 0,
        leagueGamesFound: 0,
        source: "global",
     
      },
    });
  }

  const stats = extractLeagueScoringStats(sourceGames);

  const expectedHome = round1(
    stats.homeAvg + 1.8 + homeAdj.attackAdj * 0.4 - awayAdj.defenseAdj * 0.25
  );
  const expectedAway = round1(
    stats.awayAvg + awayAdj.attackAdj * 0.35 - homeAdj.defenseAdj * 0.25
  );

  const stdHome = round1(stats.homeStd + homeAdj.varianceAdj * 0.25);
  const stdAway = round1(stats.awayStd + awayAdj.varianceAdj * 0.25);

  const { rangeHome, rangeAway } = buildRanges(
    expectedHome,
    expectedAway,
    stdHome,
    stdAway
  );

  const pick = decidePick(expectedHome, expectedAway);
  const confidence = clamp(
    Math.round(
      52 +
        Math.abs(expectedHome - expectedAway) * 2.1 -
        (stdHome + stdAway) * 0.15
    ),
    51,
    61
  );

  const usedLeague = usableLeagueGames.length >= 2;

  return finalizeAnalysis({
    pick,
    confidence,
    note: usedLeague
      ? `${homeName} ${expectedHome.toFixed(
          1
        )} · ${awayName} ${expectedAway.toFixed(
          1
        )}. Base de liga del día.`
      : `${homeName} ${expectedHome.toFixed(
          1
        )} · ${awayName} ${expectedAway.toFixed(
          1
        )}. Base global del día.`,
    expectedHome,
    expectedAway,
    rangeHome,
    rangeAway,
    stdHome,
    stdAway,
    hasData: true,
    leidy: buildLeidyModule(leidyValues),
    debug: {
      homeRecentFound: 0,
      awayRecentFound: 0,
      homeScoredCount: 0,
      homeAllowedCount: 0,
      awayScoredCount: 0,
      awayAllowedCount: 0,
      leagueGamesFound: sourceGames.length,
      source: usedLeague ? "league" : "global",
  
    },
  });
}

export default function InformeHoyBasketPage() {
  const [date, setDate] = useState(todayISO());
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analysisMap, setAnalysisMap] = useState<Record<number, AnalysisResult>>(
    {}
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalToAnalyze, setTotalToAnalyze] = useState(0);

  const printableRef = useRef<HTMLDivElement | null>(null);
  const recentGamesCacheRef = useRef<Record<string, Game[]>>({});
  const leagueGamesCacheRef = useRef<Record<string, Game[]>>({});

  async function loadGames(selectedDate: string) {
    setLoading(true);
    setError(null);
    setAnalysisMap({});
    setProgress(0);
    setTotalToAnalyze(0);
    recentGamesCacheRef.current = {};
    leagueGamesCacheRef.current = {};

    try {
      const res = (await apiGetBasket({ date: selectedDate })) as ApiReturn;

      if (!res?.ok) {
        setGames([]);
        setError(`Error ${res?.status ?? 500}`);
        return;
      }

      const list = res.data?.response ?? res.data?.results ?? [];
      setGames(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setGames([]);
      setError("Error cargando partidos de basket");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGames(date);
  }, [date]);

  const grouped = useMemo(() => {
    const groupedData = games.reduce<Record<string, Game[]>>((acc, game) => {
      const leagueName = game.league?.name || "Liga desconocida";
      if (!acc[leagueName]) acc[leagueName] = [];
      acc[leagueName].push(game);
      return acc;
    }, {});

    for (const league of Object.keys(groupedData)) {
      groupedData[league] = groupedData[league].sort(
        (a, b) => parseDateMs(a.date) - parseDateMs(b.date)
      );
    }

    return groupedData;
  }, [games]);

  const leaguesCount = Object.keys(grouped).length;

  const bestPicks = useMemo(() => {
    return Object.entries(analysisMap)
      .map(([id, analysis]) => {
        const game = games.find((g) => safeId(g.id) === Number(id));
        return game && analysis ? { game, analysis } : null;
      })
      .filter((item): item is { game: Game; analysis: AnalysisResult } => !!item)
      .filter(
        (item) =>
          item.analysis.finalSignal === "FIJA" ||
          item.analysis.finalSignal === "BUENA"
      )
      .sort((a, b) => b.analysis.confidence - a.analysis.confidence)
      .slice(0, 6);
  }, [analysisMap, games]);

  const avoidPicks = useMemo(() => {
    return Object.entries(analysisMap)
      .map(([id, analysis]) => {
        const game = games.find((g) => safeId(g.id) === Number(id));
        return game && analysis ? { game, analysis } : null;
      })
      .filter((item): item is { game: Game; analysis: AnalysisResult } => !!item)
      .filter((item) => item.analysis.finalSignal === "NO ENTRAR")
      .slice(0, 6);
  }, [analysisMap, games]);

  function handlePrintPDF() {
    window.print();
  }

  async function getRecentGamesByTeam(teamId?: number): Promise<Game[]> {
    if (!teamId) return [];

    const cacheKey = `team-last-${teamId}`;

    if (recentGamesCacheRef.current[cacheKey]) {
      return recentGamesCacheRef.current[cacheKey];
    }

    try {
      await sleep(80);

      const res = (await apiGetBasket({
        team: teamId,
        last: 10,
      })) as ApiReturn;

      if (!res?.ok) {
        recentGamesCacheRef.current[cacheKey] = [];
        return [];
      }

      const foundGames = Array.isArray(res.data?.response) ? res.data.response : [];
      const finished = foundGames
        .filter(isValidFinishedGame)
        .sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date));

      recentGamesCacheRef.current[cacheKey] = finished;
      return finished;
    } catch {
      recentGamesCacheRef.current[cacheKey] = [];
      return [];
    }
  }

  async function getFinishedLeagueGamesHistory(
    leagueId?: number
  ): Promise<Game[]> {
    if (!leagueId) return [];

    const cacheKey = `league-last-${leagueId}`;

    if (leagueGamesCacheRef.current[cacheKey]) {
      return leagueGamesCacheRef.current[cacheKey];
    }

    try {
      await sleep(80);

      const res = (await apiGetBasket({
        league: leagueId,
        last: 20,
      })) as ApiReturn;

      if (!res?.ok) {
        leagueGamesCacheRef.current[cacheKey] = [];
        return [];
      }

      const foundGames = Array.isArray(res.data?.response) ? res.data.response : [];
      const finished = foundGames
        .filter(isValidFinishedGame)
        .sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date));

      leagueGamesCacheRef.current[cacheKey] = finished;
      return finished;
    } catch {
      leagueGamesCacheRef.current[cacheKey] = [];
      return [];
    }
  }

  function extractTeamScored(game: Game, teamId: number) {
    const homeId = safeId(game.teams?.home?.id);
    const awayId = safeId(game.teams?.away?.id);

    if (homeId !== teamId && awayId !== teamId) return null;

    return homeId === teamId
      ? safeNumber(game.scores?.home?.total)
      : safeNumber(game.scores?.away?.total);
  }

  function extractTeamAllowed(game: Game, teamId: number) {
    const homeId = safeId(game.teams?.home?.id);
    const awayId = safeId(game.teams?.away?.id);

    if (homeId !== teamId && awayId !== teamId) return null;

    return homeId === teamId
      ? safeNumber(game.scores?.away?.total)
      : safeNumber(game.scores?.home?.total);
  }

  function getLeidyValuesFromGames(gamesList: Game[], limit = 5) {
    return gamesList
      .map((g) => {
        const h = safeNumber(g.scores?.home?.total);
        const a = safeNumber(g.scores?.away?.total);
        return h !== null && a !== null ? h + a : null;
      })
      .filter((n): n is number => n !== null)
      .slice(0, limit);
  }

  async function analyzeGame(game: Game): Promise<AnalysisResult> {
    const homeId = safeId(game.teams?.home?.id);
    const awayId = safeId(game.teams?.away?.id);
    const leagueId = safeId(game.league?.id);
    const homeName = game.teams?.home?.name || "Local";
    const awayName = game.teams?.away?.name || "Visitante";
    const gameId = safeId(game.id);

    if (!homeId || !awayId) {
      return finalizeAnalysis({
        pick: "Sin datos",
        confidence: 50,
        note: "Faltan IDs de equipo.",
        hasData: false,
        leidy: buildLeidyModule([]),
        debug: {
          homeTeamId: homeId ?? undefined,
          awayTeamId: awayId ?? undefined,
          leagueId: leagueId ?? undefined,
          homeRecentFound: 0,
          awayRecentFound: 0,
          homeScoredCount: 0,
          homeAllowedCount: 0,
          awayScoredCount: 0,
          awayAllowedCount: 0,
          leagueGamesFound: 0,
          source: "none",
        },
      });
    }

    const [homeRecentRaw, awayRecentRaw] = await Promise.all([
      getRecentGamesByTeam(homeId),
      getRecentGamesByTeam(awayId),
    ]);

    const homeRecent = [...homeRecentRaw]
      .filter((g) => safeId(g.id) !== gameId)
      .slice(0, 8);

    const awayRecent = [...awayRecentRaw]
      .filter((g) => safeId(g.id) !== gameId)
      .slice(0, 8);

    const homeScored = homeRecent
      .map((g) => extractTeamScored(g, homeId))
      .filter((n): n is number => n !== null);

    const homeAllowed = homeRecent
      .map((g) => extractTeamAllowed(g, homeId))
      .filter((n): n is number => n !== null);

    const awayScored = awayRecent
      .map((g) => extractTeamScored(g, awayId))
      .filter((n): n is number => n !== null);

    const awayAllowed = awayRecent
      .map((g) => extractTeamAllowed(g, awayId))
      .filter((n): n is number => n !== null);

    const leidyValues = getLeidyValuesFromGames([...homeRecent, ...awayRecent], 5);

    const debugBase: Partial<AnalysisDebug> = {
      homeTeamId: homeId,
      awayTeamId: awayId,
      leagueId: leagueId ?? undefined,
      homeRecentFound: homeRecent.length,
      awayRecentFound: awayRecent.length,
      homeScoredCount: homeScored.length,
      homeAllowedCount: homeAllowed.length,
      awayScoredCount: awayScored.length,
      awayAllowedCount: awayAllowed.length,
    };

    const enoughTeamData =
      homeScored.length >= 3 &&
      homeAllowed.length >= 3 &&
      awayScored.length >= 3 &&
      awayAllowed.length >= 3;

    if (!enoughTeamData) {
     const leagueGames = await getFinishedLeagueGamesHistory(leagueId ?? undefined);

      const hasAnyPartialData =
        homeScored.length > 0 ||
        homeAllowed.length > 0 ||
        awayScored.length > 0 ||
        awayAllowed.length > 0 ||
        leagueGames.length > 0;

      if (hasAnyPartialData) {
        const partial = buildPartialFallbackAnalysis(
          game,
          homeScored,
          homeAllowed,
          awayScored,
          awayAllowed,
          leagueGames,
          leidyValues.length ? leidyValues : getLeidyValuesFromGames(leagueGames, 5)
        );

        return finalizeAnalysis({
          ...partial,
   debug: {
  homeTeamId: partial.debug?.homeTeamId,
  awayTeamId: partial.debug?.awayTeamId,
  leagueId: partial.debug?.leagueId,

  homeRecentFound: partial.debug?.homeRecentFound ?? 0,
  awayRecentFound: partial.debug?.awayRecentFound ?? 0,
  homeScoredCount: partial.debug?.homeScoredCount ?? 0,
  homeAllowedCount: partial.debug?.homeAllowedCount ?? 0,
  awayScoredCount: partial.debug?.awayScoredCount ?? 0,
  awayAllowedCount: partial.debug?.awayAllowedCount ?? 0,

  leagueGamesFound: leagueGames.length,
  source: "partial",
},
        });
      }

      const sameLeagueTodayGames = games.filter(
        (g) => safeId(g.league?.id) === leagueId && safeId(g.id) !== gameId
      );

      const leidyFallbackValues = getLeidyValuesFromGames(
        sameLeagueTodayGames.filter(isValidFinishedGame),
        5
      );

      return buildTodayLeagueFallbackAnalysis(
        game,
        sameLeagueTodayGames,
        games,
        leidyFallbackValues,
        debugBase
      );
    }

    const homeAttackAvg = avg(homeScored);
    const homeDefenseAvg = avg(homeAllowed);
    const awayAttackAvg = avg(awayScored);
    const awayDefenseAvg = avg(awayAllowed);

    const homeAttackStd = stdDev(homeScored);
    const awayAttackStd = stdDev(awayScored);

    const homeAdj = teamStyleAdjustments(homeId, homeName);
    const awayAdj = teamStyleAdjustments(awayId, awayName);

    const expectedHome = round1(
      (homeAttackAvg + awayDefenseAvg) / 2 +
        2.4 +
        homeAdj.attackAdj * 0.3 -
        awayAdj.defenseAdj * 0.2
    );

    const expectedAway = round1(
      (awayAttackAvg + homeDefenseAvg) / 2 +
        awayAdj.attackAdj * 0.25 -
        homeAdj.defenseAdj * 0.2
    );

    const stdHome = round1(homeAttackStd + homeAdj.varianceAdj * 0.2);
    const stdAway = round1(awayAttackStd + awayAdj.varianceAdj * 0.2);

    const { rangeHome, rangeAway } = buildRanges(
      expectedHome,
      expectedAway,
      stdHome,
      stdAway
    );

    const pick = decidePick(expectedHome, expectedAway);
    const absDiff = Math.abs(expectedHome - expectedAway);

    const confidence = clamp(
      Math.round(54 + absDiff * 2.8 - (stdHome + stdAway) * 0.22),
      53,
      79
    );

    let note = `${homeName} ${expectedHome.toFixed(
      1
    )} pts esperados · ${awayName} ${expectedAway.toFixed(1)} pts esperados.`;

    if (pick === "Igualado") {
      note += " Partido equilibrado.";
    } else if (confidence < 58) {
      note += " Ventaja leve.";
    } else if (confidence < 66) {
      note += " Ventaja moderada.";
    } else {
      note += " Ventaja clara.";
    }

    return finalizeAnalysis({
      pick,
      confidence,
      note,
      expectedHome,
      expectedAway,
      rangeHome,
      rangeAway,
      stdHome,
      stdAway,
      hasData: true,
      leidy: buildLeidyModule(leidyValues),
      debug: {
        homeTeamId: homeId,
        awayTeamId: awayId,
        leagueId: leagueId ?? undefined,
        homeRecentFound: homeRecent.length,
        awayRecentFound: awayRecent.length,
        homeScoredCount: homeScored.length,
        homeAllowedCount: homeAllowed.length,
        awayScoredCount: awayScored.length,
        awayAllowedCount: awayAllowed.length,
        leagueGamesFound: 0,
        source: "team",
      },
    });
  }

  async function handleAnalyzeAll() {
    setAnalyzing(true);
    setProgress(0);
    setAnalysisMap({});

    try {
      const gamesToAnalyze = sortGamesForAnalysis(games.filter(isGameNotStarted));
      setTotalToAnalyze(gamesToAnalyze.length);

      const chunkSize = 3;

      for (let i = 0; i < gamesToAnalyze.length; i += chunkSize) {
        const chunk = gamesToAnalyze.slice(i, i + chunkSize);

        setAnalysisMap((prev) => {
          const next = { ...prev };

          for (const game of chunk) {
            const id = safeId(game.id);
            if (!id) continue;

            next[id] = {
              pick: "Analizando...",
              confidence: 0,
              note: "Procesando histórico del partido...",
              hasData: false,
              finalSignal: "REVISAR",
              finalReason: "Procesando datos.",
              leidy: {
                values: [],
                estabilidad: "BAJA",
              },
            };
          }

          return next;
        });

        const results = await Promise.all(
          chunk.map(async (game) => {
            const id = safeId(game.id);
            if (!id) return null;
            const result = await analyzeGame(game);
            return { gameId: id, result };
          })
        );

        setAnalysisMap((prev) => {
          const next = { ...prev };
          for (const item of results) {
            if (!item) continue;
            next[item.gameId] = item.result;
          }
          return next;
        });

        setProgress(Math.min(i + chunk.length, gamesToAnalyze.length));
        await sleep(60);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  const progressPercent =
    totalToAnalyze > 0 ? Math.round((progress / totalToAnalyze) * 100) : 0;

  const analyzedCount = Object.keys(analysisMap).filter(
    (key) => analysisMap[Number(key)]?.pick !== "Analizando..."
  ).length;

  const usefulCount = Object.values(analysisMap).filter(
    (a) => a.hasData && a.pick !== "Analizando..."
  ).length;

  const noDataCount = Object.values(analysisMap).filter(
    (a) => !a.hasData && a.pick !== "Analizando..."
  ).length;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div
          ref={printableRef}
          className="rounded-3xl border border-cyan-950/40 bg-gradient-to-b from-zinc-950 to-black p-5 shadow-[0_0_40px_rgba(0,255,255,0.06)] md:p-8 print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none"
        >
          <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between print:mb-4">
            <div className="flex items-center gap-4 md:gap-5">
              <div className="shrink-0 rounded-2xl border border-cyan-500/20 bg-zinc-950 p-2 shadow-[0_0_24px_rgba(0,255,255,0.14)] print:border print:border-zinc-300 print:bg-white print:p-1 print:shadow-none">
                <Image
                  src="/logo-irvin.png"
                  alt="Irvin Analytics"
                  width={90}
                  height={90}
                  className="h-[72px] w-[72px] rounded-xl object-cover md:h-[90px] md:w-[90px]"
                  priority
                />
              </div>

              <div>
                <p className="mb-1 text-sm font-medium uppercase tracking-[0.25em] text-cyan-400 print:text-black">
                  Irvin Analytics
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl print:text-black">
                  Informe basket — Hoy
                </h1>
                <p className="mt-2 text-sm text-zinc-400 md:text-base print:text-black">
                  Pick, confianza, promedio, desviación estándar, rango, base y señal final.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:items-end print:hidden">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleAnalyzeAll}
                  disabled={loading || games.length === 0 || analyzing}
                  className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {analyzing
                    ? `Analizando ${progress}/${totalToAnalyze}...`
                    : "Analizar todos"}
                </button>

                <button
                  onClick={handlePrintPDF}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-cyan-300"
                >
                  Guardar PDF
                </button>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
                <div>
                  <span className="text-zinc-500">Fecha:</span>{" "}
                  <span className="font-semibold text-white">
                    {formatDateEs(date)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Ligas:</span>{" "}
                  <span className="font-semibold text-white">{leaguesCount}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Partidos:</span>{" "}
                  <span className="font-semibold text-white">{games.length}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Analizados:</span>{" "}
                  <span className="font-semibold text-white">{analyzedCount}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Con datos:</span>{" "}
                  <span className="font-semibold text-emerald-300">{usefulCount}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Sin datos:</span>{" "}
                  <span className="font-semibold text-yellow-300">{noDataCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-3 md:grid-cols-4 print:hidden">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="text-sm font-semibold text-emerald-300">FIJA</div>
              <div className="mt-1 text-sm text-zinc-300">Solo con base alta y ventaja clara.</div>
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="text-sm font-semibold text-cyan-300">BUENA</div>
              <div className="mt-1 text-sm text-zinc-300">Base usable con señal aceptable.</div>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="text-sm font-semibold text-amber-300">REVISAR</div>
              <div className="mt-1 text-sm text-zinc-300">Mirar cuota y contexto antes de entrar.</div>
            </div>
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
              <div className="text-sm font-semibold text-rose-300">NO ENTRAR</div>
              <div className="mt-1 text-sm text-zinc-300">Base débil para meter dinero serio.</div>
            </div>
          </div>

          {(bestPicks.length > 0 || avoidPicks.length > 0) && (
            <div className="mb-8 grid gap-4 md:grid-cols-2 print:hidden">
              <div className="rounded-2xl border border-emerald-500/20 bg-zinc-950/80 p-4">
                <h3 className="text-lg font-bold text-emerald-300">
                  Selecciones mejor posicionadas
                </h3>
                <div className="mt-3 space-y-2">
                  {bestPicks.length === 0 ? (
                    <p className="text-sm text-zinc-400">Aún no hay selecciones fuertes o buenas.</p>
                  ) : (
                    bestPicks.map(({ game, analysis }) => (
                      <div
                        key={`best-${safeId(game.id)}`}
                        className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white">
                            {game.teams?.home?.name || "Local"} vs {game.teams?.away?.name || "Visitante"}
                          </div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${signalBadgeClass(analysis.finalSignal)}`}>
                            {analysis.finalSignal}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          Pick: <span className="font-semibold text-zinc-200">{analysis.pick}</span> · Confianza:{" "}
                          <span className="font-semibold text-cyan-300">{analysis.confidence}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-rose-500/20 bg-zinc-950/80 p-4">
                <h3 className="text-lg font-bold text-rose-300">
                  Partidos a evitar
                </h3>
                <div className="mt-3 space-y-2">
                  {avoidPicks.length === 0 ? (
                    <p className="text-sm text-zinc-400">No hay alertas fuertes de exclusión.</p>
                  ) : (
                    avoidPicks.map(({ game, analysis }) => (
                      <div
                        key={`avoid-${safeId(game.id)}`}
                        className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white">
                            {game.teams?.home?.name || "Local"} vs {game.teams?.away?.name || "Visitante"}
                          </div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${signalBadgeClass(analysis.finalSignal)}`}>
                            {analysis.finalSignal}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          {analysis.finalReason}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mb-8 grid gap-4 md:grid-cols-[260px_1fr] print:hidden">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Selecciona fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
              />
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
              <div className="flex h-full flex-col justify-center">
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">
                  Estado del informe
                </p>

                {loading && (
                  <p className="mt-2 text-lg font-semibold text-white">
                    Cargando partidos...
                  </p>
                )}

                {!loading && error && (
                  <p className="mt-2 text-lg font-semibold text-red-400">
                    {error}
                  </p>
                )}

                {!loading && !error && games.length === 0 && (
                  <p className="mt-2 text-lg font-semibold text-zinc-300">
                    No hay partidos programados para esta fecha.
                  </p>
                )}

                {!loading && !error && games.length > 0 && (
                  <p className="mt-2 text-lg font-semibold text-white">
                    Se han encontrado{" "}
                    <span className="text-cyan-400">{games.length}</span>{" "}
                    partidos en{" "}
                    <span className="text-cyan-400">{leaguesCount}</span> ligas.
                  </p>
                )}

                {analyzing && (
                  <div className="mt-3">
                    <p className="mb-2 text-sm font-semibold text-emerald-300">
                      Analizando {progress}/{totalToAnalyze} partidos...
                    </p>

                    <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {!loading && !error && games.length === 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-zinc-400">
              No hay datos disponibles para esta fecha.
            </div>
          )}

          {Object.entries(grouped).map(([league, items]) => (
            <section
              key={league}
              className="mb-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 print:mb-4 print:border print:bg-white"
            >
              <div className="border-b border-zinc-800 bg-zinc-900/70 px-5 py-4 print:bg-white">
                <h2 className="text-xl font-bold text-white md:text-2xl print:text-black">
                  {league}
                </h2>
                <p className="mt-1 text-sm text-zinc-400 print:text-black">
                  {items[0]?.league?.country || "País no disponible"} ·{" "}
                  {items.length} partido{items.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="overflow-auto">
                <table className="w-full min-w-[1600px] text-sm print:min-w-0">
                  <thead className="bg-black/30 print:bg-white">
                    <tr className="border-b border-zinc-800 text-left text-zinc-400 print:text-black">
                      <th className="px-4 py-3 font-semibold">Hora</th>
                      <th className="px-4 py-3 font-semibold">Partido</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold">Señal</th>
                      <th className="px-4 py-3 font-semibold">Pick</th>
                      <th className="px-4 py-3 font-semibold">Conf.</th>
                      <th className="px-4 py-3 font-semibold">Base</th>
                      <th className="px-4 py-3 font-semibold">Calidad</th>
                      <th className="px-4 py-3 font-semibold">PROMEDIO</th>
                      <th className="px-4 py-3 font-semibold">DESV. EST.</th>
                      <th className="px-4 py-3 font-semibold">RANGO</th>
                      <th className="px-4 py-3 font-semibold print:hidden">MEDIA EQUIPOS</th>
                      <th className="px-4 py-3 font-semibold print:hidden">RANGO EQUIPOS</th>
                      <th className="px-4 py-3 font-semibold print:hidden">DESV. EQUIPOS</th>
                      <th className="px-4 py-3 font-semibold">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((g, index) => {
                      const rowId = safeId(g.id);
                      const a = rowId ? analysisMap[rowId] : undefined;
                      const statusText = g.status?.short || g.status?.long || "-";
                      const live = isGameLive(g);
                      const done = isCompletedGame(g);
                      const isPendingAnalysis = a?.pick === "Analizando...";

                      const displayPromedio = getDisplayPromedio(a);
                      const displayDesviacion = getDisplayDesviacion(a);
                      const displayRango = getDisplayRango(a);

                      const base = sourceLabel(a?.debug?.source);
                      const calidad = sourceQuality(a?.debug?.source);

                      return (
                        <tr
                          key={rowId ?? `${league}-${index}`}
                          className={`border-b border-zinc-900/80 ${
                            index % 2 === 0 ? "bg-zinc-950/40" : "bg-black/10"
                          } print:bg-white`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-200 print:text-black">
                            {formatTimeEs(g.date)}
                          </td>

                          <td className="min-w-[220px] px-4 py-3">
                            <div className="font-semibold text-white print:text-black">
                              {g.teams?.home?.name || "Local"}{" "}
                              <span className="text-cyan-400 print:text-black">vs</span>{" "}
                              {g.teams?.away?.name || "Visitante"}
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                                live
                                  ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                                  : done
                                  ? "border-zinc-600 bg-zinc-800/70 text-zinc-200"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-200"
                              }`}
                            >
                              {statusText}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            {live || done ? (
                              <span className="inline-flex rounded-full border border-zinc-600 bg-zinc-800/70 px-3 py-1 text-xs font-semibold text-zinc-200">
                                -
                              </span>
                            ) : a ? (
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${signalBadgeClass(
                                  a.finalSignal
                                )}`}
                                title={a.finalReason}
                              >
                                {a.finalSignal}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            {live ? (
                              <span className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
                                En vivo
                              </span>
                            ) : done ? (
                              <span className="inline-flex rounded-full border border-zinc-600 bg-zinc-800/70 px-3 py-1 text-xs font-semibold text-zinc-200">
                                Finalizado
                              </span>
                            ) : (
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${pickBadgeClass(
                                  a?.pick
                                )}`}
                              >
                                {a?.pick || "-"}
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-cyan-300 print:text-black">
                            {live || done
                              ? "-"
                              : isPendingAnalysis
                              ? "..."
                              : a
                              ? `${a.confidence}%`
                              : "-"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-white print:text-black">
                            {live || done ? "-" : base}
                          </td>

                          <td className={`whitespace-nowrap px-4 py-3 font-bold ${qualityClass(calidad)} print:text-black`}>
                            {live || done ? "-" : calidad}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-zinc-200 print:text-black">
                            {!live && !done && displayPromedio !== undefined
                              ? displayPromedio.toFixed(1)
                              : "-"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-zinc-300 print:text-black">
                            {!live && !done && displayDesviacion !== undefined
                              ? displayDesviacion.toFixed(1)
                              : "-"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-zinc-300 print:text-black">
                            {!live && !done && displayRango !== undefined
                              ? displayRango.toFixed(1)
                              : "-"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-zinc-200 print:hidden">
                            {!live &&
                            !done &&
                            a?.expectedHome !== undefined &&
                            a?.expectedAway !== undefined
                              ? `${a.expectedHome.toFixed(1)} - ${a.expectedAway.toFixed(1)}`
                              : "-"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-zinc-300 print:hidden">
                            {!live && !done && a?.rangeHome && a?.rangeAway
                              ? `${a.rangeHome[0].toFixed(1)}–${a.rangeHome[1].toFixed(
                                  1
                                )} / ${a.rangeAway[0].toFixed(1)}–${a.rangeAway[1].toFixed(1)}`
                              : "-"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-zinc-300 print:hidden">
                            {!live &&
                            !done &&
                            a?.stdHome !== undefined &&
                            a?.stdAway !== undefined
                              ? `${a.stdHome.toFixed(1)} / ${a.stdAway.toFixed(1)}`
                              : "-"}
                          </td>

                          <td className="min-w-[320px] px-4 py-3 text-zinc-300 print:min-w-0 print:text-black">
                            {live
                              ? "Partido en vivo."
                              : done
                              ? "Partido finalizado."
                              : a
                              ? `${a.note} ${a.finalReason}`
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          html,
          body {
            background: #ffffff !important;
          }

          body {
            margin: 0 !important;
            color: #111827 !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }

          main {
            background: #ffffff !important;
            color: #111827 !important;
            min-height: auto !important;
          }

          button {
            display: none !important;
          }

          input {
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            color: #111827 !important;
          }

          h1 {
            color: #0f172a !important;
            font-size: 28px !important;
            font-weight: 800 !important;
          }

          h2 {
            color: #0f172a !important;
            font-size: 18px !important;
            font-weight: 800 !important;
          }

          p,
          span,
          div,
          label {
            color: #334155 !important;
          }

          .rounded-3xl,
          .rounded-2xl {
            background: #ffffff !important;
            border: 1px solid #dbeafe !important;
          }

          img {
            filter: none !important;
          }

          table {
            width: 100% !important;
            min-width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            background: #ffffff !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            page-break-inside: avoid !important;
          }

          th {
            background: #0f172a !important;
            color: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            font-size: 9px !important;
            font-weight: 700 !important;
            padding: 6px !important;
            text-align: left !important;
          }

          td {
            background: #ffffff !important;
            color: #111827 !important;
            border: 1px solid #cbd5e1 !important;
            font-size: 9px !important;
            padding: 6px !important;
            white-space: normal !important;
            word-break: break-word !important;
            vertical-align: top !important;
          }

          tbody tr:nth-child(even) td {
            background: #f8fafc !important;
          }

          section {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            page-break-inside: avoid !important;
            margin-bottom: 10px !important;
          }

          section > div:first-child {
            background: #e0f2fe !important;
            border-bottom: 1px solid #bae6fd !important;
          }

          section > div:first-child h2 {
            color: #0f172a !important;
          }

          section > div:first-child p {
            color: #475569 !important;
          }

          .inline-flex.rounded-full {
            border: 1px solid #94a3b8 !important;
            background: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 700 !important;
          }

          .text-cyan-400,
          .text-cyan-300 {
            color: #0369a1 !important;
            font-weight: 700 !important;
          }

          .text-zinc-300,
          .text-zinc-400,
          .text-zinc-500,
          .text-zinc-200,
          .text-white {
            color: #334155 !important;
          }

          .text-red-400 {
            color: #b91c1c !important;
          }

          .text-emerald-300 {
            color: #166534 !important;
          }
        }
      `}</style>
    </main>
  );
}