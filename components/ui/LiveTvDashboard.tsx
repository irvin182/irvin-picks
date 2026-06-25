"use client";

import React, { useEffect, useMemo, useState } from "react";
import { calculateLivePoisson } from "@/lib/livePoisson";
import LiveHeader from "@/components/ui/live/LiveHeader";
import MatchSelector from "@/components/ui/live/MatchSelector";
import ScoreBoard from "@/components/ui/live/ScoreBoard";
import IrvinAIPanel from "@/components/ui/live/IrvinAIPanel";

type Match = {
  id: number;
  minute: string;
  half: string;
  league: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  homeFlag: string;
  awayFlag: string;
};

function getStat(stats: any[], teamName: string, statName: string) {
  const team = stats.find((s) => s.team?.name === teamName);
  const stat = team?.statistics?.find((x: any) => x.type === statName);
  return stat?.value ?? 0;
}

function actionLabel(score: number) {
  if (score >= 85) return "ENTRADA FUERTE";
  if (score >= 70) return "ENTRADA MODERADA";
  if (score >= 50) return "OBSERVAR";
  return "NO ENTRAR";
}

function riskLabel(score: number) {
  if (score >= 85) return "RIESGO BAJO";
  if (score >= 70) return "RIESGO MEDIO";
  if (score >= 50) return "RIESGO ALTO";
  return "SIN VALOR";
}

export default function LiveTvDashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [fixtureStats, setFixtureStats] = useState<any[]>([]);
  const [fixtureEvents, setFixtureEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLive() {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) throw new Error(`Error /api/live: ${res.status}`);

        const data = await res.json();

        const realMatches: Match[] = Array.isArray(data.response)
          ? data.response.map((item: any) => ({
              id: item.fixture.id,
              minute: item.fixture.status.elapsed
                ? `${item.fixture.status.elapsed}'`
                : item.fixture.status.short ?? "LIVE",
              half: item.fixture.status.short ?? "LIVE",
              league: item.league?.name ?? "Liga",
              home: item.teams?.home?.name ?? "Local",
              away: item.teams?.away?.name ?? "Visitante",
              homeScore: item.goals?.home ?? 0,
              awayScore: item.goals?.away ?? 0,
              homeFlag: item.teams?.home?.logo ?? "",
              awayFlag: item.teams?.away?.logo ?? "",
            }))
          : [];

        setMatches(realMatches);
        setLastUpdate(new Date().toLocaleTimeString());

        if (!selectedId && realMatches.length > 0) {
          setSelectedId(realMatches[0].id);
        }
      } catch (error) {
        console.error("Error cargando partidos en vivo:", error);
      } finally {
        setLoading(false);
      }
    }

    loadLive();
    const interval = setInterval(loadLive, 300000);
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;

    async function loadFixtureDetails() {
      try {
        const res = await fetch(`/api/fixture?id=${selectedId}`, {
          cache: "no-store",
        });
        const data = await res.json();

        setFixtureStats(data.statistics ?? []);
        setFixtureEvents(data.events ?? []);
      } catch (error) {
        console.error("Error cargando detalles del partido:", error);
      }
    }

    loadFixtureDetails();
    const interval = setInterval(loadFixtureDetails, 300000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const selected = useMemo(
    () => matches.find((m) => m.id === selectedId) ?? matches[0],
    [matches, selectedId]
  );

  const homeShots = selected ? getStat(fixtureStats, selected.home, "Total Shots") : 0;
  const awayShots = selected ? getStat(fixtureStats, selected.away, "Total Shots") : 0;
  const homeShotsOn = selected ? getStat(fixtureStats, selected.home, "Shots on Goal") : 0;
  const awayShotsOn = selected ? getStat(fixtureStats, selected.away, "Shots on Goal") : 0;
  const homePossession = selected ? getStat(fixtureStats, selected.home, "Ball Possession") : "0%";
  const awayPossession = selected ? getStat(fixtureStats, selected.away, "Ball Possession") : "0%";
  const homeXg = selected ? getStat(fixtureStats, selected.home, "expected_goals") : 0;
  const awayXg = selected ? getStat(fixtureStats, selected.away, "expected_goals") : 0;

  const hasStats = fixtureStats.length > 0;
  const dataMode = hasStats ? "MODO COMPLETO" : "MODO BÁSICO";
  const dataModeColor = hasStats ? "text-green-400" : "text-yellow-400";
  const dataModeMessage = hasStats
    ? "Stats + eventos + Poisson Live"
    : "Esta liga no ofrece estadísticas avanzadas";

  const prediction = selected
    ? calculateLivePoisson({
        homeScore: selected.homeScore,
        awayScore: selected.awayScore,
        minuteText: selected.minute,
        homeShots,
        awayShots,
        homeShotsOn,
        awayShotsOn,
        homePossession,
        awayPossession,
      })
    : null;

  const aiDecisions = ((prediction as any)?.aiDecisions ?? []) as string[];
  const bestAction = actionLabel(prediction?.irvinScore ?? 0);
  const risk = riskLabel(prediction?.irvinScore ?? 0);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#03070b] text-white flex items-center justify-center text-center">
        <div>
          <h1 className="text-4xl font-black text-green-400">IRVIN ANALYTICS</h1>
          <p className="text-2xl font-bold mt-6">Cargando partidos en vivo...</p>
        </div>
      </main>
    );
  }

  if (matches.length === 0) {
    return (
      <main className="min-h-screen bg-[#03070b] text-white flex items-center justify-center text-center">
        <div>
          <h1 className="text-4xl font-black text-green-400">IRVIN ANALYTICS</h1>
          <p className="text-2xl font-bold mt-6">No hay partidos en vivo ahora mismo</p>
          <p className="text-white/50 mt-3">API-Football está conectada correctamente.</p>
        </div>
      </main>
    );
  }

  if (!selected) return null;

  return (
    <main className="h-screen bg-[#03070b] text-white overflow-hidden">
      <div className="h-screen p-2 grid grid-rows-[58px_minmax(0,1fr)_34px] gap-2 text-[80%]">
        <LiveHeader
          matchesCount={matches.length}
          lastUpdate={lastUpdate}
          dataMode={dataMode}
          dataModeColor={dataModeColor}
        />

        <section className="grid grid-cols-[210px_minmax(0,1fr)_290px] gap-2 min-h-0">
          <MatchSelector
            matches={matches}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />

          <section className="rounded-2xl border border-white/10 bg-[#07111c]/90 overflow-hidden grid grid-rows-[130px_minmax(0,1fr)] min-h-0">
            <ScoreBoard selected={selected} prediction={prediction} />

            <div className="p-2 grid grid-cols-3 gap-2 overflow-y-auto min-h-0">
              <Card title="GOLES ESPERADOS (xG)">
                {!hasStats ? (
                  <div className="h-full flex items-center justify-center text-white/40 text-sm text-center">
                    xG no disponible
                  </div>
                ) : (
                  <>
                    <BigLine value={String(homeXg ?? 0)} label={selected.home} color="green" />
                    <BigLine value={String(awayXg ?? 0)} label={selected.away} color="blue" />
                  </>
                )}
              </Card>

              <Card title="POSESIÓN">
                <div className="flex items-center justify-center gap-8 h-full">
                  <span className="text-3xl font-black">{homePossession}</span>
                  <div className="w-20 h-20 rounded-full border-[16px] border-green-500 border-r-blue-600" />
                  <span className="text-3xl font-black">{awayPossession}</span>
                </div>
              </Card>

              <Card title="TIROS TOTALES">
                <div className="flex items-center justify-between text-4xl font-black mt-8">
                  <span>{homeShots}</span>
                  <span>{awayShots}</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full mt-6 overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(8, (homeShots / Math.max(1, homeShots + awayShots)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </Card>

              <Card title="PRÓXIMO GOL">
                <div className="grid grid-cols-3 text-center mt-8">
                  <div>
                    <div className="text-green-400 font-bold truncate">{selected.home}</div>
                    <div className="text-3xl font-black text-green-400">
                      {prediction?.nextGoalHome ?? 0}%
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 font-bold">SIN GOL</div>
                    <div className="text-3xl font-black">
                      {prediction?.nextGoalDraw ?? 0}%
                    </div>
                  </div>
                  <div>
                    <div className="text-blue-400 font-bold truncate">{selected.away}</div>
                    <div className="text-3xl font-black text-blue-400">
                      {prediction?.nextGoalAway ?? 0}%
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="LÍNEA DE GOLES">
                <div className="grid grid-cols-3 mt-8 text-center">
                  <Market label="+1.5" value={prediction?.over15 ?? 0} />
                  <Market label="+2.5" value={prediction?.over25 ?? 0} />
                  <Market label="+3.5" value={prediction?.over35 ?? 0} />
                </div>
              </Card>

              <Card title="1ª MITAD">
                <div className="grid grid-cols-3 mt-5 text-center">
                  <div>
                    <div className="text-green-400 text-xs font-bold truncate">
                      {selected.home}
                    </div>
                    <div className="text-2xl font-black">
                      {prediction?.firstHalfHomeWin ?? 0}%
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs font-bold">EMPATE</div>
                    <div className="text-2xl font-black">
                      {prediction?.firstHalfDraw ?? 0}%
                    </div>
                  </div>
                  <div>
                    <div className="text-blue-400 text-xs font-bold truncate">
                      {selected.away}
                    </div>
                    <div className="text-2xl font-black">
                      {prediction?.firstHalfAwayWin ?? 0}%
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center text-white/60 text-xs font-bold">
                  xG 1ª mitad: {prediction?.firstHalfXgHome ?? 0} -{" "}
                  {prediction?.firstHalfXgAway ?? 0}
                </div>
              </Card>

              <Card title="AMBOS ANOTAN (BTTS)">
                <div className="grid grid-cols-2 mt-8 text-center">
                  <div>
                    <div className="text-white/60">SÍ</div>
                    <div className="text-3xl font-black text-green-400">
                      {(prediction as any)?.bttsYes ?? (prediction as any)?.btts ?? 0}%
                    </div>
                  </div>

                  <div>
                    <div className="text-white/60">NO</div>
                    <div className="text-3xl font-black text-red-400">
                      {(prediction as any)?.bttsNo ??
                        100 - ((prediction as any)?.btts ?? 0)}
                      %
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          <IrvinAIPanel
            fixtureEvents={fixtureEvents}
            selected={selected}
            prediction={prediction}
            bestAction={bestAction}
            risk={risk}
            aiDecisions={aiDecisions}
            hasStats={hasStats}
          />
        </section>

        <footer className="rounded-2xl border border-white/10 bg-[#07111c]/90 grid grid-cols-[120px_1fr_1fr_1fr_180px] items-center overflow-hidden">
          <div className="h-full flex items-center justify-center text-yellow-400 font-black text-xl border-r border-white/10">
            🔔 ALERTAS
          </div>
          <Ticker text={`ID: ${selected.id} | STATS: ${fixtureStats.length} | EVENTS: ${fixtureEvents.length} | ⚽ ${selected.home} ${selected.homeScore}-${selected.awayScore} ${selected.away}`} />
          <Ticker text={`🔥 IA: ${prediction?.recommendation ?? "ESPERAR"} · ${bestAction} · Confianza ${prediction?.confidence ?? 0}%`} />
          <Ticker text={`📊 ${dataModeMessage}`} />
          <div className="text-center text-white/60 font-bold">
            DATOS ACTUALIZADOS
            <br />
            <span className="text-green-400">CADA 5 MIN</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#030b13] p-1.5 overflow-hidden min-h-[86px]">
      <h3 className="text-center text-white/50 font-bold text-[11px] leading-tight">
        {title}
      </h3>
      {children}
    </div>
  );
}

function BigLine({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: "green" | "blue";
}) {
  return (
    <div className="mt-5">
      <div className="flex justify-between items-end gap-2">
        <span className="text-3xl font-black">{value}</span>
        <span className="text-white/50 text-sm truncate">{label}</span>
      </div>
      <div className="h-3 bg-white/10 rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full ${
            color === "green" ? "bg-green-500 w-[75%]" : "bg-blue-600 w-[45%]"
          }`}
        />
      </div>
    </div>
  );
}

function Market({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-white/60">{label}</div>
      <div className="text-3xl font-black">{value}%</div>
    </div>
  );
}

function Ticker({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center px-2 border-r border-white/10 text-xs font-semibold truncate">
      {text}
    </div>
  );
}
