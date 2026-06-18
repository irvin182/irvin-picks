// lib/irvinFilter.ts
import { getLeagueSettings } from "./leagueConfig";

export type MatchStats = {
  pOver15: number;   // 0–1 o 0–100, ahora lo ajustamos
  pOver25: number;
  pBTTS: number;
  lambdaHome: number;
  lambdaAway: number;
  samples?: number;
};

export type MatchOdds = {
  over15: number;
  over25: number;
  btts: number;
};

export type EvaluationResult = {
  status: "GREEN" | "YELLOW" | "RED";
  recommendedBet: "OVER_15" | "OVER_25" | "BTTS" | "NO_BET";
  reason: string;
  pO15_adj: number;
  pO25_adj: number;
  pBTTS_adj: number;
  EV_O15: number;
  EV_O25: number;
  EV_BTTS: number;
  lambdaTotal: number;
};

function toProb(x: number): number {
  // Si viene como 87.3 lo paso a 0.873
  if (x > 1) return x / 100;
  return x;
}

function adjustProb(pRaw: number, leagueName: string): number {
  const league = getLeagueSettings(leagueName);
  const p = toProb(pRaw);
  const pAdj = p * league.goalFactor * league.reliability;
  return Math.max(0, Math.min(1, pAdj));
}

function calcEV(pAdj: number, odds: number): number {
  return pAdj * (odds - 1) - (1 - pAdj);
}

export function evaluateMatch(
  match: MatchStats,
  odds: MatchOdds,
  leagueName: string,
): EvaluationResult {
  const league = getLeagueSettings(leagueName);

  if (league.banned) {
    return {
      status: "RED",
      recommendedBet: "NO_BET",
      reason: "Liga marcada como poco fiable (reservas/under/irregular).",
      pO15_adj: 0,
      pO25_adj: 0,
      pBTTS_adj: 0,
      EV_O15: 0,
      EV_O25: 0,
      EV_BTTS: 0,
      lambdaTotal: match.lambdaHome + match.lambdaAway,
    };
  }

  if (match.samples !== undefined && match.samples < 8) {
    return {
      status: "RED",
      recommendedBet: "NO_BET",
      reason: "Demasiado pocos partidos históricos (< 8).",
      pO15_adj: 0,
      pO25_adj: 0,
      pBTTS_adj: 0,
      EV_O15: 0,
      EV_O25: 0,
      EV_BTTS: 0,
      lambdaTotal: match.lambdaHome + match.lambdaAway,
    };
  }

  const pO15_adj  = adjustProb(match.pOver15, leagueName);
  const pO25_adj  = adjustProb(match.pOver25, leagueName);
  const pBTTS_adj = adjustProb(match.pBTTS, leagueName);
  const lambdaTotal = match.lambdaHome + match.lambdaAway;

  const EV_O15  = calcEV(pO15_adj, odds.over15);
  const EV_O25  = calcEV(pO25_adj, odds.over25);
  const EV_BTTS = calcEV(pBTTS_adj, odds.btts);

  // Reglas PRO
  const canOver25 =
    pO25_adj   >= 0.80 &&
    EV_O25     >  0   &&
    lambdaTotal >= 2.9 &&
    pBTTS_adj  >= 0.65 &&
    odds.over25 <= 1.70;

  const canOver15 =
    pO15_adj   >= 0.88 &&
    EV_O15     >= -0.02 &&
    lambdaTotal >= 2.4 &&
    odds.over15 <= 1.35;

  const canBTTS =
    pBTTS_adj  >= 0.68 &&
    EV_BTTS    >  0   &&
    lambdaTotal >= 2.6 &&
    match.lambdaHome >= 1.1 &&
    match.lambdaAway >= 1.0;

  let status: EvaluationResult["status"] = "RED";
  let recommendedBet: EvaluationResult["recommendedBet"] = "NO_BET";
  const notes: string[] = [];

  if (canOver25) {
    recommendedBet = "OVER_25";
    status = "GREEN";
    notes.push("Alta probabilidad de 3+ goles y EV positivo.");
  } else if (canOver15) {
    recommendedBet = "OVER_15";
    status = EV_O15 > 0 ? "GREEN" : "YELLOW";
    notes.push("Mercado seguro según tu histórico.");
  } else if (canBTTS) {
    recommendedBet = "BTTS";
    status = "GREEN";
    notes.push("Ambos equipos con buen potencial de gol.");
  } else {
    status = "RED";
    notes.push("El modelo no ve suficiente valor o el partido es muy incierto.");
  }

  return {
    status,
    recommendedBet,
    reason: notes.join(" "),
    pO15_adj,
    pO25_adj,
    pBTTS_adj,
    EV_O15,
    EV_O25,
    EV_BTTS,
    lambdaTotal,
  };
}
