"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateLivePoisson } from "@/lib/livePoisson";
import { readLiveStat as getStat, liveValue, type FixtureStatistics } from "@/lib/liveData";
import LiveMobileHeader from "./live/LiveMobileHeader";
import MobileMatchSelector from "./live/MobileMatchSelector";

type Match = {
  id: number;
  minute: string;
  minuteNumber: number | null;
  half: string;
  league: string;
  country: string;
  leagueLogo: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  homeFlag: string;
  awayFlag: string;
  apiUpdatedAt: number;
};
const SELECTED_MATCH_STORAGE_KEY = "irvin_analytics_selected_match_id";
type ApiFixture = {
  fixture: {id: number; status?: {elapsed?: number | null; short?: string}};
  league?: {name?: string; country?: string; logo?: string};
  teams?: {home?: {name?: string; logo?: string}; away?: {name?: string; logo?: string}};
  goals?: {home?: number | null; away?: number | null};
};
type FixtureEvent = {type: string; time?: {elapsed?: number}; player?: {name?: string}; team?: {name?: string}};
function mapApiFixtureToMatch(fx: ApiFixture): Match {
  const elapsed = fx.fixture?.status?.elapsed ?? null;
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
    homeScore: fx.goals?.home ?? null,
    awayScore: fx.goals?.away ?? null,
    homeFlag: fx.teams?.home?.logo ?? "",
    awayFlag: fx.teams?.away?.logo ?? "",
    apiUpdatedAt: Date.now(),
  };
}

function eventIcon(type: string) {
  if (type === "Goal") return "⚽";
  if (type === "Card") return "🟨";
  if (type === "subst") return "🔁";
  return "•";
}

function getLiveMinute(match: Match) {
  return ["HT", "FT"].includes(match.half) ? match.half : liveValue(match.minuteNumber, "'");
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
  const [receivedStats, setFixtureStats] = useState<FixtureStatistics[]>([]);
  const [receivedEvents, setFixtureEvents] = useState<FixtureEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [statsCachedAt, setStatsCachedAt] = useState<number | null>(null);
  const [detailsOwner, setDetailsOwner] = useState<number | null>(null);
  const [liveStale, setLiveStale] = useState(false);
  const [liveCachedAt, setLiveCachedAt] = useState<number | null>(null);
  const detailsGeneration = useRef({version: 0});
  const fixtureStats = detailsOwner === selected?.id ? receivedStats : [];
  const fixtureEvents = detailsOwner === selected?.id ? receivedEvents : [];

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

async function loadLive() {
  try {
    const res = await fetch(`/api/live?t=${Date.now()}`, {
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok || data.error || !Array.isArray(data.response)) throw new Error("Partidos no disponibles");

    setLiveStale(Boolean(data.stale));
    setLiveCachedAt(typeof data.cachedAt === "number" ? data.cachedAt : null);
    setTick(Date.now());
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
    setLiveStale(true);
    console.error("loadLive", error);
    setLoading(false);
  }
}

useEffect(() => {
  const initial = setTimeout(loadLive, 0);
  const interval = setInterval(loadLive, 30000);
  return () => { clearTimeout(initial); clearInterval(interval); };
}, []);


  const requestDetails = useCallback(async (id: number, signal?: AbortSignal) => {
    const generation = ++detailsGeneration.current.version;
    try {
      const res = await fetch(`/api/fixture?id=${id}`, {cache: "no-store", signal});
      const data = await res.json();
      if (generation !== detailsGeneration.current.version || signal?.aborted) return;
      if (!res.ok || data.error || !Array.isArray(data.statistics) || !Array.isArray(data.events) ||
          (data.fixtureId !== undefined && String(data.fixtureId) !== String(id))) {
        throw new Error("Estadísticas no disponibles");
      }
      setDetailsOwner(id);
      setStatsCachedAt(typeof data.cachedAt === "number" ? data.cachedAt : null);
      setTick(Date.now());
      setFixtureStats(data.statistics);
      setFixtureEvents(data.events);
    } catch {
      if (generation !== detailsGeneration.current.version || signal?.aborted) return;
      setStatsCachedAt(null);
      setFixtureStats([]);
      setFixtureEvents([]);
    }
  }, []);

  async function handleManualRefresh() {
    await loadLive();
    const currentId = selected?.id ?? Number(localStorage.getItem(SELECTED_MATCH_STORAGE_KEY));
    if (currentId) await requestDetails(currentId);
  }

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    const generation = detailsGeneration.current;
    const initial = setTimeout(() => { void requestDetails(selectedId, controller.signal); }, 0);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void requestDetails(selectedId, controller.signal);
    }, 300000);
    return () => { generation.version++; controller.abort(); clearTimeout(initial); clearInterval(interval); };
  }, [selectedId, requestDetails]);

  function selectMatch(match: Match) {
    if (match.id === selectedId) return;
    detailsGeneration.current.version++;
    setStatsCachedAt(null);
    setFixtureStats([]);
    setFixtureEvents([]);
    setSelected(match);
    localStorage.setItem(SELECTED_MATCH_STORAGE_KEY, String(match.id));
  }

  const groupedMatches = useMemo(() => {
    const groups: Record<string, Match[]> = {};

    matches.forEach((match) => {
      const key = `${match.country} · ${match.league}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(match);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => (b.minuteNumber ?? -1) - (a.minuteNumber ?? -1));
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
            Cuando haya una captura válida de un partido en directo,
            aparecerán aquí sus datos y los análisis que puedan evaluarse.
          </p>
        </div>
      </main>
    );
  }

  const homeShots = getStat(fixtureStats, selected.home, "Total Shots");
  const awayShots = getStat(fixtureStats, selected.away, "Total Shots");
  const homeShotsOn = getStat(fixtureStats, selected.home, "Shots on Goal");
  const awayShotsOn = getStat(fixtureStats, selected.away, "Shots on Goal");
  const homePossession = getStat(fixtureStats, selected.home, "Ball Possession");
  const awayPossession = getStat(fixtureStats, selected.away, "Ball Possession");
  const homeXg = getStat(fixtureStats, selected.home, "expected_goals");
  const awayXg = getStat(fixtureStats, selected.away, "expected_goals");
  const homeCorners = getStat(fixtureStats, selected.home, "Corner Kicks");
  const awayCorners = getStat(fixtureStats, selected.away, "Corner Kicks");
  const hasStats = fixtureStats.length > 0;

  const prediction = calculateLivePoisson({
    homeScore: selected.homeScore,
    awayScore: selected.awayScore,
    minuteText: selected.minuteNumber === null ? "" : String(selected.minuteNumber),
    status: selected.half, homeXg, awayXg, stale: liveStale,
    fixtureAgeSeconds: tick > 0 && typeof liveCachedAt === "number" ? (tick-liveCachedAt)/1000 : null,
    statisticsAgeSeconds: tick > 0 && typeof statsCachedAt === "number" ? (tick-statsCachedAt)/1000 : null,
    homeShots,
    awayShots,
    homeShotsOn,
    awayShotsOn,
    homePossession,
    awayPossession,
  });

  const actionText = "SIN RECOMENDACIÓN VALIDADA";
  const riskText = "NO EVALUABLE";
  const dataQuality = prediction.dataQuality;
  const aiSummary = prediction.aiSummary;

  return (
    <main className="min-h-[100dvh] bg-[#03070b] text-white px-4 pt-4 pb-24 space-y-4 overflow-y-auto">
      <LiveMobileHeader matchesCount={matches.length} loading={loading} onRefresh={handleManualRefresh} />










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
              {liveValue(selected.homeScore)} - {liveValue(selected.awayScore)}
            </div>
            <div className="mt-3 text-green-400 font-black text-2xl">
              {getLiveMinute(selected)} · {selected.half}
            </div>
          </div>

          <div className="text-center min-w-0">
            <img src={selected.awayFlag} alt={selected.away} className="w-16 h-16 object-contain mx-auto" />
            <div className="mt-3 font-black text-lg truncate">{selected.away}</div>
          </div>
        </div>

        {prediction.homeWin !== null ? <div
          className="mt-5 h-7 rounded-xl overflow-hidden grid text-[11px] font-black text-center"
          style={{
            gridTemplateColumns: `${(prediction.homeWin ?? 0)}fr ${(prediction.draw ?? 0)}fr ${(prediction.awayWin ?? 0)}fr`,
          }}
        >
          <div className="bg-green-500 text-black flex items-center justify-center">
            {liveValue(prediction.homeWin, "%")}
          </div>
          <div className="bg-slate-500 flex items-center justify-center">
            {liveValue(prediction.draw, "%")}
          </div>
          <div className="bg-blue-600 flex items-center justify-center">
            {liveValue(prediction.awayWin, "%")}
          </div>
        </div> : <p>Resultado no evaluable</p>}
      </section>






<MobileMatchSelector
  matches={matches}
  selectedId={selected.id}
  tick={tick}
  getLiveMinute={getLiveMinute}
  onSelect={selectMatch}
/>










      <section className="grid grid-cols-3 gap-2">
        <Box title="1" value={`${liveValue(prediction.homeWin, "%")}`} />
        <Box title="X" value={`${liveValue(prediction.draw, "%")}`} />
        <Box title="2" value={`${liveValue(prediction.awayWin, "%")}`} />
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Box title="+1.5" value={`${liveValue(prediction.over15, "%")}`} />
        <Box title="+2.5" value={`${liveValue(prediction.over25, "%")}`} />
        <Box title="+3.5" value={`${liveValue(prediction.over35, "%")}`} />
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Box title="BTTS Sí" value={liveValue(prediction.bttsYes, "%")} />
        <Box title="BTTS No" value={liveValue(prediction.bttsNo, "%")} />
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Box title="Gol Local" value={`${liveValue(prediction.nextGoalHome, "%")}`} />
        <Box title="Sin Gol" value={`${liveValue(prediction.nextGoalDraw, "%")}`} />
        <Box title="Gol Visitante" value={`${liveValue(prediction.nextGoalAway, "%")}`} />
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
          <Box title="Confianza" value={"No evaluable"} />
          <Box title="Score" value={"No evaluable"} />
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
            <p>Datos y xG del proveedor; probabilidades propias exploratorias a 90 minutos, sin añadido.</p>
            {prediction.issues.map(issue => <p key={issue}>{issue}</p>)}
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-[#07111c] border border-white/10 p-5 shadow-2xl">
        <div className="text-white/50 font-black text-center text-lg">EVENTOS</div>

        {fixtureEvents.length === 0 ? (
          <div className="text-white/40 text-center mt-3">Sin eventos disponibles</div>
        ) : (
          <div className="mt-4 space-y-2">
            {fixtureEvents.slice(-5).reverse().map((e: FixtureEvent, i: number) => (
              <div key={i} className="bg-white/5 rounded-xl px-4 py-3 text-sm font-bold flex justify-between gap-2">
                <span>{e.time?.elapsed}&apos; {eventIcon(e.type)} {e.type}</span>
                <span className="text-green-300 truncate">{e.player?.name ?? e.team?.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-[#07111c] p-5">
        Momentum, confianza, riesgo y valor: no evaluables sin validación histórica.
      </section>

      <section className="rounded-3xl bg-[#07111c] border border-white/10 p-5 shadow-2xl">
        <div className="text-white/50 font-black text-center text-lg">ESTADÍSTICAS</div>

        {!hasStats ? (
          <div className="text-white/40 text-center mt-3">
            Estadísticas del proveedor no disponibles. Confianza no evaluable.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <StatRow label="xG" home={liveValue(homeXg)} away={liveValue(awayXg)} />
            <StatRow label="Tiros" home={liveValue(homeShots)} away={liveValue(awayShots)} />
            <StatRow label="A puerta" home={liveValue(homeShotsOn)} away={liveValue(awayShotsOn)} />
            <StatRow label="Corners" home={liveValue(homeCorners)} away={liveValue(awayCorners)} />
            <StatRow label="Posesión" home={liveValue(homePossession, "%")} away={liveValue(awayPossession, "%")} />
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
                      onClick={() => selectMatch(m)}
                      data-live-fixture-id={m.id}
                      className={`w-full rounded-xl p-3 grid grid-cols-[52px_1fr_64px] items-center gap-2 ${
                        selected.id === m.id
                          ? "bg-green-500/15 border border-green-400/40"
                          : "bg-white/5 border border-white/5"
                      }`}
                    >
                      <div className="text-left">
                        <div className="text-green-400 font-black text-xl">
                          {getLiveMinute(m)}
                        </div>
                        <div className="text-[10px] text-white/40">{m.half}</div>
                      </div>

                      <div className="text-left min-w-0">
                        <div className="font-bold truncate">{m.home}</div>
                        <div className="text-white/40 text-xs">vs</div>
                        <div className="font-bold truncate">{m.away}</div>
                      </div>

                      <div className="text-right font-black text-xl">
                        {liveValue(m.homeScore)}-{liveValue(m.awayScore)}
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

function StatRow({ label, home, away }: { label: string; home: string; away: string }) {
  return (
    <div className="grid grid-cols-[70px_1fr_70px] items-center bg-white/5 rounded-xl px-4 py-3 text-sm">
      <div className="font-black">{home}</div>
      <div className="text-center text-white/50 font-bold">{label}</div>
      <div className="font-black text-right">{away}</div>
    </div>
  );
}
