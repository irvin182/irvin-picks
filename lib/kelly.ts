// lib/kelly.ts
export function fairFromProb(p: number) {
  return p > 0 ? 1 / p : Infinity;
}

/** Kelly clásica; kellyFraction=0.5 => medio Kelly (recomendado) */
export function kelly(p: number, odds: number, kellyFraction = 0.5) {
  if (!odds || odds <= 1 || p <= 0 || p >= 1) return 0;
  const edge = p * (odds - 1) - (1 - p);
  const denom = odds - 1;
  const k = edge / denom;
  return Math.max(0, k * kellyFraction); // nunca negativo
}

/** Sugerencia de stake en € según bankroll */
export function suggestStakeEUR(bankroll: number, p: number, odds: number, kellyFraction = 0.5) {
  const fr = kelly(p, odds, kellyFraction);
  return Math.max(0, Number((bankroll * fr).toFixed(2)));
}
