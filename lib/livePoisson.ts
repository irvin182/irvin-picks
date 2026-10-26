export type LivePoissonInput = {
  homeScore: number | null;
  awayScore: number | null;
  minuteText: string;
  status?: string;
  homeShots?: number | null;
  awayShots?: number | null;
  homeShotsOn?: number | null;
  awayShotsOn?: number | null;
  homePossession?: string | number | null;
  awayPossession?: string | number | null;
  homeXg?: number | null;
  awayXg?: number | null;
  statisticsAgeSeconds?: number | null;
  fixtureAgeSeconds?: number | null;
  stale?: boolean;
};
export type DataQuality = "insuficiente" | "básica" | "intermedia" | "avanzada";
type Probability = number | null;
export type LivePoissonResult = {
  homeWin: Probability; draw: Probability; awayWin: Probability;
  over15: Probability; over25: Probability; over35: Probability;
  bttsYes: Probability; bttsNo: Probability;
  nextGoalHome: Probability; nextGoalDraw: Probability; nextGoalAway: Probability;
  firstHalfHomeWin: Probability; firstHalfDraw: Probability; firstHalfAwayWin: Probability;
  firstHalfXgHome: Probability; firstHalfXgAway: Probability; totalExpectedGoals: Probability;
  confidence: null; irvinScore: null; dangerIndex: null;
  next10Goal: Probability; next10Corner: null; next10Card: null;
  recommendation: string; valueLevel: "NO EVALUABLE"; aiSummary: string; aiDecisions: string[];
  dataQuality: DataQuality; missingMetrics: string[]; issues: string[];
  modelStatus: "no evaluable" | "estimación no calibrada" | "resultado observado";
  settled: string[];
};

function number(value: unknown, max = Infinity, allowPercent = false): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !(allowPercent ? /^\d+(\.\d+)?%?$/ : /^\d+(\.\d+)?$/).test(value.trim())) return null;
  const n = typeof value === "number" ? value : Number(value.trim().replace(/%$/, ""));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
function count(value: unknown) {
  const n = number(value);
  return n !== null && Number.isSafeInteger(n) ? n : null;
}

// Largest remainder rounding preserves a total of exactly 10000 basis points.
function percentages(weights: number[]) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  const exact = weights.map(value => value / total * 10000);
  const units = exact.map(Math.floor);
  const order = exact.map((value, index) => ({index, remainder: value - units[index]})).sort((a,b) => b.remainder - a.remainder);
  const left = 10000 - units.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < left; i++) units[order[i].index]++;
  return units.map(value => value / 100);
}
function binary(p: number) { return percentages([Math.max(0, Math.min(1, p)), Math.max(0, Math.min(1, 1-p))]); }
function poisson(lambda: number) {
  const mass = [Math.exp(-lambda)];
  let sum = mass[0];
  for (let k = 1; 1-sum > 1e-12 && k < 256; k++) {mass.push(mass[k-1] * lambda/k); sum += mass[k];}
  return mass.map(value => value/sum);
}
function resultProbabilities(home: number, away: number, homeLambda: number, awayLambda: number) {
  const outcomes = [0,0,0];
  const homeMass = poisson(homeLambda), awayMass = poisson(awayLambda);
  homeMass.forEach((hp,h) => awayMass.forEach((ap,a) => {outcomes[home+h > away+a ? 0 : home+h === away+a ? 1 : 2] += hp*ap;}));
  return percentages(outcomes);
}

export function calculateLivePoisson(input: LivePoissonInput): LivePoissonResult {
  const home = count(input.homeScore), away = count(input.awayScore);
  const status = input.status ?? input.minuteText;
  const minute = status === "HT" ? 45 : status === "FT" ? 90 : number(input.minuteText.replace(/'$/, ""), 90);
  const supported = ["1H","HT","2H","FT"].includes(status) &&
    (status !== "1H" || (minute !== null && minute <= 45)) &&
    (status !== "2H" || (minute !== null && minute >= 45));
  const fixtureFresh = typeof input.fixtureAgeSeconds === "number" && Number.isFinite(input.fixtureAgeSeconds) && input.fixtureAgeSeconds >= 0 && input.fixtureAgeSeconds <= 300;
  const base = fixtureFresh && home !== null && away !== null && minute !== null && supported && !input.stale;
  const metrics = {
    homeShots: count(input.homeShots), awayShots: count(input.awayShots),
    homeShotsOn: count(input.homeShotsOn), awayShotsOn: count(input.awayShotsOn),
    homePossession: number(input.homePossession, 100, true), awayPossession: number(input.awayPossession, 100, true),
    homeXg: number(input.homeXg), awayXg: number(input.awayXg),
  };
  const missingMetrics = Object.entries(metrics).filter(([,value]) => value === null).map(([key]) => key);
  const issues: string[] = [];
  if (!base) issues.push("Marcador, minuto o estado insuficiente, no compatible o captura desactualizada.");
  for (const side of ["home","away"] as const) {
    const shots = metrics[`${side}Shots`], on = metrics[`${side}ShotsOn`];
    const xg = metrics[`${side}Xg`];
    if (shots !== null && xg !== null && xg > shots + 1e-6) issues.push("xG incompatible con los tiros totales recibidos.");
    if (shots !== null && on !== null && on > shots) issues.push("Los tiros a puerta superan los tiros totales.");
  }
  if (metrics.homePossession !== null && metrics.awayPossession !== null && Math.abs(metrics.homePossession + metrics.awayPossession - 100) > 1) issues.push("Posesión incoherente entre equipos.");
  const fresh = typeof input.statisticsAgeSeconds === "number" && Number.isFinite(input.statisticsAgeSeconds) && input.statisticsAgeSeconds >= 0 && input.statisticsAgeSeconds <= 600;
  if (fresh && fixtureFresh && Math.abs(input.statisticsAgeSeconds! - input.fixtureAgeSeconds!) > 60) issues.push("Las capturas del marcador y las estadísticas están separadas por más de un minuto.");
  if (!fresh) issues.push("Antigüedad de las estadísticas desconocida o superior a diez minutos.");
  const quality: DataQuality = !base ? "insuficiente" : missingMetrics.length === 8 ? "básica" : !missingMetrics.length && !issues.length ? "avanzada" : "intermedia";
  const result: LivePoissonResult = {
    homeWin:null,draw:null,awayWin:null,over15:null,over25:null,over35:null,bttsYes:null,bttsNo:null,
    nextGoalHome:null,nextGoalDraw:null,nextGoalAway:null,firstHalfHomeWin:null,firstHalfDraw:null,firstHalfAwayWin:null,
    firstHalfXgHome:null,firstHalfXgAway:null,totalExpectedGoals:null,confidence:null,irvinScore:null,dangerIndex:null,
    next10Goal:null,next10Corner:null,next10Card:null,recommendation:"SIN RECOMENDACIÓN VALIDADA",valueLevel:"NO EVALUABLE",
    aiSummary:"Confianza no evaluable: falta validación histórica fuera de muestra.", aiDecisions:[],
    dataQuality:quality,missingMetrics,issues,modelStatus:"no evaluable",settled:[],
  };
  if (!base || home === null || away === null || minute === null) return result;
  const goals = home+away;
  for (const [key, threshold] of [["over15",1.5],["over25",2.5],["over35",3.5]] as const) {
    if (goals > threshold || status === "FT") {result[key] = goals > threshold ? 100 : 0; result.settled.push(key);}
  }
  if ((home > 0 && away > 0) || status === "FT") {
    result.bttsYes = home > 0 && away > 0 ? 100 : 0; result.bttsNo = 100-result.bttsYes; result.settled.push("btts");
  }
  if (status === "HT") {
    [result.firstHalfHomeWin,result.firstHalfDraw,result.firstHalfAwayWin] = home > away ? [100,0,0] : home === away ? [0,100,0] : [0,0,100];
    result.settled.push("firstHalf");
  }
  if (status === "FT") {
    [result.homeWin,result.draw,result.awayWin] = home > away ? [100,0,0] : home === away ? [0,100,0] : [0,0,100];
    [result.nextGoalHome,result.nextGoalDraw,result.nextGoalAway] = [0,100,0];
    result.modelStatus = "resultado observado"; result.settled.push("result","nextGoal"); return result;
  }
  // Phase 1 uses no invented shot-to-goal weights or historical priors. Zero observed xG is not a zero future rate.
  if (quality !== "avanzada" || minute < 15 || minute >= 90 || !metrics.homeXg || !metrics.awayXg) {
    result.issues.push("No se estima sin cobertura completa, xG positivos de ambos equipos y al menos 15 minutos reglamentarios.");
    return result;
  }
  const remaining = 90-minute;
  const homeRate = metrics.homeXg/minute, awayRate = metrics.awayXg/minute;
  const hl = homeRate*remaining, al = awayRate*remaining, lambda = hl+al;
  if (!Number.isFinite(lambda) || lambda <= 0 || lambda > 20) {result.issues.push("Intensidad fuera del dominio numérico admitido."); return result;}
  result.modelStatus = "estimación no calibrada";
  [result.homeWin,result.draw,result.awayWin] = resultProbabilities(home,away,hl,al);
  const mass = poisson(lambda);
  for (const [key,threshold] of [["over15",1.5],["over25",2.5],["over35",3.5]] as const) {
    result[key] = binary(1-mass.slice(0,Math.max(0,Math.floor(threshold)-goals+1)).reduce((sum,p)=>sum+p,0))[0];
  }
  const yes = (home > 0 ? 1 : 1-Math.exp(-hl)) * (away > 0 ? 1 : 1-Math.exp(-al));
  [result.bttsYes,result.bttsNo] = binary(yes);
  const noGoal = Math.exp(-lambda);
  [result.nextGoalHome,result.nextGoalDraw,result.nextGoalAway] = percentages([(1-noGoal)*hl/lambda,noGoal,(1-noGoal)*al/lambda]);
  result.next10Goal = binary(1-Math.exp(-(homeRate+awayRate)*Math.min(10,remaining)))[0];
  result.totalExpectedGoals = Number((goals+lambda).toFixed(3));
  if (minute < 45) {
    const firstHome = homeRate*(45-minute), firstAway = awayRate*(45-minute);
    [result.firstHalfHomeWin,result.firstHalfDraw,result.firstHalfAwayWin] = resultProbabilities(home,away,firstHome,firstAway);
    result.firstHalfXgHome = firstHome; result.firstHalfXgAway = firstAway;
  }
  result.aiDecisions = ["Estimación exploratoria Poisson a 90 minutos; excluye añadido y prórroga.",
    "Supone independencia y ritmo futuro constante a partir del xG acumulado del proveedor.",
    "Calidad de datos avanzada no significa confianza predictiva alta.",
    "Sin calibración histórica no se evalúan confianza, valor, riesgo, córners ni tarjetas."];
  result.aiSummary = "Probabilidades estimadas, no calibradas. Confianza no evaluable. Los xG del proveedor son estimaciones de su propio modelo.";
  return result;
}
