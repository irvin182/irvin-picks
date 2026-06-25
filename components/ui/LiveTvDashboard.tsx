"use client";

import React, { useEffect, useMemo, useState } from "react";
import { calculateLivePoisson } from "@/lib/livePoisson";

type Match = {
  id: number;
  minuteNumber: number;
  half: string;
  league: string;
  country: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  homeFlag: string;
  awayFlag: string;
  apiUpdatedAt: number;
};

function mapApiFixtureToMatch(fx: any): Match {
  return {
    id: fx.fixture?.id,
    minuteNumber: fx.fixture?.status?.elapsed ?? 0,
    half: fx.fixture?.status?.short ?? "LIVE",
    league: fx.league?.name ?? "Liga",
    country: fx.league?.country ?? "World",
    home: fx.teams?.home?.name ?? "Local",
    away: fx.teams?.away?.name ?? "Visitante",
    homeScore: fx.goals?.home ?? 0,
    awayScore: fx.goals?.away ?? 0,
    homeFlag: fx.teams?.home?.logo ?? "",
    awayFlag: fx.teams?.away?.logo ?? "",
    apiUpdatedAt: Date.now(),
  };
}

function getStat(stats: any[], teamName: string, statName: string) {
  const team = stats.find((s) => s.team?.name === teamName);
  const stat = team?.statistics?.find((x: any) => x.type === statName);
  return stat?.value ?? 0;
}

function toNumber(value: any) {
  return Number(String(value).replace("%", "")) || 0;
}

function getLiveMinute(match: Match, tick: number) {
  if (match.half === "HT") return "HT";
  if (match.half === "FT") return "FT";
  const secondsPassed = Math.floor((tick - match.apiUpdatedAt) / 1000);
  const extraMinutes = Math.floor(secondsPassed / 60);
  return `${Math.min(match.minuteNumber + extraMinutes, 90)}'`;
}

function eventIcon(type: string) {
  if (type === "Goal") return "⚽";
  if (type === "Card") return "🟨";
  if (type === "subst") return "🔁";
  return "•";
}

export default function LiveTvDashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [fixtureStats, setFixtureStats] = useState<any[]>([]);
  const [fixtureEvents, setFixtureEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(Date.now());
  const [lastUpdate, setLastUpdate] = useState("--:--:--");

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  async function loadLive() {
    try {
      const res = await fetch(`/api/live?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();

      const liveGames = Array.isArray(data.response)
        ? data.response.map(mapApiFixtureToMatch)
        : [];

      setMatches(liveGames);

      if (liveGames.length > 0) {
        setSelected((current) => {
          if (!current) return liveGames[0];
          return liveGames.find((m: Match) => m.id === current.id) ?? liveGames[0];
        });
      } else {
        setSelected(null);
      }

      setLastUpdate(new Date().toLocaleTimeString());
      setLoading(false);
    } catch (error) {
      console.error("loadLive dashboard", error);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLive();
    const interval = setInterval(loadLive, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selected) return;

    async function loadFixtureDetails() {
      try {
        const res = await fetch(`/api/fixture?id=${selectedMatch.id}&t=${Date.now()}`, {
          cache: "no-store",
        });

        const data = await res.json();
        setFixtureStats(data.statistics ?? []);
        setFixtureEvents(data.events ?? []);
      } catch (error) {
        console.error("fixture dashboard", error);
      }
    }

    loadFixtureDetails();
    const interval = setInterval(loadFixtureDetails, 300000);
    return () => clearInterval(interval);
  }, [selected?.id]);

  const selectedMatch = selected ?? matches[0] ?? null;

  if (!selectedMatch) {
    return (
      <main className="min-h-[100dvh] bg-[#03070b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl font-black text-green-400">IRVIN ANALYTICS</div>
          <div className="mt-4 text-white/50">
            {loading ? "Cargando partidos..." : "No hay partidos en vivo"}
          </div>
        </div>
      </main>
    );
  }

  const homeShots = getStat(fixtureStats, selectedMatch.home, "Total Shots");
  const awayShots = getStat(fixtureStats, selectedMatch.away, "Total Shots");
  const homeShotsOn = getStat(fixtureStats, selectedMatch.home, "Shots on Goal");
  const awayShotsOn = getStat(fixtureStats, selectedMatch.away, "Shots on Goal");
  const homePossession = getStat(fixtureStats, selectedMatch.home, "Ball Possession") || "50%";
  const awayPossession = getStat(fixtureStats, selectedMatch.away, "Ball Possession") || "50%";
  const homeXg = getStat(fixtureStats, selectedMatch.home, "expected_goals");
  const awayXg = getStat(fixtureStats, selectedMatch.away, "expected_goals");

  const prediction: any = calculateLivePoisson({
    homeScore: selectedMatch.homeScore,
    awayScore: selectedMatch.awayScore,
    minuteText: getLiveMinute(selectedMatch, tick),
    homeShots,
    awayShots,
    homeShotsOn,
    awayShotsOn,
    homePossession,
    awayPossession,
  });

  const bttsYes = prediction.bttsYes ?? prediction.btts ?? 0;
  const bttsNo = prediction.bttsNo ?? 100 - bttsYes;

  const actionText =
    prediction.irvinScore >= 85 ? "ENTRAR" :
    prediction.irvinScore >= 65 ? "OBSERVAR" : "NO ENTRAR";

  const riskText =
    prediction.confidence >= 80 ? "BAJO" :
    prediction.confidence >= 60 ? "MEDIO" : "SIN VALOR";

  const hasStats = fixtureStats.length > 0;

  return (
    <main className="h-[100dvh] bg-[#03070b] text-white overflow-hidden p-3">
      <div className="h-full grid grid-rows-[70px_1fr_34px] gap-3">
        <header className="rounded-2xl bg-[#07111c] border border-white/10 px-5 py-3 grid grid-cols-[300px_1fr_260px] items-center shadow-[0_0_30px_rgba(0,255,120,.08)]">
          <div className="flex items-center gap-5">
            <div>
             <div className="text-3xl font-black tracking-[0.28em]">IRVIN</div>
              <div className="text-green-400 text-xs font-black tracking-[0.55em]">
                ANALYTICS
              </div>
            </div>

            <div>
              <div className="text-2xl font-black tracking-tight">IRVIN ANALYTICS</div>
<div className="text-xl font-black text-white/70">PRO TERMINAL</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8">
            <Badge value="● EN VIVO" />
            <Badge value={hasStats ? "MODO PRO" : "MODO BÁSICO"} yellow={!hasStats} />
            <div className="text-center">
              <div className="text-5xl font-black text-green-400">{matches.length}</div>
              <div className="text-sm font-black text-white/70">PARTIDOS EN VIVO</div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-4xl font-black">{lastUpdate}</div>
            <div className="text-white/50">Actualización automática</div>
          </div>
        </header>

        <section className="grid grid-cols-[250px_1fr_310px] gap-3 min-h-0">
          <aside className="rounded-2xl bg-[#07111c] border border-white/10 p-3 min-h-0 overflow-y-auto">
            <div className="text-2xl font-black mb-4">PARTIDOS EN VIVO</div>

            <div className="space-y-3">
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={`w-full rounded-xl p-3 text-left border ${
                    selectedMatch.id === m.id
                      ? "bg-green-500/15 border-green-400/50"
                      : "bg-white/5 border-white/5"
                  }`}
                >
                  <div className="flex justify-between">
                    <div className="text-green-400 font-black text-2xl">
                      {getLiveMinute(m, tick)}
                    </div>
                    <div className="font-black text-xl">
                      {m.homeScore}-{m.awayScore}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-[22px_1fr] gap-2 items-center">
                    {m.homeFlag ? <img src={m.homeFlag} className="w-5 h-5 object-contain" alt="" /> : <span />}
                    <div className="font-bold truncate">{m.home}</div>
                    {m.awayFlag ? <img src={m.awayFlag} className="w-5 h-5 object-contain" alt="" /> : <span />}
                    <div className="font-bold truncate text-white/60">{m.away}</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-2xl bg-[#07111c] border border-white/10 p-3 min-h-0 overflow-hidden">
            <ScoreBoard
              match={selectedMatch}
              minute={getLiveMinute(selectedMatch, tick)}
              prediction={prediction}
            />

            <div className="grid grid-cols-3 gap-2 mt-3">
              <MetricCard title="GOLES ESPERADOS (xG)" value={homeXg || awayXg ? `${homeXg} - ${awayXg}` : "xG no disponible"} />
              <MetricCard title="POSESIÓN" value={`${homePossession} / ${awayPossession}`} />
              <MetricCard title="TIROS TOTALES" value={`${homeShots} - ${awayShots}`} />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <MarketCard title="PRÓXIMO GOL">
                <div className="grid grid-cols-3 text-center items-end">
                  <div>
                    <div className="text-green-400 font-black truncate">{selectedMatch.home}</div>
                    <div className="text-4xl font-black text-green-400">{prediction.nextGoalHome}%</div>
                  </div>
                  <div>
                    <div className="text-white/50 font-black">SIN GOL</div>
                    <div className="text-4xl font-black">{prediction.nextGoalDraw}%</div>
                  </div>
                  <div>
                    <div className="text-blue-400 font-black truncate">{selectedMatch.away}</div>
                    <div className="text-4xl font-black text-blue-400">{prediction.nextGoalAway}%</div>
                  </div>
                </div>
              </MarketCard>

              <MarketCard title="LÍNEA DE GOLES">
                <div className="grid grid-cols-3 text-center">
                  <BigPercent label="+1.5" value={prediction.over15} />
                  <BigPercent label="+2.5" value={prediction.over25} />
                  <BigPercent label="+3.5" value={prediction.over35} />
                </div>
              </MarketCard>

              <MarketCard title="1ª MITAD">
                <div className="grid grid-cols-3 text-center">
                  <BigPercent label={selectedMatch.home} value={prediction.firstHalfHome ?? 33} />
                  <BigPercent label="EMPATE" value={prediction.firstHalfDraw ?? 34} />
                  <BigPercent label={selectedMatch.away} value={prediction.firstHalfAway ?? 33} />
                </div>
              </MarketCard>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <MarketCard title="AMBOS ANOTAN (BTTS)">
                <div className="grid grid-cols-2 text-center">
                  <BigPercent label="SÍ" value={bttsYes} green />
                  <BigPercent label="NO" value={bttsNo} red />
                </div>
              </MarketCard>

              <MarketCard title="MOMENTUM">
                <div className="text-center text-white/50">
                  {hasStats ? "Lectura basada en tiros, posesión y marcador" : "Modo básico sin estadísticas avanzadas"}
                </div>
              </MarketCard>

              <MarketCard title="CALIDAD DE DATOS">
                <div className="text-center">
                  <div className="text-4xl font-black text-green-400">
                    {hasStats ? "ALTA" : "BÁSICA"}
                  </div>
                  <div className="text-white/40 mt-2">
                    {hasStats ? "Stats + eventos + marcador" : "Marcador + eventos"}
                  </div>
                </div>
              </MarketCard>
            </div>
          </section>

          <aside className="grid grid-rows-[90px_1fr] gap-3 min-h-0">
            <div className="rounded-2xl bg-[#07111c] border border-white/10 p-5">
              <div className="text-2xl font-black">EVENTOS EN VIVO</div>
              <div className="text-white/50 mt-3">
                {fixtureEvents.length === 0 ? "Sin eventos disponibles todavía." : `${fixtureEvents.length} eventos detectados`}
              </div>
            </div>

            <div className="rounded-2xl bg-[#07111c] border border-white/10 p-5 min-h-0 overflow-y-auto">
              <div className="text-2xl font-black mb-4">IRVIN AI DECISIONES</div>

              <div className="rounded-2xl bg-green-500/15 border border-green-500/30 p-4">
                <div className="text-white/50 font-black text-sm">RECOMENDACIÓN PRINCIPAL</div>
                <div className="text-4xl font-black text-green-400 mt-2">
                  {prediction.recommendation}
                </div>
                <div className="text-white/60 mt-3">
                  No es garantía de acierto. Úsalo como lectura estadística, no como apuesta segura.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <DecisionBox title="ACCIÓN" value={actionText} />
                <DecisionBox title="RIESGO" value={riskText} red={riskText === "SIN VALOR"} />
                <DecisionBox title="CONFIANZA" value={`${prediction.confidence}%`} green />
                <DecisionBox title="IRVIN SCORE" value={`${prediction.irvinScore}/100`} blue />
              </div>

              <div className="mt-4 text-white/50 font-black text-sm">LECTURA DE LA IA</div>
              <div className="mt-2 space-y-2">
                {(prediction.aiDecisions ?? []).slice(0, 5).map((item: string, i: number) => (
                  <div key={i} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm">
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                {fixtureEvents.slice(-5).reverse().map((e: any, i: number) => (
                  <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm flex justify-between gap-2">
                    <span>{e.time?.elapsed}' {eventIcon(e.type)} {e.type}</span>
                    <span className="text-green-300 truncate">{e.player?.name ?? e.team?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <footer className="rounded-xl bg-[#07111c] border border-white/10 grid grid-cols-[1fr_1fr_1fr_180px] text-sm font-black overflow-hidden">
          <div className="px-4 flex items-center text-yellow-300">
            🔔 ALERTAS&nbsp;
            <span className="text-white">
              ID: {selectedMatch.id} | STATS: {fixtureStats.length} | EVENTS: {fixtureEvents.length}
            </span>
          </div>
          <div className="px-4 flex items-center border-l border-white/10">
            🔥 IA: {prediction.recommendation} · {actionText} · Confianza {prediction.confidence}%
          </div>
          <div className="px-4 flex items-center border-l border-white/10">
            📊 {hasStats ? "Estadísticas avanzadas disponibles" : "Esta liga no ofrece estadísticas avanzadas"}
          </div>
          <div className="px-4 flex items-center justify-center border-l border-white/10 text-green-400">
            DATOS CADA 5 MIN
          </div>
        </footer>
      </div>
    </main>
  );
}

function Badge({ value, yellow }: { value: string; yellow?: boolean }) {
  return (
    <div className={`rounded-full px-8 py-3 font-black border ${
      yellow
        ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-300"
        : "bg-green-500/15 border-green-500/30 text-green-400"
    }`}>
      {value}
    </div>
  );
}

function ScoreBoard({
  match,
  minute,
  prediction,
}: {
  match: Match;
  minute: string;
  prediction: any;
}) {
  return (
    <div className="rounded-2xl bg-[#07111c] border border-white/10 p-4">
      <div className="text-center text-white/40 font-black text-sm">
        {match.league}
      </div>

      <div className="grid grid-cols-[1fr_240px_1fr] items-center mt-2">
        <TeamBlock side="LOCAL" logo={match.homeFlag} name={match.home} align="left" />

        <div className="text-center">
          <div className="text-green-400 text-xs font-black">EN VIVO</div>
          <div className="text-6xl font-black mt-1">
            {match.homeScore} - {match.awayScore}
          </div>
          <div className="text-white/50 mt-1">{minute} · {match.half}</div>
        </div>

        <TeamBlock side="VISITANTE" logo={match.awayFlag} name={match.away} align="right" />
      </div>

      <div
        className="mt-4 h-6 rounded-lg overflow-hidden grid text-xs font-black text-center"
        style={{
          gridTemplateColumns: `${Math.max(prediction.homeWin, 1)}fr ${Math.max(prediction.draw, 1)}fr ${Math.max(prediction.awayWin, 1)}fr`,
        }}
      >
        <div className="bg-green-500 text-black flex items-center justify-center">{prediction.homeWin}%</div>
        <div className="bg-slate-500 flex items-center justify-center">{prediction.draw}%</div>
        <div className="bg-blue-600 flex items-center justify-center">{prediction.awayWin}%</div>
      </div>
    </div>
  );
}

function TeamBlock({
  side,
  logo,
  name,
  align,
}: {
  side: string;
  logo: string;
  name: string;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className={`flex items-center gap-4 ${align === "right" ? "justify-end" : ""}`}>
        {align === "left" && logo && <img src={logo} alt={name} className="w-10 h-10 object-contain" />}
        <div>
          <div className="text-white/40 text-xs font-black">{side}</div>
          <div className="text-2xl font-black truncate max-w-[300px]">{name}</div>
        </div>
        {align === "right" && logo && <img src={logo} alt={name} className="w-10 h-10 object-contain" />}
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: any }) {
  return (
    <div className="h-36 rounded-xl bg-[#030b12] border border-white/10 p-4 flex flex-col items-center justify-center">
      <div className="text-white/40 text-sm font-black mb-4">{title}</div>
      <div className="text-4xl font-black">{value}</div>
    </div>
  );
}

function MarketCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-40 rounded-xl bg-[#030b12] border border-white/10 p-4 flex flex-col justify-center">
      <div className="text-white/40 text-sm font-black text-center mb-4">{title}</div>
      {children}
    </div>
  );
}

function BigPercent({
  label,
  value,
  green,
  red,
}: {
  label: string;
  value: any;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div>
      <div className="text-white/50 text-sm font-black truncate">{label}</div>
      <div className={`text-4xl font-black ${green ? "text-green-400" : red ? "text-red-400" : ""}`}>
        {value}%
      </div>
    </div>
  );
}

function DecisionBox({
  title,
  value,
  green,
  red,
  blue,
}: {
  title: string;
  value: string;
  green?: boolean;
  red?: boolean;
  blue?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
      <div className="text-white/40 text-xs font-black">{title}</div>
      <div className={`text-2xl font-black mt-2 ${
        green ? "text-green-400" : red ? "text-red-400" : blue ? "text-blue-400" : "text-yellow-300"
      }`}>
        {value}
      </div>
    </div>
  );
}