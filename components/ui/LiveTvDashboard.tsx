"use client";

import styles from "./LiveTvDashboard.module.css";
import React, { useEffect, useState } from "react";
import { chooseLiveFixture, requestedFixture, parseFixtureId, SELECTED_MATCH_STORAGE_KEY, LIVE_REFRESH_EVENT } from "@/lib/liveNavigation";
import { calculateLivePoisson } from "@/lib/livePoisson";
import { readLiveStat as getStat, liveValue, type FixtureStatistics } from "@/lib/liveData";

type Match = {
  id: number;
  minuteNumber: number | null;
  half: string;
  league: string;
  leagueId?: number;
  leagueLogo?: string;
  country: string;
  homeId?: number;
  awayId?: number;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  homeFlag: string;
  awayFlag: string;
  apiUpdatedAt: number;
};

type ApiFixture = {
  fixture: { id: number; status?: { elapsed?: number | null; short?: string } };
  league?: { id?: number; name?: string; country?: string; logo?: string };
  teams?: { home?: { id?: number; name?: string; logo?: string }; away?: { id?: number; name?: string; logo?: string } };
  goals?: { home?: number | null; away?: number | null };
};
type FixtureEvent = {
  type: string;
  time?: { elapsed?: number };
  player?: { name?: string };
  team?: { name?: string };
};
type Prediction = ReturnType<typeof calculateLivePoisson>;

function mapApiFixtureToMatch(fx: ApiFixture): Match {
  return {
    id: fx.fixture?.id,
    minuteNumber: fx.fixture?.status?.elapsed ?? null,
    half: fx.fixture?.status?.short ?? "LIVE",
    league: fx.league?.name ?? "Liga",
    leagueId: fx.league?.id,
    leagueLogo: fx.league?.logo,
    country: fx.league?.country ?? "World",
    homeId: fx.teams?.home?.id,
    awayId: fx.teams?.away?.id,
    home: fx.teams?.home?.name ?? "Local",
    away: fx.teams?.away?.name ?? "Visitante",
    homeScore: fx.goals?.home ?? null,
    awayScore: fx.goals?.away ?? null,
    homeFlag: fx.teams?.home?.logo ?? "",
    awayFlag: fx.teams?.away?.logo ?? "",
    apiUpdatedAt: Date.now(),
  };
}

function getLiveMinute(match: Match) {
  if (["HT", "FT"].includes(match.half)) return match.half;
  return liveValue(match.minuteNumber, "'");
}

function statValue(value: number | null, suffix = "") {
  return value === null ? "Sin datos" : liveValue(value, suffix);
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
  const [receivedStats, setFixtureStats] = useState<FixtureStatistics[]>([]);
  const [receivedEvents, setFixtureEvents] = useState<FixtureEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("--:--:--");
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [statsCachedAt, setStatsCachedAt] = useState<number | null>(null);
  const [liveStale, setLiveStale] = useState(false);
  const [liveCachedAt, setLiveCachedAt] = useState<number | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [lastManualRefresh, setLastManualRefresh] = useState(0);
  const fixtureStats = detailsId === selected?.id ? receivedStats : [];
  const fixtureEvents = detailsId === selected?.id ? receivedEvents : [];

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let pending = false;
    let firstSelection = true;
    const requested = typeof window === "undefined" ? { requested: false, id: null } : requestedFixture(window.location.search);
    let savedId: number | null = null;
    try {
      if (typeof window !== "undefined") savedId = parseFixtureId(window.localStorage.getItem(SELECTED_MATCH_STORAGE_KEY));
    } catch { /* Storage can be blocked in private browsing; live analysis still works. */ }
    async function loadLive() {
      if (pending || !active) return;
      pending = true;
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;

        if (!res.ok || (data?.errors && Object.keys(data.errors).length > 0) || data?.error || !Array.isArray(data?.response)) {
          setLiveStale(true);
          const message = res.status === 429
            ? "Límite de API-Football alcanzado. Espera a que se renueve la cuota."
            : `No se pueden cargar los partidos (HTTP ${res.status}). Comprueba API-Football.`;
          setLiveError(message);
          setLoading(false);
          return;
        }
        setLiveStale(Boolean(data.stale));
        setLiveCachedAt(typeof data.cachedAt === "number" ? data.cachedAt : null);
        setTick(Date.now());
        setLiveError(data.stale ? "La actualización está pendiente o no está disponible; se muestra la última captura válida." : null);
        const liveGames: Match[] = Array.isArray(data.response)
          ? data.response.map(mapApiFixtureToMatch)
          : [];

        setMatches(liveGames);

        const initial = firstSelection;
        if (initial && requested.requested) {
          setSelectionNotice(requested.id === null
            ? "El identificador del enlace no es válido; se muestra un partido disponible."
            : !liveGames.some((match: Match) => match.id === requested.id)
              ? "El partido del enlace no está disponible en la lista en directo; se muestra otro encuentro si existe."
              : null);
        }
        if (liveGames.length > 0) {
          firstSelection = false;
          setSelected(current => chooseLiveFixture(liveGames, current?.id, initial ? requested.id : null, initial ? savedId : null));
        } else {
          setSelected(null);
        }

        setLastUpdate(new Date(data.cachedAt ?? Date.now()).toLocaleTimeString());
        setLoading(false);
      } catch (error) {
        if (!active) return;
        setLiveStale(true);
        console.error("loadLive dashboard", error);
        setLiveError("No se pudo conectar con el servicio de partidos.");
        setLoading(false);
      } finally {
        pending = false;
      }
    }

    loadLive();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadLive();
    }, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadLive();
    };
    const onManualRefresh = () => { void loadLive(); };
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener(LIVE_REFRESH_EVENT, onManualRefresh);
    return () => { active = false; clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); document.removeEventListener(LIVE_REFRESH_EVENT, onManualRefresh); };
  }, []);

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    let active = true;
    let pending = false;

    async function loadFixtureDetails() {
      if (!active || pending) return;
      pending = true;
      setDetailsLoading(true);
      try {
        const res = await fetch(`/api/fixture?id=${selectedId}`, {
          cache: "no-store", signal: controller.signal,
        });
        const data = await res.json();
        if (!active) return;
        if (!res.ok || data.error || (data.errors && Object.keys(data.errors).length > 0) || !Array.isArray(data.statistics) || !Array.isArray(data.events) ||
            (data.fixtureId !== undefined && String(data.fixtureId) !== String(selectedId))) {
          throw new Error("Estadísticas no disponibles temporalmente.");
        }
        setDetailsError(typeof data.eventsError === "string" ? data.eventsError : null);
        setDetailsId(selectedId ?? null);
        setStatsCachedAt(typeof data.cachedAt === "number" ? data.cachedAt : null);
        setTick(Date.now());
        setFixtureStats(data.statistics);
        setFixtureEvents(data.events);
      } catch {
        if (!active) return;
        setFixtureStats([]);
        setFixtureEvents([]);
        setDetailsError("Estadísticas no disponibles temporalmente.");
      } finally {
        pending = false;
        if (active) setDetailsLoading(false);
      }
    }

    loadFixtureDetails();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadFixtureDetails();
    }, 600000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadFixtureDetails();
    };
    const onManualRefresh = () => { void loadFixtureDetails(); };
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener(LIVE_REFRESH_EVENT, onManualRefresh);
    return () => { active = false; controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); document.removeEventListener(LIVE_REFRESH_EVENT, onManualRefresh); };

  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || typeof window === "undefined") return;
    try { window.localStorage.setItem(SELECTED_MATCH_STORAGE_KEY, String(selectedId)); } catch { /* Optional preference. */ }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("fixture", String(selectedId));
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch { /* A restricted history API must not interrupt analysis. */ }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const rail = document.querySelector<HTMLElement>("[data-live-match-list]");
    const button = rail?.querySelector<HTMLElement>(`[data-live-fixture-id="${selectedId}"]`);
    if (!rail || !button) return;
    const bounds = rail.getBoundingClientRect(), target = button.getBoundingClientRect();
    // Reveal only inside the selector; never move the page away from the scoreboard.
    if (rail.scrollWidth > rail.clientWidth && (target.left < bounds.left || target.right > bounds.right)) {
      rail.scrollLeft += target.left - bounds.left - (rail.clientWidth - target.width) / 2;
    } else if (rail.scrollHeight > rail.clientHeight && (target.top < bounds.top || target.bottom > bounds.bottom)) {
      rail.scrollTop += target.top - bounds.top - (rail.clientHeight - target.height) / 2;
    }
  }, [selectedId]);

  function manualRefresh() {
    if (Date.now() - lastManualRefresh < 30000) return;
    setLastManualRefresh(Date.now());
    // Reads the existing endpoints; no cache-busting query or provider refresh flag.
    document.dispatchEvent(new Event(LIVE_REFRESH_EVENT));
  }

  function selectMatch(match: Match) {
    if (match.id === selectedId) return;
    setFixtureStats([]);
    setFixtureEvents([]);
    setDetailsError(null);
    setDetailsLoading(true);
    setSelectionNotice(null);
    setSelected(match);
  }

  const selectedMatch = selected ?? matches[0] ?? null;

  if (!selectedMatch) {
    return (
      <main className={styles.page}><div className={styles.emptyState}>
        <h1>IRVIN ANALYTICS</h1><p>{loading ? "Cargando partidos..." : liveError ?? "No hay partidos en vivo"}</p>
      </div></main>
    );
  }

  const homeShots = getStat(fixtureStats, selectedMatch.homeId ?? selectedMatch.home, "Total Shots");
  const awayShots = getStat(fixtureStats, selectedMatch.awayId ?? selectedMatch.away, "Total Shots");
  const homeShotsOn = getStat(fixtureStats, selectedMatch.homeId ?? selectedMatch.home, "Shots on Goal");
  const awayShotsOn = getStat(fixtureStats, selectedMatch.awayId ?? selectedMatch.away, "Shots on Goal");
  const homePossession = getStat(fixtureStats, selectedMatch.homeId ?? selectedMatch.home, "Ball Possession");
  const awayPossession = getStat(fixtureStats, selectedMatch.awayId ?? selectedMatch.away, "Ball Possession");
  const homeXg = getStat(fixtureStats, selectedMatch.homeId ?? selectedMatch.home, "expected_goals");
  const awayXg = getStat(fixtureStats, selectedMatch.awayId ?? selectedMatch.away, "expected_goals");

  const homeCorners = getStat(fixtureStats, selectedMatch.homeId ?? selectedMatch.home, "Corner Kicks");
  const awayCorners = getStat(fixtureStats, selectedMatch.awayId ?? selectedMatch.away, "Corner Kicks");

  const prediction: Prediction = calculateLivePoisson({
    homeScore: selectedMatch.homeScore,
    awayScore: selectedMatch.awayScore,
    minuteText: selectedMatch.minuteNumber === null ? "" : String(selectedMatch.minuteNumber),
    status: selectedMatch.half,
    homeXg, awayXg, stale: liveStale,
    fixtureAgeSeconds: tick > 0 && typeof liveCachedAt === "number" ? (tick-liveCachedAt)/1000 : null,
    statisticsAgeSeconds: tick > 0 && typeof statsCachedAt === "number" ? (tick-statsCachedAt)/1000 : null,
    homeShots,
    awayShots,
    homeShotsOn,
    awayShotsOn,
    homePossession,
    awayPossession,
  });

  const dataQuality = prediction.dataQuality ?? "insuficiente";
  const settled = prediction.settled ?? [];
  const missingLabels: Record<string, string> = {
    homeShots: "tiros local", awayShots: "tiros visitante", homeShotsOn: "tiros a puerta local", awayShotsOn: "tiros a puerta visitante",
    homePossession: "posesión local", awayPossession: "posesión visitante", homeXg: "xG local", awayXg: "xG visitante",
  };
  const missing = (prediction.missingMetrics ?? []).map(key => missingLabels[key] ?? key);
  const unavailableReason = detailsLoading
    ? "Actualizando estadísticas del partido seleccionado."
    : detailsId !== selectedMatch.id || fixtureStats.length === 0
      ? detailsError ?? "La respuesta de estadísticas no contiene datos de los equipos de este partido."
      : prediction.modelStatus === "no evaluable"
        ? [missing.length ? `Sin datos: ${missing.join(", ")}.` : "", ...(prediction.issues ?? [])].filter(Boolean).join(" ")
        : null;

  const groups = new Map<string, {name: string; logo?: string; matches: Match[]}>();
  for (const match of matches) {
    const key = match.leagueId == null ? `${match.country}:${match.league}` : String(match.leagueId);
    if (!groups.has(key)) groups.set(key, {name: `${match.country} · ${match.league}`, logo: match.leagueLogo, matches: []});
    groups.get(key)!.matches.push(match);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}><span className={styles.brandMark}>IA</span><div><h1><span>IRVIN</span> ANALYTICS</h1><p className={styles.terminalLabel}>PRO TERMINAL <span className={styles.version}>2.0</span></p></div></div>
          <div className={styles.headerMeta}>
            <span className={styles.liveBadge}>● {matches.length} partidos en vivo</span>
            <span className={styles.qualityBadge}>Datos: {dataQuality}</span>
            <span className={styles.timestamp}>Última captura <strong>{lastUpdate}</strong></span>
            <button type="button" className={styles.refreshButton} onClick={manualRefresh}
              disabled={loading || detailsLoading || (lastManualRefresh > 0 && tick - lastManualRefresh < 30000)}
              title="Lee la captura disponible respetando los intervalos de actualización">Actualizar</button>
          </div>
        </header>

        <div className={styles.layout}>
          <div className={styles.scoreArea}>
            <ScoreBoard match={selectedMatch} minute={getLiveMinute(selectedMatch)} prediction={prediction} />
          </div>
          <aside className={styles.matchPanel} aria-label="Selector de partidos">
            <div className={styles.panelHeading}><h2>Partidos en vivo</h2><span>{matches.length}</span></div>
            {selectionNotice && <p className={styles.alert} role="status">{selectionNotice}</p>}
            {liveError && <p className={styles.alert} role="alert">{liveError} Se conserva la última lista recibida.</p>}
            <div className={styles.matchList} data-live-match-list role="region" aria-label="Partidos disponibles; desplaza para ver más" tabIndex={0}>
              {[...groups.entries()].map(([key, group]) => <section className={styles.matchGroup} key={key} aria-label={group.name}>
                <h3 className={styles.leagueHeading}>{group.logo && <img src={group.logo} alt="" width={24} height={24} />}<span>{group.name}</span><span>{group.matches.length}</span></h3>
                <div className={styles.matchGroupGames}>
              {group.matches.map(m => <button key={m.id} type="button" onClick={() => selectMatch(m)} aria-pressed={selectedMatch.id === m.id} data-live-fixture-id={m.id}
                className={`${styles.matchButton} ${selectedMatch.id === m.id ? styles.selectedMatch : ""}`}>
                <span className={styles.matchMeta}><span>{getLiveMinute(m)}</span><span>{liveValue(m.homeScore)} – {liveValue(m.awayScore)}</span></span>
                <span className={styles.matchTeam}>{m.homeFlag && <img src={m.homeFlag} alt="" width={20} height={20} />}<span>{m.home}</span></span>
                <span className={styles.matchTeam}>{m.awayFlag && <img src={m.awayFlag} alt="" width={20} height={20} />}<span>{m.away}</span></span>
                <span className={styles.matchLeague}>{m.country} · {m.league}</span>
              </button>)}
                </div>
              </section>)}
            </div>
          </aside>

          <section className={styles.analysis} aria-label="Análisis del partido seleccionado" aria-busy={detailsLoading || (detailsId !== selectedMatch.id && !detailsError)}>
            {detailsError && <p className={styles.alert} role="alert">{detailsError}</p>}
            {unavailableReason && <p className={styles.dataNotice} role="status">{unavailableReason}</p>}
            <div className={styles.summaryLine} role="status"><span className={styles.qualityBadge}>Calidad {dataQuality}</span><span>Confianza no evaluable</span></div>

            <div className={styles.metricsGrid}>
              <MetricCard title="xG del proveedor" value={`${statValue(homeXg)} - ${statValue(awayXg)}`} missing={homeXg == null || awayXg == null} note="Estimación del proveedor" />
              <MetricCard title="Posesión" value={`${statValue(homePossession, "%")} / ${statValue(awayPossession, "%")}`} missing={homePossession == null || awayPossession == null} note="Local / Visitante" />
              <MetricCard title="Tiros totales" value={`${statValue(homeShots)} - ${statValue(awayShots)}`} missing={homeShots == null || awayShots == null} note="Local / Visitante" />
              <MetricCard title="Tiros a puerta" value={`${statValue(homeShotsOn)} - ${statValue(awayShotsOn)}`} missing={homeShotsOn == null || awayShotsOn == null} note="Local / Visitante" />
              <MetricCard title="Córners" value={`${statValue(homeCorners)} - ${statValue(awayCorners)}`} missing={homeCorners == null || awayCorners == null} note="Local / Visitante" />
            </div>

            <div className={styles.sectionTitle}><span className={styles.sectionIndex}>01</span><h2 className={styles.sectionHeading}>Mercados del partido</h2><span className={styles.sectionCaption}>Lectura estadística</span></div>
            <p className={styles.sectionNote}>Las estimaciones no están calibradas. «Observado» indica un resultado conocido según el marcador recibido.</p>
            <div className={styles.marketsGrid}>
              <MarketCard title="Resultado · 1X2">
                <Probability label={selectedMatch.home} value={prediction.homeWin} observed={settled.includes("result")} />
                <Probability label="Empate" value={prediction.draw} observed={settled.includes("result")} />
                <Probability label={selectedMatch.away} value={prediction.awayWin} observed={settled.includes("result")} />
              </MarketCard>
              <MarketCard title="Próximo gol · hasta el minuto 90">
                <Probability label={selectedMatch.home} value={prediction.nextGoalHome} observed={settled.includes("nextGoal")} />
                <Probability label="Sin gol" value={prediction.nextGoalDraw} observed={settled.includes("nextGoal")} />
                <Probability label={selectedMatch.away} value={prediction.nextGoalAway} observed={settled.includes("nextGoal")} />
              </MarketCard>
              <MarketCard title="Total de goles">
                <Probability label="Más de 1.5" value={prediction.over15} observed={settled.includes("over15")} />
                <Probability label="Más de 2.5" value={prediction.over25} observed={settled.includes("over25")} />
                <Probability label="Más de 3.5" value={prediction.over35} observed={settled.includes("over35")} />
              </MarketCard>
              <MarketCard title="Ambos equipos anotan · BTTS">
                <Probability label="Sí" value={prediction.bttsYes} observed={settled.includes("btts")} />
                <Probability label="No" value={prediction.bttsNo} observed={settled.includes("btts")} />
              </MarketCard>
              <MarketCard title="Resultado de la primera mitad">
                <Probability label={selectedMatch.home} value={prediction.firstHalfHomeWin} observed={settled.includes("firstHalf")} />
                <Probability label="Empate" value={prediction.firstHalfDraw} observed={settled.includes("firstHalf")} />
                <Probability label={selectedMatch.away} value={prediction.firstHalfAwayWin} observed={settled.includes("firstHalf")} />
              </MarketCard>
            </div>

            <details className={styles.methodology}>
              <summary>Cómo interpretar el análisis</summary>
              <div className={styles.methodologyBody}>
                <p>Datos del proveedor: marcador, minuto y estadísticas disponibles. Los xG son estimaciones del proveedor.</p>
                <p>Modelo: {prediction.modelStatus ?? "no evaluable"}. {prediction.aiSummary}</p>
                <p>Los sucesos cumplidos se muestran según el marcador recibido, sujeto a correcciones. Calidad de datos no equivale a confianza predictiva.</p>
                {(prediction.issues ?? []).length > 0 && <ul>{prediction.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
              {(prediction.aiDecisions ?? []).length > 0 && <ul className={styles.decisions}>{prediction.aiDecisions.slice(0,5).map((item,index) => <li key={index}>{item}</li>)}</ul>}
                <p>Estimaciones a 90 minutos, sin añadido ni prórroga. La lista lee la caché compartida cada 30 segundos; el proveedor se actualiza como máximo cada cinco minutos.</p>
              </div>
            </details>
          </section>

          <aside className={styles.insights} aria-label="Estado del análisis y eventos">
            <section className={`${styles.panel} ${styles.analysisPanel}`} data-ui-card>
              <div className={styles.analysisHeading}><span className={styles.analysisSymbol} aria-hidden="true">⌁</span><div><span className={styles.eyebrow}>IRVIN ANALYTICS</span><h2 className={styles.sectionHeading}>Panel de análisis</h2></div></div>
              <div className={styles.recommendation} data-ui-card><span className={styles.eyebrow}>Recomendación</span><p>{prediction.recommendation ?? "Sin recomendación validada"}</p></div>
              <div className={styles.decisionsGrid}>
                <DecisionBox title="Confianza" value="No evaluable" />
                <DecisionBox title="Riesgo" value="No evaluable" />
                <DecisionBox title="Irvin Score" value="No evaluable" />
                <DecisionBox title="Estado" value={prediction.modelStatus ?? "No evaluable"} />
              </div>
            </section>
            <section className={styles.panel} data-ui-card>
              <div className={styles.panelHeading}><h2>Eventos</h2><span>{fixtureEvents.length}</span></div>
              {fixtureEvents.length === 0 ? <p className={styles.emptyNote}>Sin eventos disponibles todavía.</p> :
                <ol className={styles.events}>{fixtureEvents.slice(-5).reverse().map((event,index) => <li key={index}>
                  <span className={styles.eventMinute}>{event.time?.elapsed}&apos; {eventIcon(event.type)}</span>
                  <div><strong>{event.type}</strong><p>{event.player?.name ?? event.team?.name}</p></div>
                </li>)}</ol>}
            </section>
          </aside>
        </div>
        <footer className={styles.footer}><span>IRVIN ANALYTICS · PRO TERMINAL 2.0</span><span>Partido {selectedMatch.id} · {fixtureStats.length} equipos con estadísticas · {fixtureEvents.length} eventos</span></footer>
      </div>
    </main>
  );
}

function ScoreBoard({match, minute, prediction}: {match: Match; minute: string; prediction: Prediction}) {
  return <section className={styles.scoreboard} aria-label="Marcador" data-ui-card>
    <p className={styles.league}>{match.country} · {match.league}</p>
    <div className={styles.scoreGrid}>
      <TeamBlock name={match.home} logo={match.homeFlag} side="Local" />
      <div className={styles.scoreCenter}><span className={styles.liveBadge}>En vivo</span><div className={styles.score}><strong data-score-side="home">{liveValue(match.homeScore)}</strong><span>–</span><strong data-score-side="away">{liveValue(match.awayScore)}</strong></div><p>{minute} · {match.half}</p></div>
      <TeamBlock name={match.away} logo={match.awayFlag} side="Visitante" />
    </div>
    {prediction.homeWin == null && <p className={styles.emptyNote}>Resultado: no evaluable</p>}
  </section>;
}
function TeamBlock({name, logo, side}: {name: string; logo: string; side: string}) {
  return <div className={styles.teamBlock} data-side={side === "Local" ? "home" : "away"}>{logo && <img src={logo} alt="" width={44} height={44} />}<span className={styles.eyebrow}>{side}</span><strong>{name}</strong></div>;
}
function MetricCard({title,value,missing,note}: {title: string; value: string; missing: boolean; note: string}) {
  return <section className={styles.metric} data-ui-card><h3>{title}</h3><p className={missing ? styles.missingMetric : styles.metricValue}>{value}</p><span className={styles.emptyNote}>{note}</span></section>;
}
function MarketCard({title,children}: {title: string; children: React.ReactNode}) {
  return <section className={styles.market} data-ui-card><h3>{title}</h3><div className={styles.probabilityGrid}>{children}</div></section>;
}
function Probability({label,value,observed}: {label: string; value: number | null | undefined; observed: boolean}) {
  const available = typeof value === "number" && Number.isFinite(value);
  const mode = !available ? "missing" : observed ? "observed" : "estimated";
  return <div className={styles.probability} data-probability={mode}>
    <span className={styles.probabilityLabel}>{label}</span>
    <strong className={available ? styles.probabilityValue : styles.missingValue}>{available ? liveValue(value,"%") : "No evaluable"}</strong>
    <span className={`${styles.probabilityKind} ${observed && available ? styles.observedKind : ""}`}>{!available ? "Sin datos" : observed ? "Observado" : "Estimación"}</span>
  </div>;
}
function DecisionBox({title,value}: {title: string; value: string}) {
  return <div className={styles.decision} data-ui-card><h3>{title}</h3><p>{value}</p></div>;
}
