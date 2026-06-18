// lib/bets.ts
export type BetSide = "H" | "D" | "A";

export type Bet = {
  id: string;
  datetime: string;        // ISO
  fixtureId?: string;
  homeTeam: string;
  awayTeam: string;
  side: BetSide;           // H/D/A
  odds: number;
  prob: number;            // prob modelo 0..1
  fair: number;            // cuota justa del modelo
  valuePct: number;        // (prob*odds-1)*100
  stake: number;           // en €
  bookmaker?: string;
  leagueId?: number;
  season?: number;
  result?: "win" | "lose" | "void"; // opcional para marcar resultado
};

const KEY = "irvin-bets-v1";

export function loadBets(): Bet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveBets(bets: Bet[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(bets));
}

export function addBet(b: Bet) {
  const all = loadBets();
  all.unshift(b);
  saveBets(all);
  return all;
}

export function markResult(id: string, result: Bet["result"]) {
  const all = loadBets().map(b => b.id === id ? { ...b, result } : b);
  saveBets(all);
  return all;
}

export function roiSummary(bets: Bet[]) {
  // ROI simple: suma beneficios / suma stakes
  let st = 0, ret = 0;
  for (const b of bets) {
    st += b.stake;
    if (b.result === "win") ret += b.stake * b.odds;
    else if (b.result === "lose") ret += 0;
    else ret += b.stake; // void -> retorno stake
  }
  const pnl = ret - st;
  const roi = st > 0 ? pnl / st : 0;
  return { stakes: st, returns: ret, pnl, roi };
}
