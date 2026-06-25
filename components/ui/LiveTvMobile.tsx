"use client";

import React, { useEffect, useMemo, useState } from "react";
import { calculateLivePoisson } from "@/lib/livePoisson";
import LiveMobileHeader from "./live/LiveMobileHeader";

type Match = {
  id: number;
  minute: string;
  minuteNumber: number;
  half: string;
  league: string;
  country: string;
  leagueLogo: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  homeFlag: string;
  awayFlag: string;
  apiUpdatedAt: number;
};
const SELECTED_MATCH_STORAGE_KEY = "irvin_analytics_selected_match_id";
function mapApiFixtureToMatch(fx: any): Match {
  const elapsed = fx.fixture?.status?.elapsed ?? 0;
  const short = fx.fixture?.status?.short ?? "LIVE";

  return {
    id: fx.fixture.id,
    minute: short === "HT" ? "HT" : `${elapsed}'`,
    minuteNumber: elapsed,
    half: short,
    league: fx.league?.name ?? "Liga",
    country: fx.league?.country ?? "World",
    leagueLogo: fx.league?.logo ?? "",
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

function eventIcon(type: string) {
  if (type === "Goal") return "⚽";
  if (type === "Card") return "🟨";
  if (type === "subst") return "🔁";
  return "•";
}

function getLiveMinute(match: Match, tick: number) {
  if (match.half === "HT") return "HT";
  if (match.half === "FT") return "FT";

  const secondsPassed = Math.floor((tick - match.apiUpdatedAt) / 1000);
  const extraMinutes = Math.floor(secondsPassed / 60);
  const liveMinute = Math.min(match.minuteNumber + extraMinutes, 90);

  return `${liveMinute}'`;
}

function countryFlag(country: string) {
  const c = country.toLowerCase();

  if (c.includes("spain")) return "🇪🇸";
  if (c.includes("england")) return "🏴";
  if (c.includes("germany")) return "🇩🇪";
  if (c.includes("france")) return "🇫🇷";
  if (c.includes("italy")) return "🇮🇹";
  if (c.includes("estonia")) return "🇪🇪";
  if (c.includes("iran")) return "🇮🇷";
  if (c.includes("latvia")) return "🇱🇻";
  if (c.includes("lebanon")) return "🇱🇧";
  if (c.includes("kuwait")) return "🇰🇼";
  if (c.includes("georgia")) return "🇬🇪";
  if (c.includes("tanzania")) return "🇹🇿";
  if (c.includes("lithuania")) return "🇱🇹";
  if (c.includes("cameroon")) return "🇨🇲";

  return "🌍";
}

export default function LiveTvMobile() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [fixtureStats, setFixtureStats] = useState<any[]>([]);
  const [fixtureEvents, setFixtureEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

async function loadLive() {
  try {
    setLoading(true);
    setFixtureStats([]);
    setFixtureEvents([]);

    const res = await fetch(`/api/live?t=${Date.now()}`, {
      cache: "no-store",
    });

    const data = await res.json();

    const liveGames = Array.isArray(data.response)
      ? data.response.map(mapApiFixtureToMatch)
      : [];

    setMatches(liveGames);

    if (liveGames.length > 0) {
      setSelected((current) => {
        const savedId =
          typeof window !== "undefined"
            ? Number(localStorage.getItem(SELECTED_MATCH_STORAGE_KEY))
            : 0;

        const currentId = current?.id ?? savedId;

        const nextSelected =
          liveGames.find((m: Match) => m.id === currentId) ?? liveGames[0];

        if (typeof window !== "undefined") {
          localStorage.setItem(
            SELECTED_MATCH_STORAGE_KEY,
            String(nextSelected.id)
          );
        }

        return nextSelected;
      });
    } else {
      setSelected(null);
    }

    setLoading(false);
  } catch (error) {
    console.error("loadLive", error);
    setLoading(false);
  }
}

useEffect(() => {
  loadLive();
  const interval = setInterval(loadLive, 30000);
  return () => clearInterval(interval);
}, []);


async function handleManualRefresh() {
  await loadLive();

  const currentId =
    selected?.id ??
    Number(localStorage.getItem(SELECTED_MATCH_STORAGE_KEY));

  if (!currentId) return;

  try {
    setFixtureStats([]);
    setFixtureEvents([]);

    const res = await fetch(`/api/fixture?id=${currentId}&t=${Date.now()}`, {
      cache: "no-store",
    });

    const data = await res.json();

    setFixtureStats(data.statistics ?? []);
    setFixtureEvents(data.events ?? []);
  } catch (error) {
    console.error("Error refrescando partido manualmente:", error);
  }
}








  useEffect(() => {
    if (!selected) return;

    const selectedId = selected.id;

    async function loadFixtureDetails() {
      try {
        const res = await fetch(`/api/fixture?id=${selectedId}`, {
          cache: "no-store",
        });

        const data = await res.json();

        setFixtureStats(data.statistics ?? []);
        setFixtureEvents(data.events ?? []);
      } catch (error) {
        console.error("Error cargando estadísticas/eventos:", error);
      }
    }

    loadFixtureDetails();
    const interval = setInterval(loadFixtureDetails, 300000);
    return () => clearInterval(interval);
  }, [selected?.id]);

  const groupedMatches = useMemo(() => {
    const groups: Record<string, Match[]> = {};

    matches.forEach((match) => {
      const key = `${match.country} · ${match.league}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(match);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => b.minuteNumber - a.minuteNumber);
    });

    return groups;
  }, [matches]);

  if (!selected) {
    return (
      <main className="min-h-[100dvh] bg-[#03070b] text-white flex items-center justify-center px-5">
        <div className="w-full max-w-md rounded-3xl bg-[#07111c] border border-white/10 p-8 text-center shadow-2xl">
          <img
            src="/logo-irvin.png"
            alt="Irvin Analytics"
            className="w-24 h-24 mx-auto rounded-2xl object-contain bg-black p-3 border border-cyan-400/30"
          />

          <h1 className="text-4xl font-black text-green-400 mt-6">
            IRVIN ANALYTICS
          </h1>

          <p className="text-xl font-bold mt-4">
            {loading
              ? "Cargando partidos en vivo..."
              : "No hay partidos en vivo ahora mismo"}
          </p>

          <p className="text-white/50 mt-3 leading-relaxed">
            Sistema conectado correctamente. Cuando empiece un partido en directo,
            aparecerán aquí las predicciones, eventos, momentum, alertas IA e Irvin Score.
          </p>
        </div>
      </main>
    );
  }

  const homeShots = getStat(fixtureStats, selected.home, "Total Shots");
  const awayShots = getStat(fixtureStats, selected.away, "Total Shots");
  const homeShotsOn = getStat(fixtureStats, selected.home, "Shots on Goal");
  const awayShotsOn = getStat(fixtureStats, selected.away, "Shots on Goal");
  const homePossession = getStat(fixtureStats, selected.home, "Ball Possession") || "50%";
  const awayPossession = getStat(fixtureStats, selected.away, "Ball Possession") || "50%";
  const homeXg = getStat(fixtureStats, selected.home, "expected_goals");
  const awayXg = getStat(fixtureStats, selected.away, "expected_goals");
  const homeCorners = getStat(fixtureStats, selected.home, "Corner Kicks");
  const awayCorners = getStat(fixtureStats, selected.away, "Corner Kicks");
  const hasStats = fixtureStats.length > 0;

  const prediction = calculateLivePoisson({
    homeScore: selected.homeScore,
    awayScore: selected.awayScore,
    minuteText: getLiveMinute(selected, tick),
    homeShots,
    awayShots,
    homeShotsOn,
    awayShotsOn,
    homePossession,
    awayPossession,
  });

  const homeMomentum =
    toNumber(homeShots) * 1.2 +
    toNumber(homeShotsOn) * 2.5 +
    toNumber(homePossession) * 0.25 +
    selected.homeScore * 8;

  const awayMomentum =
    toNumber(awayShots) * 1.2 +
    toNumber(awayShotsOn) * 2.5 +
    toNumber(awayPossession) * 0.25 +
    selected.awayScore * 8;

  const momentumTotal = Math.max(1, homeMomentum + awayMomentum);
  const homeMomentumPercent = Math.round((homeMomentum / momentumTotal) * 100);
  const awayMomentumPercent = 100 - homeMomentumPercent;

  const momentumText =
    homeMomentumPercent > awayMomentumPercent + 10
      ? `${selected.home} domina`
      : awayMomentumPercent > homeMomentumPercent + 10
      ? `${selected.away} domina`
      : "Partido equilibrado";

  const actionText =
    prediction.irvinScore >= 85
      ? "ENTRAR"
      : prediction.irvinScore >= 65
      ? "OBSERVAR"
      : "NO ENTRAR";

  const riskText =
    prediction.confidence >= 80
      ? "BAJO"
      : prediction.confidence >= 60
      ? "MEDIO"
      : "ALTO";

  const dataQuality = hasStats ? "ALTA" : fixtureEvents.length > 0 ? "MEDIA" : "BÁSICA";

  const aiSummary = hasStats
    ? "Modo completo: decisión basada en marcador, minuto, eventos y estadísticas avanzadas."
    : "Modo Live Básico: esta liga no entrega estadísticas avanzadas. La decisión se basa en marcador, minuto, eventos y modelo Poisson.";

  return (
    <main className="min-h-[100dvh] bg-[#03070b] text-white px-4 pt-4 pb-24 space-y-4 overflow-y-auto">
      
      
      
<LiveMobileHeader
  matchesCount={matches.length}
  loading={loading}
  onRefresh={handleManualRefresh}
/>









      <section className="rounded-3xl border border-white/10 p-5 text-center shadow-2xl bg-[radial-gradient(circle_at_center,#10243a_0%,#07111c_55%,#03070b_100%)]">
        <div className="text-white/50 font-black text-sm">
          {countryFlag(selected.country)} {selected.country} · {selected.league}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-5">
          <div className="text-center min-w-0">
            <img src={selected.homeFlag} alt={selected.home} className="w-16 h-16 object-contain mx-auto" />
            <div className="mt-3 font-black text-lg truncate">{selected.home}</div>
          </div>

          <div className="px-2 text-center">
            <div className="inline-block rounded-2xl bg-green-500 px-4 py-2 text-sm font-black text-black">
              EN VIVO
            </div>
            <div className="text-6xl font-black mt-4 tracking-wide">
              {selected.homeScore} - {selected.awayScore}
            </div>
            <div className="mt-3 text-green-400 font-black text-2xl">
              {getLiveMinute(selected, tick)} · {selected.half}
            </div>
          </div>

          <div className="text-center min-w-0">
            <img src={selected.awayFlag} alt={selected.away} className="w-16 h-16 object-contain mx-auto" />
            <div className="mt-3 font-black text-lg truncate">{selected.away}</div>
          </div>
        </div>

        <div
          className="mt-5 h-7 rounded-xl overflow-hidden grid text-[11px] font-black text-center"
          style={{
            gridTemplateColumns: `${Math.max(prediction.homeWin, 1)}fr ${Math.max(
              prediction.draw,
              1
            )}fr ${Math.max(prediction.awayWin, 1)}fr`,
          }}
        >
          <div className="bg-green-500 text-black flex items-center justify-center">
            {prediction.homeWin}%
          </div>
          <div className="bg-slate-500 flex items-center justify-center">
            {prediction.draw}%
          </div>
          <div className="bg-blue-600 flex items-center justify-center">
            {prediction.awayWin}%
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-[#07111c] border border-white/10 p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-black text-white/80">Cambiar partido</div>
          <div className="text-green-400 font-black text-sm">{matches.length} LIVE</div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {matches.map((m) => (
            <button
              key={m.id}
              onClick={() => {
  setSelected(m);
  localStorage.setItem(SELECTED_MATCH_STORAGE_KEY, String(m.id));
}}
              className={`min-w-[230px] rounded-2xl p-3 border text-left ${
                selected.id === m.id
                  ? "bg-green-500/15 border-green-400/50"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex justify-between items-center gap-2">
                <span className="text-green-400 font-black">{getLiveMinute(m, tick)}</span>
                <span className="font-black">{m.homeScore}-{m.awayScore}</span>
              </div>
              <div className="mt-2 text-sm font-bold truncate">{m.home}</div>
              <div className="text-sm font-bold truncate text-white/60">{m.away}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Box title="1" value={`${prediction.homeWin}%`} />
        <Box title="X" value={`${prediction.draw}%`} />
        <Box title="2" value={`${prediction.awayWin}%`} />
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Box title="+1.5" value={`${prediction.over15}%`} />
        <Box title="+2.5" value={`${prediction.over25}%`} />
        <Box title="+3.5" value={`${prediction.over35}%`} />
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Box title="BTTS Sí" value={`${(prediction as any).bttsYes ?? (prediction as any).btts ?? 0}%`} />
        <Box title="BTTS No" value={`${(prediction as any).bttsNo ?? 100 - ((prediction as any).btts ?? 0)}%`} />
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Box title="Gol Local" value={`${prediction.nextGoalHome}%`} />
        <Box title="Sin Gol" value={`${prediction.nextGoalDraw}%`} />
        <Box title="Gol Visitante" value={`${prediction.nextGoalAway}%`} />
      </section>

      <section className="rounded-3xl bg-[#07111c] border border-white/10 p-5 shadow-2xl">
        <div className="text-center">
          <div className="text-white/50 font-black">🤖 IRVIN AI</div>
          <div className="mt-3 text-4xl font-black text-green-400">
            {prediction.recommendation}
          </div>
          <div className="text-white/50 mt-2">Recomendación principal</div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <Box title="Acción" value={actionText} />
          <Box title="Riesgo" value={riskText} />
          <Box title="Confianza" value={`${prediction.confidence}%`} />
          <Box title="Score" value={`${prediction.irvinScore}/100`} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-black text-white/60">LECTURA DE LA IA</div>
            <div className="text-xs rounded-full bg-white/5 border border-white/10 px-3 py-1 text-white/60">
              DATOS {dataQuality}
            </div>
          </div>

          <div className="space-y-2">
            {(prediction.aiDecisions ?? []).slice(0, 4).map((item, i) => (
              <div
                key={i}
                className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white/75 leading-relaxed"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-green-500/10 border border-green-500/30 p-4 text-sm text-white/70 leading-relaxed">
            <span className="font-black text-white">Resumen:</span> {aiSummary}
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-[#07111c] border border-white/10 p-5 shadow-2xl">
        <div className="text-white/50 font-black text-center text-lg">EVENTOS</div>

        {fixtureEvents.length === 0 ? (
          <div className="text-white/40 text-center mt-3">Sin eventos disponibles</div>
        ) : (
          <div className="mt-4 space-y-2">
            {fixtureEvents.slice(-5).reverse().map((e: any, i: number) => (
              <div key={i} className="bg-white/5 rounded-xl px-4 py-3 text-sm font-bold flex justify-between gap-2">
                <span>{e.time?.elapsed}' {eventIcon(e.type)} {e.type}</span>
                <span className="text-green-300 truncate">{e.player?.name ?? e.team?.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-[#07111c] border border-white/10 p-5 shadow-2xl">
        <div className="text-white/50 font-black text-center text-lg">MOMENTUM IA</div>
        <div className="mt-4 text-center text-green-400 font-black text-2xl">
          {momentumText}
        </div>

        <div className="mt-5 space-y-4">
          <MomentumRow team={selected.home} value={homeMomentumPercent} color="bg-green-400" />
          <MomentumRow team={selected.away} value={awayMomentumPercent} color="bg-blue-500" />
        </div>
      </section>

      <section className="rounded-3xl bg-[#07111c] border border-white/10 p-5 shadow-2xl">
        <div className="text-white/50 font-black text-center text-lg">ESTADÍSTICAS</div>

        {!hasStats ? (
          <div className="text-white/40 text-center mt-3">
            Modo Live Básico: marcador + eventos + modelo Poisson
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <StatRow label="xG" home={homeXg} away={awayXg} />
            <StatRow label="Tiros" home={homeShots} away={awayShots} />
            <StatRow label="A puerta" home={homeShotsOn} away={awayShotsOn} />
            <StatRow label="Corners" home={homeCorners} away={awayCorners} />
            <StatRow label="Posesión" home={homePossession} away={awayPossession} />
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-[#07111c] border border-white/10 p-4 shadow-2xl">
        <div className="font-black mb-4 text-xl">Partidos en vivo</div>

        <div className="space-y-5">
          {Object.entries(groupedMatches).map(([groupName, games]) => {
            const country = games[0]?.country ?? "World";
            const leagueLogo = games[0]?.leagueLogo;

            return (
              <div key={groupName} className="rounded-2xl bg-black/30 border border-white/10 overflow-hidden">
                <div className="px-4 py-3 bg-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {leagueLogo && (
                      <img src={leagueLogo} alt={groupName} className="w-6 h-6 object-contain" />
                    )}
                    <div className="font-black text-green-400 truncate">
                      {countryFlag(country)} {groupName}
                    </div>
                  </div>

                  <span className="text-xs text-white/40">{games.length}</span>
                </div>

                <div className="p-2 space-y-2">
                  {games.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
  setSelected(m);
  localStorage.setItem(SELECTED_MATCH_STORAGE_KEY, String(m.id));
}}
                      className={`w-full rounded-xl p-3 grid grid-cols-[52px_1fr_64px] items-center gap-2 ${
                        selected.id === m.id
                          ? "bg-green-500/15 border border-green-400/40"
                          : "bg-white/5 border border-white/5"
                      }`}
                    >
                      <div className="text-left">
                        <div className="text-green-400 font-black text-xl">
                          {getLiveMinute(m, tick)}
                        </div>
                        <div className="text-[10px] text-white/40">{m.half}</div>
                      </div>

                      <div className="text-left min-w-0">
                        <div className="font-bold truncate">{m.home}</div>
                        <div className="text-white/40 text-xs">vs</div>
                        <div className="font-bold truncate">{m.away}</div>
                      </div>

                      <div className="text-right font-black text-xl">
                        {m.homeScore}-{m.awayScore}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Box({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#07111c] border border-white/10 p-4 text-center shadow-lg">
      <div className="text-white/50 text-sm truncate">{title}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}

function StatRow({ label, home, away }: { label: string; home: any; away: any }) {
  return (
    <div className="grid grid-cols-[70px_1fr_70px] items-center bg-white/5 rounded-xl px-4 py-3 text-sm">
      <div className="font-black">{home}</div>
      <div className="text-center text-white/50 font-bold">{label}</div>
      <div className="font-black text-right">{away}</div>
    </div>
  );
}

function MomentumRow({
  team,
  value,
  color,
}: {
  team: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm text-white/60 mb-2">
        <span className="truncate">{team}</span>
        <span>{value}%</span>
      </div>
      <div className="h-4 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-700`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
