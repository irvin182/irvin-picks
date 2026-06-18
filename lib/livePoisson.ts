export type LivePoissonInput = {
  homeScore: number;
  awayScore: number;
  minuteText: string;
  homeShots: number;
  awayShots: number;
  homeShotsOn: number;
  awayShotsOn: number;
  homePossession: string | number;
  awayPossession: string | number;
};

export type LivePoissonResult = {
  homeWin: number;
  draw: number;
  awayWin: number;

  over15: number;
  over25: number;
  over35: number;

  bttsYes: number;
  bttsNo: number;

  nextGoalHome: number;
  nextGoalDraw: number;
  nextGoalAway: number;

  firstHalfHomeWin: number;
  firstHalfDraw: number;
  firstHalfAwayWin: number;

  firstHalfXgHome: number;
  firstHalfXgAway: number;
  totalExpectedGoals: number;

  recommendation: string;
  confidence: number;
  irvinScore: number;
  aiDecisions: string[];

  aiSummary: string;
  dangerIndex: number;
  valueLevel: "SIN VALOR" | "BAJO" | "MEDIO" | "ALTO" | "MUY ALTO";
  next10Goal: number;
  next10Corner: number;
  next10Card: number;
};

function parseMinute(minuteText: string) {
  const n = Number(String(minuteText).replace("'", ""));
  return Number.isFinite(n) ? Math.max(1, Math.min(90, n)) : 1;
}

function parsePercent(value: string | number) {
  if (typeof value === "number") return value;
  const n = Number(value.replace("%", ""));
  return Number.isFinite(n) ? n : 50;
}

function clamp(n: number, min = 1, max = 98) {
  return Math.max(min, Math.min(max, n));
}

function valueLevelFromScore(score: number): LivePoissonResult["valueLevel"] {
  if (score >= 88) return "MUY ALTO";
  if (score >= 75) return "ALTO";
  if (score >= 62) return "MEDIO";
  if (score >= 48) return "BAJO";
  return "SIN VALOR";
}

export function calculateLivePoisson(input: LivePoissonInput): LivePoissonResult {
  const minute = parseMinute(input.minuteText);
  const remaining = Math.max(1, 90 - minute);
  const firstHalfRemaining = Math.max(0, 45 - minute);

  const currentGoals = input.homeScore + input.awayScore;
  const totalShots = input.homeShots + input.awayShots;
  const totalShotsOn = input.homeShotsOn + input.awayShotsOn;
  const hasAdvancedStats = totalShots > 0 || totalShotsOn > 0;

  const homePoss = parsePercent(input.homePossession);
  const awayPoss = parsePercent(input.awayPossession);

  const homePressure =
    input.homeShots * 0.75 +
    input.homeShotsOn * 1.6 +
    homePoss * 0.03 +
    input.homeScore * 1.4;

  const awayPressure =
    input.awayShots * 0.75 +
    input.awayShotsOn * 1.6 +
    awayPoss * 0.03 +
    input.awayScore * 1.4;

  const totalPressure = Math.max(1, homePressure + awayPressure);
  const homeStrength = homePressure / totalPressure;
  const awayStrength = awayPressure / totalPressure;
  const scoreDiff = input.homeScore - input.awayScore;

  let homeWin =
    33 +
    homeStrength * 35 -
    awayStrength * 15 +
    scoreDiff * (minute > 60 ? 18 : 12);

  let awayWin =
    33 +
    awayStrength * 35 -
    homeStrength * 15 -
    scoreDiff * (minute > 60 ? 18 : 12);

  let draw = 100 - homeWin - awayWin;

  homeWin = clamp(homeWin, 1, 95);
  awayWin = clamp(awayWin, 1, 95);
  draw = clamp(draw, 1, 95);

  if (scoreDiff >= 4 && minute > 55) {
    homeWin = 95;
    draw = 3;
    awayWin = 2;
  }

  if (scoreDiff <= -4 && minute > 55) {
    homeWin = 2;
    draw = 3;
    awayWin = 95;
  }

  const total = homeWin + draw + awayWin;

  homeWin = Math.round((homeWin / total) * 100);
  draw = Math.round((draw / total) * 100);
  awayWin = 100 - homeWin - draw;

  const tempo =
    (input.homeShots +
      input.awayShots +
      input.homeShotsOn * 2 +
      input.awayShotsOn * 2) /
    Math.max(1, minute);

  const homeTempo =
    (input.homeShots + input.homeShotsOn * 2 + homePoss * 0.03) /
    Math.max(1, minute);

  const awayTempo =
    (input.awayShots + input.awayShotsOn * 2 + awayPoss * 0.03) /
    Math.max(1, minute);

  const projectedHomeGoals = input.homeScore + homeTempo * remaining * 0.12;
  const projectedAwayGoals = input.awayScore + awayTempo * remaining * 0.12;

  const totalExpectedGoals = Number(
    (projectedHomeGoals + projectedAwayGoals).toFixed(2)
  );

  const firstHalfXgHome =
    minute <= 45
      ? Number((homeTempo * firstHalfRemaining * 0.12).toFixed(2))
      : 0;

  const firstHalfXgAway =
    minute <= 45
      ? Number((awayTempo * firstHalfRemaining * 0.12).toFixed(2))
      : 0;

  const firstHalfDiff = input.homeScore - input.awayScore;

  let firstHalfHomeWin =
    minute > 45
      ? input.homeScore > input.awayScore
        ? 95
        : 2
      : 30 + homeStrength * 35 + firstHalfDiff * 20;

  let firstHalfAwayWin =
    minute > 45
      ? input.awayScore > input.homeScore
        ? 95
        : 2
      : 30 + awayStrength * 35 - firstHalfDiff * 20;

  let firstHalfDraw =
    minute > 45
      ? input.homeScore === input.awayScore
        ? 95
        : 3
      : 100 - firstHalfHomeWin - firstHalfAwayWin;

  if (firstHalfDraw < 8 && minute <= 45) firstHalfDraw = 8;

  const firstHalfTotal = firstHalfHomeWin + firstHalfDraw + firstHalfAwayWin;

  firstHalfHomeWin = Math.round((firstHalfHomeWin / firstHalfTotal) * 100);
  firstHalfDraw = Math.round((firstHalfDraw / firstHalfTotal) * 100);
  firstHalfAwayWin = 100 - firstHalfHomeWin - firstHalfDraw;

  const goalExpectation = currentGoals + tempo * remaining * 0.18;

  let over15 = clamp(Math.round(goalExpectation * 35 + currentGoals * 15), 5, 95);
  let over25 = clamp(Math.round(goalExpectation * 26 + currentGoals * 10 - 10), 3, 92);
  let over35 = clamp(Math.round(goalExpectation * 18 + currentGoals * 7 - 18), 2, 85);

  if (!hasAdvancedStats && currentGoals === 0) {
    over15 = clamp(over15 - 10, 5, 85);
    over25 = clamp(over25 - 12, 3, 75);
    over35 = clamp(over35 - 10, 2, 60);
  }

  if (!hasAdvancedStats && currentGoals >= 1) {
    over15 = clamp(over15 + 10, 5, 95);
    over25 = clamp(over25 + 6, 3, 92);
  }

  const bttsBase =
    input.homeScore > 0 && input.awayScore > 0
      ? 92
      : input.homeScore > 0 || input.awayScore > 0
      ? 48 + Math.round(Math.min(homePressure, awayPressure) * 4)
      : 35 + Math.round(Math.min(homePressure, awayPressure) * 3);

  const bttsYes = clamp(bttsBase, 8, 94);
  const bttsNo = 100 - bttsYes;

  const nextGoalHome = clamp(Math.round(homeStrength * 70 + 10), 5, 80);
  const nextGoalAway = clamp(Math.round(awayStrength * 70 + 10), 5, 80);
  const nextGoalDraw = Math.max(5, 100 - nextGoalHome - nextGoalAway);

  const dangerIndex = clamp(
    Math.round(
      tempo * 120 +
        totalShotsOn * 7 +
        totalShots * 2.5 +
        currentGoals * 8 +
        (minute > 60 ? 8 : 0)
    ),
    1,
    100
  );

  const next10Goal = clamp(
    Math.round(dangerIndex * 0.55 + Math.max(nextGoalHome, nextGoalAway) * 0.35),
    5,
    88
  );

  const next10Corner = clamp(
    Math.round(totalShots * 4 + tempo * 80 + (hasAdvancedStats ? 10 : 0)),
    5,
    82
  );

  const next10Card = clamp(
    Math.round(12 + minute * 0.18 + (scoreDiff !== 0 ? 8 : 0)),
    5,
    72
  );

  let recommendation = "ESPERAR";
  let confidence = 55;

  if (over15 >= 72 && dangerIndex >= 45) {
    recommendation = "OVER 1.5 GOLES";
    confidence = Math.max(over15, dangerIndex);
  }

  if (over25 >= 70 && dangerIndex >= 58) {
    recommendation = "OVER 2.5 GOLES";
    confidence = Math.max(over25, dangerIndex);
  }

  if (over35 >= 68 && dangerIndex >= 70) {
    recommendation = "OVER 3.5 GOLES";
    confidence = Math.max(over35, dangerIndex);
  }

  if (minute <= 45 && firstHalfXgHome + firstHalfXgAway >= 0.65) {
    recommendation = "GOL 1ª MITAD";
    confidence = clamp(
      Math.round((firstHalfXgHome + firstHalfXgAway) * 80),
      55,
      88
    );
  }

  if (minute > 70 && currentGoals <= 1 && dangerIndex < 45) {
    recommendation = "UNDER 2.5 GOLES";
    confidence = clamp(88 - currentGoals * 10, 60, 92);
  }

  let irvinScore = 35;

  irvinScore += confidence * 0.18;
  irvinScore += Math.abs(homeWin - awayWin) * 0.16;
  irvinScore += over25 * 0.1;
  irvinScore += over35 * 0.06;
  irvinScore += Math.max(nextGoalHome, nextGoalAway) * 0.08;
  irvinScore += bttsYes * 0.05;
  irvinScore += dangerIndex * 0.14;
  irvinScore += Math.min(currentGoals, 5) * 3;

  if (minute < 20) irvinScore -= 12;
  if (minute < 10) irvinScore -= 8;
  if (!hasAdvancedStats && currentGoals === 0) irvinScore -= 12;
  if (!hasAdvancedStats && currentGoals > 0) irvinScore -= 4;

  irvinScore = Math.round(clamp(irvinScore, 0, 97));

  const valueLevel = valueLevelFromScore(irvinScore);
  const aiDecisions: string[] = [];

  if (!hasAdvancedStats) {
    aiDecisions.push("🟡 Modo básico: la liga no entrega tiros ni xG avanzados.");
  }

  if (dangerIndex >= 75) {
    aiDecisions.push("🔥 Peligro alto de gol: el partido tiene señales ofensivas fuertes.");
  } else if (dangerIndex >= 50) {
    aiDecisions.push("🟡 Peligro medio: hay actividad, pero falta confirmación.");
  } else {
    aiDecisions.push("⚪ Peligro bajo: no hay suficiente presión ofensiva.");
  }

  if (over15 >= 70) {
    aiDecisions.push("🟢 Over 1.5 tiene buena proyección.");
  } else {
    aiDecisions.push("⚪ Over 1.5 todavía no tiene fuerza suficiente.");
  }

  if (over25 >= 65 && dangerIndex >= 55) {
    aiDecisions.push("🔥 Over 2.5 puede tener valor si el ritmo continúa.");
  } else {
    aiDecisions.push("🚫 Evitar Over 2.5 por ahora.");
  }

  if (nextGoalDraw >= 65) {
    aiDecisions.push("⏳ Alta probabilidad de que no haya gol inmediato.");
  } else if (nextGoalHome > nextGoalAway) {
    aiDecisions.push("🟢 Próximo gol más probable: local.");
  } else {
    aiDecisions.push("🔵 Próximo gol más probable: visitante.");
  }

  if (bttsYes >= 60) {
    aiDecisions.push("🟢 Ambos anotan tiene valor estadístico.");
  } else {
    aiDecisions.push("🔴 Ambos anotan no es fuerte ahora.");
  }

  aiDecisions.push(`⚽ Próximos 10 minutos: gol ${next10Goal}%.`);
  aiDecisions.push(`🚩 Próximos 10 minutos: córner ${next10Corner}%.`);
  aiDecisions.push(`🟨 Próximos 10 minutos: tarjeta ${next10Card}%.`);

  if (irvinScore >= 85) {
    aiDecisions.push("💎 Señal fuerte: oportunidad clara.");
  } else if (irvinScore >= 65) {
    aiDecisions.push("🟡 Señal moderada: entrar con cautela.");
  } else {
    aiDecisions.push("⚠️ Mejor esperar confirmación.");
  }

  const aiSummary =
    recommendation === "ESPERAR"
      ? hasAdvancedStats
        ? `La IA recomienda esperar porque el partido todavía no muestra suficiente valor. El peligro de gol está en ${dangerIndex}/100 y el nivel de valor es ${valueLevel}.`
        : `La IA recomienda esperar porque esta liga está en modo básico. La lectura se basa en marcador, minuto y eventos, con peligro estimado de ${dangerIndex}/100.`
      : `La IA recomienda ${recommendation} con confianza ${confidence}%. El peligro de gol está en ${dangerIndex}/100 y el nivel de valor detectado es ${valueLevel}.`;

  return {
    homeWin,
    draw,
    awayWin,
    over15,
    over25,
    over35,
    bttsYes,
    bttsNo,
    nextGoalHome,
    nextGoalDraw,
    nextGoalAway,
    firstHalfHomeWin,
    firstHalfDraw,
    firstHalfAwayWin,
    firstHalfXgHome,
    firstHalfXgAway,
    totalExpectedGoals,
    recommendation,
    confidence,
    irvinScore,
    aiDecisions,
    aiSummary,
    dangerIndex,
    valueLevel,
    next10Goal,
    next10Corner,
    next10Card,
  };
}