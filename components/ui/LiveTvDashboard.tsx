"use client";

import React, { useEffect, useMemo, useState } from "react";
import { calculateLivePoisson } from "@/lib/livePoisson";
import { calculateMomentum } from "@/lib/momentum";
import LiveHeader from "@/components/ui/live/LiveHeader";


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

function eventIcon(type: string) {
  if (type === "Goal") return "⚽";
  if (type === "Card") return "🟨";
  if (type === "subst") return "🔁";
  return "•";
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

        if (!res.ok) {
          throw new Error(`Error /api/live: ${res.status}`);
        }

        const data = await res.json();

        if (data?.errors && Object.keys(data.errors).length > 0) {
          console.warn("API-Football error:", data.errors);
        }

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
        const res = await fetch(`/api/fixture?id=${selectedId}`, { cache: "no-store" });
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
  const homeCorners = selected ? getStat(fixtureStats, selected.home, "Corner Kicks") : 0;
  const awayCorners = selected ? getStat(fixtureStats, selected.away, "Corner Kicks") : 0;
  const homeFouls = selected ? getStat(fixtureStats, selected.home, "Fouls") : 0;
  const awayFouls = selected ? getStat(fixtureStats, selected.away, "Fouls") : 0;
  const homePossession = selected ? getStat(fixtureStats, selected.home, "Ball Possession") : "0%";
  const awayPossession = selected ? getStat(fixtureStats, selected.away, "Ball Possession") : "0%";
  const homeXg = selected ? getStat(fixtureStats, selected.home, "expected_goals") : 0;
  const awayXg = selected ? getStat(fixtureStats, selected.away, "expected_goals") : 0;
  const homeYellowCards = selected ? getStat(fixtureStats, selected.home, "Yellow Cards") : 0;
  const awayYellowCards = selected ? getStat(fixtureStats, selected.away, "Yellow Cards") : 0;
  const homePassAccuracy = selected ? getStat(fixtureStats, selected.home, "Passes %") : "0%";
  const awayPassAccuracy = selected ? getStat(fixtureStats, selected.away, "Passes %") : "0%";

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

  const momentum = calculateMomentum({
    homeShots,
    awayShots,
    homeShotsOn,
    awayShotsOn,
    homeCorners,
    awayCorners,
    homePossession,
    awayPossession,
  });

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
    <main className="min-h-screen bg-[#03070b] text-white overflow-hidden">
      <div className="h-screen p-4 grid grid-rows-[64px_1fr_58px] gap-3">
<LiveHeader
  matchesCount={matches.length}
  lastUpdate={lastUpdate}
  dataMode={dataMode}
  dataModeColor={dataModeColor}
/>






        <section className="grid grid-cols-[360px_minmax(620px,1fr)_390px] gap-3 min-h-0">
          <aside className="rounded-2xl border border-white/10 bg-[#07111c]/90 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-black text-lg">PARTIDOS EN VIVO</h2>
              <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 font-black">
                {matches.length}
              </span>
            </div>

            <div className="p-2 space-y-2 overflow-y-auto h-[calc(100%-70px)]">
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full rounded-xl p-4 grid grid-cols-[70px_1fr_40px] items-center text-left transition ${
                    selected?.id === m.id
                      ? "border border-green-500 bg-green-500/10"
                      : "border border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <div>
                    <div className="text-2xl font-black text-green-400">{m.minute}</div>
                    <div className={`font-bold ${m.half === "HT" ? "text-yellow-400" : "text-green-400"}`}>
                      {m.half}
                    </div>
                  </div>

                  <div className="space-y-2 min-w-0">
                    <div className="text-[11px] text-white/40 uppercase truncate">{m.league}</div>
                    <div className="flex items-center gap-2 text-lg truncate">
                      <img src={m.homeFlag} alt={m.home} className="w-5 h-5 object-contain" />
                      <span className="truncate">{m.home}</span>
                    </div>
                    <div className="flex items-center gap-2 text-lg truncate">
                      <img src={m.awayFlag} alt={m.away} className="w-5 h-5 object-contain" />
                      <span className="truncate">{m.away}</span>
                    </div>
                  </div>

                  <div className="text-right space-y-4">
                    <div className="text-xl font-black">{m.homeScore}</div>
                    <div className="text-xl font-black">{m.awayScore}</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-2xl border border-white/10 bg-[#07111c]/90 overflow-hidden grid grid-rows-[390px_1fr]">
            <div className="relative p-6 border-b border-white/10 bg-[radial-gradient(circle_at_center,#10243a_0%,#07111c_60%,#03070b_100%)]">
              <div className="text-center text-white/60 font-bold">{selected.league.toUpperCase()}</div>

              <div className="absolute top-24 left-10 text-center max-w-[220px]">
                <img src={selected.homeFlag} alt={selected.home} className="w-24 h-24 object-contain mx-auto" />
                <div className="text-3xl font-black mt-3 truncate">{selected.home.toUpperCase()}</div>
              </div>

              <div className="absolute top-24 right-10 text-center max-w-[220px]">
                <img src={selected.awayFlag} alt={selected.away} className="w-24 h-24 object-contain mx-auto" />
                <div className="text-3xl font-black mt-3 truncate">{selected.away.toUpperCase()}</div>
              </div>

              <div className="text-center mt-12">
                <div className="inline-block mb-4 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 font-black">
                  EN VIVO
                </div>
                <div className="text-7xl font-black tracking-widest mt-2">
                  {selected.homeScore} - {selected.awayScore}
                </div>
                <div className="text-2xl font-bold mt-3">{selected.minute}</div>
                <div className="text-white/60 font-bold">{selected.half}</div>
              </div>

              <div className="absolute left-6 right-6 bottom-6">
                <div className="text-center text-white/60 mb-2 font-bold">PROBABILIDAD DE VICTORIA</div>
                <div
                  className="h-10 rounded-lg overflow-hidden grid text-center font-black"
                  style={{ gridTemplateColumns: `${prediction?.homeWin ?? 0}fr ${prediction?.draw ?? 0}fr ${prediction?.awayWin ?? 0}fr` }}
                >
                  <div className="bg-green-500 flex items-center justify-center">{prediction?.homeWin ?? 0}%</div>
                  <div className="bg-slate-500 flex items-center justify-center">{prediction?.draw ?? 0}%</div>
                  <div className="bg-blue-600 flex items-center justify-center">{prediction?.awayWin ?? 0}%</div>
                </div>
                <div className="grid grid-cols-3 text-center text-sm mt-2 text-white/60 font-bold">
                  <span className="truncate">{selected.home}</span>
                  <span>EMPATE</span>
                  <span className="truncate">{selected.away}</span>
                </div>
              </div>
            </div>

            <div className="p-4 grid grid-cols-3 gap-4 overflow-y-auto">
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
                  <div className="w-24 h-24 rounded-full border-[18px] border-green-500 border-r-blue-600" />
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
                    style={{ width: `${Math.min(100, Math.max(8, (homeShots / Math.max(1, homeShots + awayShots)) * 100))}%` }}
                  />
                </div>
              </Card>

              <Card title="PRÓXIMO GOL">
                <div className="grid grid-cols-3 text-center mt-8">
                  <div>
                    <div className="text-green-400 font-bold truncate">{selected.home}</div>
                    <div className="text-3xl font-black text-green-400">{prediction?.nextGoalHome ?? 0}%</div>
                  </div>
                  <div>
                    <div className="text-white/60 font-bold">SIN GOL</div>
                    <div className="text-3xl font-black">{prediction?.nextGoalDraw ?? 0}%</div>
                  </div>
                  <div>
                    <div className="text-blue-400 font-bold truncate">{selected.away}</div>
                    <div className="text-3xl font-black text-blue-400">{prediction?.nextGoalAway ?? 0}%</div>
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
                    <div className="text-green-400 text-xs font-bold truncate">{selected.home}</div>
                    <div className="text-2xl font-black">{prediction?.firstHalfHomeWin ?? 0}%</div>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs font-bold">EMPATE</div>
                    <div className="text-2xl font-black">{prediction?.firstHalfDraw ?? 0}%</div>
                  </div>
                  <div>
                    <div className="text-blue-400 text-xs font-bold truncate">{selected.away}</div>
                    <div className="text-2xl font-black">{prediction?.firstHalfAwayWin ?? 0}%</div>
                  </div>
                </div>
                <div className="mt-4 text-center text-white/60 text-xs font-bold">
                  xG 1ª mitad: {prediction?.firstHalfXgHome ?? 0} - {prediction?.firstHalfXgAway ?? 0}
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

          <aside className="space-y-3 min-h-0 overflow-y-auto pr-1">
            <Panel title="EVENTOS EN VIVO">
              {(fixtureEvents.length > 0 ? fixtureEvents.slice(-5).reverse() : []).map((e: any, i: number) => (
                <div key={i} className="grid grid-cols-[45px_35px_1fr_auto] py-3 border-b border-white/10 text-sm">
                  <span>{e.time?.elapsed}'</span>
                  <span>{eventIcon(e.type)}</span>
                  <span className="font-bold">{e.type}</span>
                  <span className={e.team?.name === selected.home ? "text-green-400" : "text-red-400"}>{e.team?.name}</span>
                </div>
              ))}

              {fixtureEvents.length === 0 && <div className="text-white/50 text-sm">Sin eventos disponibles todavía.</div>}
            </Panel>

            <Panel title="IRVIN AI DECISIONES">
              <div className="space-y-3">
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
                  <div className="text-white/50 text-xs font-bold">RECOMENDACIÓN PRINCIPAL</div>
                  <div className="text-3xl font-black text-green-400 mt-1">{prediction?.recommendation ?? "ESPERAR"}</div>
                  <div className="text-xs text-white/60 mt-2">
                    No es garantía de acierto. Úsalo como lectura estadística, no como apuesta segura.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <MiniBox label="ACCIÓN" value={bestAction} color="text-yellow-400" />
                  <MiniBox label="RIESGO" value={risk} color="text-red-400" />
                  <MiniBox label="CONFIANZA" value={`${prediction?.confidence ?? 0}%`} color="text-green-400" />
                  <MiniBox label="IRVIN SCORE" value={`${prediction?.irvinScore ?? 0}/100`} color="text-cyan-400" />
                </div>

                <div className="space-y-2">
                  <div className="text-white/50 text-xs font-bold">LECTURA DE LA IA</div>
                  {(aiDecisions.length > 0
                    ? aiDecisions
                    : ["⚠️ Sin suficientes datos avanzados. Mejor esperar confirmación."]
                  )
                    .slice(0, 7)
                    .map((decision, index) => (
                      <div key={index} className="rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-white/80 leading-snug">
                        {decision}
                      </div>
                    ))}
                </div>

                <div className="rounded-xl bg-[#030b13] border border-white/10 p-3 text-xs text-white/60 leading-relaxed">
                  <span className="text-white font-bold">Resumen:</span>{" "}
                  {hasStats
                    ? "El sistema está usando marcador, minuto, tiros, tiros al arco, posesión, eventos, momentum y Poisson Live."
                    : "Modo básico: esta liga no entrega estadísticas avanzadas. La decisión se basa sobre todo en marcador, minuto y eventos."}
                </div>
              </div>
            </Panel>

            <Panel title="TENDENCIA DEL PARTIDO">
              {!hasStats ? (
                <div className="h-28 flex items-center justify-center text-white/40 border border-white/10 rounded-xl text-center text-sm">
                  Momentum no disponible en modo básico
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center text-sm font-black text-green-400">{momentum.leader}</div>
                  <Progress label={selected.home} value={momentum.homePercent} color="green" />
                  <Progress label={selected.away} value={momentum.awayPercent} color="blue" />
                </div>
              )}
            </Panel>

            <Panel title="ESTADÍSTICAS DEL PARTIDO">
              {!hasStats ? (
                <div className="text-white/50 text-sm leading-relaxed">
                  Estadísticas no disponibles para este partido.
                  <br />
                  Modo básico: marcador + minuto.
                </div>
              ) : (
                [
                  ["TIROS", homeShots, awayShots],
                  ["TIROS AL ARCO", homeShotsOn, awayShotsOn],
                  ["TIROS DE ESQUINA", homeCorners, awayCorners],
                  ["FALTAS", homeFouls, awayFouls],
                  ["TARJETAS", homeYellowCards, awayYellowCards],
                  ["PASES %", homePassAccuracy, awayPassAccuracy],
                  ["POSESIÓN", homePossession, awayPossession],
                ].map((s, i) => (
                  <div key={i} className="grid grid-cols-[55px_1fr_55px] py-3 border-b border-white/10 text-sm items-center">
                    <span className="font-black">{s[1]}</span>
                    <span className="text-center text-white/60">{s[0]}</span>
                    <span className="text-right font-black">{s[2]}</span>
                  </div>
                ))
              )}
            </Panel>
          </aside>
        </section>

        <footer className="rounded-2xl border border-white/10 bg-[#07111c]/90 grid grid-cols-[160px_1fr_1fr_1fr_220px] items-center overflow-hidden">
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
    <div className="rounded-xl border border-white/10 bg-[#030b13] p-4 overflow-hidden">
      <h3 className="text-center text-white/50 font-bold text-sm">{title}</h3>
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#07111c]/90 p-4 overflow-hidden">
      <h3 className="font-black text-lg mb-3">{title}</h3>
      {children}
    </div>
  );
}

function BigLine({ value, label, color }: { value: string; label: string; color: "green" | "blue" }) {
  return (
    <div className="mt-5">
      <div className="flex justify-between items-end gap-2">
        <span className="text-3xl font-black">{value}</span>
        <span className="text-white/50 text-sm truncate">{label}</span>
      </div>
      <div className="h-3 bg-white/10 rounded-full mt-2 overflow-hidden">
        <div className={`h-full ${color === "green" ? "bg-green-500 w-[75%]" : "bg-blue-600 w-[45%]"}`} />
      </div>
    </div>
  );
}

function MiniBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 border border-white/10">
      <div className="text-white/40 text-[11px] font-bold">{label}</div>
      <div className={`text-lg font-black mt-1 ${color}`}>{value}</div>
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

function Progress({ label, value, color }: { label: string; value: number; color: "green" | "blue" }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-white/60 mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color === "green" ? "bg-green-500" : "bg-blue-600"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Ticker({ text }: { text: string }) {
  return <div className="h-full flex items-center px-6 border-r border-white/10 font-bold truncate">{text}</div>;
}
