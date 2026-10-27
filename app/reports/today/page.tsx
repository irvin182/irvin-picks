// app/reports/today/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { apiGet, computeLambdasFromFixture } from "@/app/utils/stats";
import styles from "./TodayReport.module.css";

type FixtureApi = {
  fixture: { id: number; date: string };
  league: { id: number; name: string; country?: string };
  teams: { home: { name: string }; away: { name: string } };
};

type MatchRow = {
  id: number;
  date: string;
  leagueId: number;
  leagueName: string;
  country?: string;
  home: string;
  away: string;
  lambdaH: number;
  lambdaA: number;
  pH: number;
  pD: number;
  pA: number;
  pOver15: number;
  pOver25: number;
  pOver35: number;
  pBTTS: number;
  cornersHome: number;
  cornersAway: number;
  cornersTotal: number;
  mostLikely: string;
  source: string;
  timeEs: string;
  timeUTC: string;
};

type PartState = {
  loading: boolean;
  rows: MatchRow[];
  omitted: { name: string; league: string; reason?: string }[];
};

type LeagueGroup = {
  leagueId: number;
  leagueName: string;
  country?: string;
  fixtures: FixtureApi[];
};

type AutoProgress = {
  running: boolean;
  done: number;
  total: number;
  currentLabel: string;
  fixturesDone?: number;
  fixtureTotal?: number;
};

const CHUNK_SIZE = 10;
const lambdaCache = new Map<number, any>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const factorial = (n: number) => {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};

const pois = (l: number, k: number) =>
  Math.exp(-l) * Math.pow(l, k) / factorial(k);

function calcProbs(lH: number, lA: number, max = 10) {
  let pH = 0;
  let pD = 0;
  let pA = 0;
  let best = { h: 0, a: 0, p: 0 };

  for (let h = 0; h <= max; h++) {
    const pHk = pois(lH, h);

    for (let a = 0; a <= max; a++) {
      const p = pHk * pois(lA, a);

      if (p > best.p) best = { h, a, p };

      if (h > a) pH += p;
      else if (h === a) pD += p;
      else pA += p;
    }
  }

  return { pH, pD, pA, mostLikely: `${best.h}-${best.a}` };
}

function probOver(lH: number, lA: number, line: number, max = 10) {
  let total = 0;

  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      if (h + a > line) total += pois(lH, h) * pois(lA, a);
    }
  }

  return total;
}

function probBTTS(lH: number, lA: number, max = 10) {
  let t = 0;

  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      if (h > 0 && a > 0) t += pois(lH, h) * pois(lA, a);
    }
  }

  return t;
}

function fmtDateISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getTimes(dateStr: string) {
  const d = new Date(dateStr);

  const timeUTC = d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const timeEs = d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });

  return { timeEs, timeUTC };
}

function groupByLeague(fixtures: FixtureApi[]): LeagueGroup[] {
  const map = new Map<number, LeagueGroup>();

  for (const f of fixtures) {
    const id = f.league.id;

    if (!map.has(id)) {
      map.set(id, {
        leagueId: id,
        leagueName: f.league.name,
        country: f.league.country,
        fixtures: [],
      });
    }

    map.get(id)!.fixtures.push(f);
  }

  return Array.from(map.values());
}

function getCountryFlag(country?: string) {
  if (!country) return "🌍";

  const c = country.toLowerCase();

  if (c.includes("spain")) return "🇪🇸";
  if (c.includes("italy")) return "🇮🇹";
  if (c.includes("germany")) return "🇩🇪";
  if (c.includes("france")) return "🇫🇷";
  if (c.includes("portugal")) return "🇵🇹";
  if (c.includes("netherlands")) return "🇳🇱";
  if (c.includes("belgium")) return "🇧🇪";
  if (c.includes("switzerland")) return "🇨🇭";
  if (c.includes("austria")) return "🇦🇹";
  if (c.includes("denmark")) return "🇩🇰";
  if (c.includes("norway")) return "🇳🇴";
  if (c.includes("sweden")) return "🇸🇪";
  if (c.includes("finland")) return "🇫🇮";
  if (c.includes("iceland")) return "🇮🇸";
  if (c.includes("lithuania")) return "🇱🇹";
  if (c.includes("romania")) return "🇷🇴";
  if (c.includes("kazakhstan")) return "🇰🇿";
  if (c.includes("belarus")) return "🇧🇾";
  if (c.includes("england") || c.includes("united kingdom")) return "🇬🇧";
  if (c.includes("mexico")) return "🇲🇽";
  if (c.includes("brazil")) return "🇧🇷";
  if (c.includes("argentina")) return "🇦🇷";
  if (c.includes("peru")) return "🇵🇪";
  if (c.includes("colombia")) return "🇨🇴";
  if (c.includes("chile")) return "🇨🇱";
  if (c.includes("usa") || c.includes("united states")) return "🇺🇸";

  return "🌍";
}

function evaluateMatch(row: MatchRow) {
  const totalGoals = row.lambdaH + row.lambdaA;

  if (row.pOver25 >= 0.75 && totalGoals >= 2.7) {
    return {
      status: "GREEN",
      label: "Over 2.5",
      reason: "Alta probabilidad de 3+ goles.",
    };
  }

  if (row.pBTTS >= 0.68 && row.lambdaH >= 1 && row.lambdaA >= 1) {
    return {
      status: "GREEN",
      label: "Ambos marcan",
      reason: "Ambos equipos con buen potencial de gol.",
    };
  }

  if (row.pOver15 >= 0.86 && totalGoals >= 2.3) {
    return {
      status: "YELLOW",
      label: "Over 1.5",
      reason: "Over 1.5 aceptable con riesgo medio.",
    };
  }

  return {
    status: "RED",
    label: "Riesgo Alto",
    reason: "No hay valor suficiente según modelo y fiabilidad.",
  };
}

export default function InformeHoy() {








  const generateAnalysisPdf = async () => {
  if (pdfPending.current) return;
  pdfPending.current = true;
  setPdfLoading(true);
  setPdfError(null);
  try {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"), import("jspdf-autotable"),
  ]);
  const doc = new jsPDF("p", "mm", "a4");

  let y = 10;

  doc.setFontSize(14);
  doc.text(`Informe de partidos — ${selectedDate}`, 10, y);
  y += 6;

  leagues.forEach((lg) => {
    const total = lg.fixtures.length;
    const partsCount = Math.ceil(total / CHUNK_SIZE);

    doc.setFontSize(11);
    doc.text(`${lg.leagueName} (${lg.country ?? ""})`, 10, y);
    y += 4;

    for (let idx = 0; idx < partsCount; idx++) {
      const key = `${lg.leagueId}-${idx}`;
      const part = parts[key];

      if (!part || part.rows.length === 0) continue;

      const tableData = part.rows.map((m) => {
        const evalRes = evaluateMatch(m);

        return [
          m.timeEs,
          `${m.home} vs ${m.away}`,
          evalRes.label,
          `${(m.pH * 100).toFixed(1)}%`,
          `${(m.pD * 100).toFixed(1)}%`,
          `${(m.pA * 100).toFixed(1)}%`,
          `${(m.pOver15 * 100).toFixed(1)}%`,
        `${(m.pOver25 * 100).toFixed(1)}%`,
`${(m.pOver35 * 100).toFixed(1)}%`,
`${(m.pBTTS * 100).toFixed(1)}%`,
          `L ${m.lambdaH.toFixed(1)} / V ${m.lambdaA.toFixed(1)}`,
          m.mostLikely,
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [[
          "Hora",
          "Partido",
          "Pick",
          "1",
          "X",
          "2",
          "O1.5",
          "O2.5",
          "O3.5",   // 👈 ESTA ES LA CLAVE
          "BTTS",
          "goles Esp",
          "Score"
        ]],
        body: tableData,
        styles: { fontSize: 6 },
        margin: { left: 10, right: 10 },
      });

      y = (doc as any).lastAutoTable.finalY + 6;

      if (y > 270) {
        doc.addPage();
        y = 10;
      }
    }
  });

  doc.save(`Irvin_Analytics_${selectedDate}.pdf`);
  } catch {
    setPdfError("No se pudo descargar el PDF. Puedes volver a intentarlo sin repetir el análisis.");
  } finally {
    pdfPending.current = false;
    setPdfLoading(false);
  }
};
  const [printMode, setPrintMode] = useState<"analysis" | "live" | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(fmtDateISO(new Date()));
  const [fixtures, setFixtures] = useState<FixtureApi[]>([]);
  const [status, setStatus] = useState<string>("Cargando…");
  const [loading, setLoading] = useState<boolean>(true);
  const [parts, setParts] = useState<Record<string, PartState>>({});
  const [searchLeague, setSearchLeague] = useState<string>("");

  const [autoProg, setAutoProg] = useState<AutoProgress>({
    running: false,
    done: 0,
    total: 0,
    currentLabel: "",
  });

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const inFlightParts = useRef(new Set<string>());
  const completedParts = useRef(new Set<string>());
  const autoPending = useRef(false);
  const pdfPending = useRef(false);

  async function loadFixtures() {
    try {
      setLoading(true);
      setStatus(`Cargando partidos del ${selectedDate}…`);
      setParts({});
      completedParts.current.clear();
      cancelRef.current = false;

      const data = await apiGet("fixtures", { date: selectedDate });
      const list: FixtureApi[] = data?.response ?? [];

      setFixtures(list);
      setStatus(`Encontrados ${list.length} partidos en ${groupByLeague(list).length} ligas.`);
    } catch (e: any) {
      console.error("Error cargando fixtures:", e);
      setStatus(`Error cargando fixtures: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFixtures();
  }, [selectedDate]);

  const leagues = useMemo(() => {
    const groups = groupByLeague(fixtures);

    const filtered = groups.filter((g) => {
      if (!searchLeague.trim()) return true;

      const q = searchLeague.toLowerCase();

      return (
        g.leagueName.toLowerCase().includes(q) ||
        (g.country ?? "").toLowerCase().includes(q)
      );
    });

    filtered.sort((a, b) => a.leagueName.localeCompare(b.leagueName));

    return filtered;
  }, [fixtures, searchLeague]);











async function handleGeneratePart(league: LeagueGroup, partIndex: number) {
  const key = `${league.leagueId}-${partIndex}`;
  const existing = parts[key];

  const runKey = `${selectedDate}:${key}`;
  if (inFlightParts.current.has(runKey) || completedParts.current.has(runKey)) return;

  const start = partIndex * CHUNK_SIZE;
  const slice = league.fixtures.slice(start, start + CHUNK_SIZE);
  if (existing && !existing.loading && existing.rows.length + existing.omitted.length === slice.length) return;
  inFlightParts.current.add(runKey);

  setParts((prev) => ({
    ...prev,
    [key]: {
      loading: true,
      rows: existing?.rows ?? [],
      omitted: existing?.omitted ?? [],
    },
  }));

  const rows: MatchRow[] = [];
  const omitted: { name: string; league: string; reason?: string }[] = [];

  async function processFixture(f: FixtureApi) {
    try {
      let L = lambdaCache.get(f.fixture.id);

      if (!L) {
        L = await computeLambdasFromFixture(f.fixture.id);
        lambdaCache.set(f.fixture.id, L);
      }

  if (L.meta.source === "generic_fallback" || L.meta.source === "error") {
  omitted.push({
    name: `${f.teams.home.name} vs ${f.teams.away.name}`,
    league: league.leagueName,
    reason: "Datos estadísticos insuficientes para generar una predicción fiable",
  });

  return;
}

      const lH = L.lambdaHome;
      const lA = L.lambdaAway;

      const { pH, pD, pA, mostLikely } = calcProbs(lH, lA);
      const { timeEs, timeUTC } = getTimes(f.fixture.date);

      rows.push({
        id: f.fixture.id,
        date: f.fixture.date,
        leagueId: league.leagueId,
        leagueName: league.leagueName,
        country: league.country,
        home: f.teams.home.name,
        away: f.teams.away.name,
        lambdaH: lH,
        lambdaA: lA,
        pH,
        pD,
        pA,
        pOver15: probOver(lH, lA, 1),
        pOver25: probOver(lH, lA, 2),
        pOver35: probOver(lH, lA, 3),
        pBTTS: probBTTS(lH, lA),
        cornersHome: Math.max(2, lH * 2.6),
        cornersAway: Math.max(2, lA * 2.4),
        cornersTotal: Math.max(5, lH * 2.6 + lA * 2.4),
        mostLikely,
        source: L.meta.source ?? "unknown",
        timeEs,
        timeUTC,
      });
    } catch (e) {
      console.error("Error en fixture", f.fixture.id, e);

      const lH = 1.2;
      const lA = 1.0;
      const { pH, pD, pA, mostLikely } = calcProbs(lH, lA);
      const { timeEs, timeUTC } = getTimes(f.fixture.date);

      rows.push({
        id: f.fixture.id,
        date: f.fixture.date,
        leagueId: league.leagueId,
        leagueName: league.leagueName,
        country: league.country,
        home: f.teams.home.name,
        away: f.teams.away.name,
        lambdaH: lH,
        lambdaA: lA,
        pH,
        pD,
        pA,
        pOver15: probOver(lH, lA, 1),
        pOver25: probOver(lH, lA, 2),
        pOver35: probOver(lH, lA, 3),
        pBTTS: probBTTS(lH, lA),
        cornersHome: Math.max(2, lH * 2.6),
        cornersAway: Math.max(2, lA * 2.4),
        cornersTotal: Math.max(5, lH * 2.6 + lA * 2.4),
        mostLikely,
        source: "fallback_error",
        timeEs,
        timeUTC,
      });

      omitted.push({
        name: `${f.teams.home.name} vs ${f.teams.away.name}`,
        league: league.leagueName,
        reason: "Usado fallback por error API",
      });
    }
  }

  const CONCURRENCY = 1;

  try {
  for (let i = 0; i < slice.length; i += CONCURRENCY) {
    const batch = slice.slice(i, i + CONCURRENCY);
    const needsCalculation = batch.some(f => !lambdaCache.get(f.fixture.id));
    await Promise.all(batch.map(processFixture));
    // Keep pacing for every new calculation; cached results only yield to the UI.
    await sleep(needsCalculation ? 1200 : 0);
  }

  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  setParts((prev) => ({
    ...prev,
    [key]: {
      loading: false,
      rows,
      omitted,
    },
  }));
  completedParts.current.add(runKey);
  } finally {
    inFlightParts.current.delete(runKey);
  }
}



  











































 async function autoGenerateAll(targetLeagues: LeagueGroup[] = leagues) {
  if (autoPending.current || inFlightParts.current.size > 0) return;
  autoPending.current = true;
  try {

  cancelRef.current = false;

  const allKeys: { lg: LeagueGroup; idx: number }[] = [];

  for (const lg of targetLeagues) {
    const partsCount = Math.ceil(lg.fixtures.length / CHUNK_SIZE);

    for (let idx = 0; idx < partsCount; idx++) {
      const key = `${lg.leagueId}-${idx}`;
      const part = parts[key];

  const start = idx * CHUNK_SIZE;
const slice = lg.fixtures.slice(start, start + CHUNK_SIZE);

if (!completedParts.current.has(`${selectedDate}:${key}`) && (!part || (!part.loading && part.rows.length + part.omitted.length < slice.length))) {
  allKeys.push({ lg, idx });
}
    }
  }

  setAutoProg({
    running: true,
    done: 0,
    total: allKeys.length,
    currentLabel: "Iniciando análisis…",
    fixturesDone: 0,
    fixtureTotal: allKeys.reduce((sum, { lg, idx }) => sum + lg.fixtures.slice(idx * CHUNK_SIZE, (idx + 1) * CHUNK_SIZE).length, 0),
  });

  for (let i = 0; i < allKeys.length; i++) {
    if (cancelRef.current) break;

    const { lg, idx } = allKeys[i];

    setAutoProg((p) => ({
      ...p,
      currentLabel: `${lg.leagueName} · Parte ${idx + 1}`,
    }));

    await handleGeneratePart(lg, idx);

    setAutoProg((p) => ({
      ...p,
      done: p.done + 1,
      fixturesDone: (p.fixturesDone ?? 0) + lg.fixtures.slice(idx * CHUNK_SIZE, (idx + 1) * CHUNK_SIZE).length,
    }));

    await sleep(150);
  }

  setAutoProg((p) => ({
    ...p,
    running: false,
    currentLabel: cancelRef.current ? "Cancelado" : "Completado",
  }));
  } finally {
    autoPending.current = false;
  }
}


















  const progressPct =
    autoProg.total > 0 ? Math.round((autoProg.done / autoProg.total) * 100) : 0;

  const pct = (v?: number | null) =>
    Number.isFinite(v) ? `${(v! * 100).toFixed(1)}%` : "—";

  const analyzing = autoProg.running || Object.values(parts).some(part => part.loading);
  const visibleCount = leagues.reduce((sum, league) => sum + league.fixtures.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100 px-4 py-6 print:bg-white print:text-black">
      <div className={`${styles.screen} print:hidden`}>
        <header className={styles.header}>
          <div className={styles.brand}><span aria-hidden="true">IA</span> IRVIN ANALYTICS <small>RESEARCH / MATCHDAY</small></div>
          <div className={styles.heading}><div><p className={styles.eyebrow}>INFORME DE PARTIDOS · HOY</p><h1>El juego, <span>en perspectiva.</span></h1><p>Selecciona tu liga. Analiza el contexto. Exporta tu informe.</p></div><div className={styles.count}><span><b>{fixtures.length}</b> PARTIDOS</span><span><b>{groupByLeague(fixtures).length}</b> LIGAS</span><small>Porcentajes del modelo actual · sin resultados estimados</small></div></div>
        </header>
        <div className={styles.workspace}><section className={styles.console} aria-label="Consola de análisis"><div className={styles.sectionTitle}><span>01 / CONTROL DE JORNADA</span><h2>Tu análisis empieza aquí</h2><p>Acota una competición o analiza la jornada completa.</p></div><section className={styles.controls} aria-label="Seleccionar alcance del informe">
          <label>Fecha<input type="date" value={selectedDate} disabled={analyzing || pdfLoading} onChange={e => setSelectedDate(e.target.value)} /></label>
          <label className={styles.search}>Buscar liga / país<input type="search" value={searchLeague} disabled={analyzing || pdfLoading} onChange={e => setSearchLeague(e.target.value)} placeholder="Liga o país…" /></label>
          <button type="button" className={styles.primary} onClick={() => autoGenerateAll()} disabled={loading || analyzing || pdfLoading || visibleCount === 0}>Analizar ligas visibles ({visibleCount})</button>
          <button type="button" onClick={() => autoGenerateAll(groupByLeague(fixtures).sort((a,b) => a.leagueName.localeCompare(b.leagueName)))} disabled={loading || analyzing || pdfLoading || fixtures.length === 0}>Analizar informe completo ({fixtures.length})</button>
        </section>
        <p className={styles.scope}>El análisis visible procesa solo las ligas del filtro. El informe completo incluye todos los partidos. Los PDF respetan el filtro actual.</p>
        <div className={styles.status} role="status">{status}</div>
        {(autoProg.running || autoProg.total > 0) && <section className={styles.progress} aria-label="Progreso del análisis" aria-live="polite"><div><strong>{autoProg.running ? "Preparando el informe" : autoProg.currentLabel}</strong><span>Tanda: {autoProg.fixturesDone ?? 0} / {autoProg.fixtureTotal ?? 0} partidos · {autoProg.done} / {autoProg.total} bloques</span></div><div className={styles.track} role="progressbar" aria-label="Bloques procesados" aria-valuemin={0} aria-valuemax={autoProg.total} aria-valuenow={autoProg.done}><span style={{width:`${progressPct}%`}} /></div><p>{autoProg.currentLabel} · Ritmo de consultas protegido</p></section>}
        </section><section className={styles.export} aria-label="Centro de informes PDF"><div className={styles.sectionTitle}><span>02 / INFORMES PDF</span><h2>Del análisis al informe</h2><p>Exporta los partidos analizados del filtro actual. La descarga se prepara al solicitarla.</p></div><div className={styles.pdfActions} aria-label="Exportar informe">
          <button type="button" onClick={() => {
            setPrintMode("analysis");
            const cleanPrint = () => { setPrintMode(null); window.removeEventListener("afterprint", cleanPrint); };
            window.addEventListener("afterprint", cleanPrint);
            setTimeout(() => { window.print(); setTimeout(cleanPrint, 1500); }, 300);
          }}>PDF ANÁLISIS</button>
          <button type="button" onClick={generateAnalysisPdf} disabled={pdfLoading}>{pdfLoading ? "Preparando PDF…" : "Descargar PDF análisis"}</button>
          <button type="button" onClick={() => {
            setPrintMode("live");
            const cleanPrint = () => { setPrintMode(null); window.removeEventListener("afterprint", cleanPrint); };
            window.addEventListener("afterprint", cleanPrint);
            setTimeout(() => { window.print(); setTimeout(cleanPrint, 1500); }, 300);
          }}>PDF en vivo</button>
        </div>
        {pdfError && <p className={styles.error} role="alert">{pdfError}</p>}</section></div><div className={styles.resultsHeading}><div><span>03 / MESA DE ANÁLISIS</span><h2>Lectura de la jornada</h2></div><p>{visibleCount} partidos en el filtro actual</p></div>
        <main>
          {!loading && leagues.length === 0 && <p className={styles.empty}>No hay partidos para este filtro.</p>}
          {leagues.map(lg => <section key={lg.leagueId} className={styles.league} aria-label={lg.leagueName}>
            <div className={styles.leagueHeader}><div><h2>{lg.country ? `${lg.country} · ` : ""}{lg.leagueName}</h2><p>{lg.fixtures.length} partidos · Liga {lg.leagueId}</p></div><button type="button" onClick={() => autoGenerateAll([lg])} disabled={loading || analyzing || pdfLoading}>Analizar esta liga</button></div>
            {Array.from({length:Math.ceil(lg.fixtures.length / CHUNK_SIZE)}).map((_,idx) => {
              const key = `${lg.leagueId}-${idx}`;
              const part = parts[key];
              return <div key={key} className={styles.part}>
                <div className={styles.partHeader}><span>Parte {idx+1} · Partidos {idx*CHUNK_SIZE+1}–{Math.min((idx+1)*CHUNK_SIZE,lg.fixtures.length)}</span><button type="button" onClick={() => handleGeneratePart(lg,idx)} disabled={loading || analyzing || pdfLoading}>{part?.loading ? "Calculando…" : "Generar informe de esta parte"}</button></div>
                <div className={styles.matches}>{part?.rows.map(m => {
                  const evaluation = evaluateMatch(m);
                  return <article key={m.id} className={styles.match} data-report-fixture={m.id}>
                    <div className={styles.matchMeta}><span>{lg.leagueName}</span><time dateTime={m.date}>{m.timeEs} ES <small>· {m.timeUTC} UTC</small></time></div>
                    <h3 className={styles.teams}><span><i className={styles.monogram} aria-hidden="true">{m.home.split(/\s+/).slice(0,2).map(word => word[0]).join("").toUpperCase()}</i><b>{m.home}</b></span><small>vs</small><span><i className={styles.monogram} aria-hidden="true">{m.away.split(/\s+/).slice(0,2).map(word => word[0]).join("").toUpperCase()}</i><b>{m.away}</b></span></h3>
                    <div className={styles.marketTitle}>RESULTADO · 1 / X / 2 <span>Probabilidad del modelo</span></div><div className={styles.markets} aria-label="Probabilidades 1 X 2">{[["LOCAL · 1",m.pH],["EMPATE · X",m.pD],["VISITANTE · 2",m.pA]].map(([label,value]) => <div key={String(label)}><small>{label}</small><strong>{pct(Number(value))}</strong><span className={styles.meter} aria-hidden="true"><i style={{width:`${Number(value)*100}%`}} /></span></div>)}</div>
                    <div className={styles.goals} aria-label="Probabilidades de goles">{[["O1.5",m.pOver15],["O2.5",m.pOver25],["O3.5",m.pOver35],["BTTS",m.pBTTS]].map(([label,value]) => <div key={String(label)}><small>{label}</small><strong>{pct(Number(value))}</strong></div>)}</div>
                    <footer><span className={evaluation.status === "GREEN" ? styles.green : evaluation.status === "YELLOW" ? styles.yellow : styles.risk}>{evaluation.label}</span><span>Goles esperados <b>{m.lambdaH.toFixed(1)} / {m.lambdaA.toFixed(1)}</b></span></footer><p className={styles.reason}>{evaluation.reason}</p>
                  </article>;
                })}</div>
                {part && part.omitted.length > 0 && <p className={styles.omitted}>{part.omitted.length} partidos omitidos en esta parte.</p>}
              </div>;
            })}
          </section>)}
        </main>
      </div>
      <main className="bg-black text-white print:bg-white print:text-black">
        {/* PDF ANÁLISIS */}
        {printMode === "analysis" && <div className="block print:block">
          <div className="pdf-header">
            <img src="/logo-irvin.png" alt="Irvin Analytics" />

            <div>
              <p className="tracking-[4px] text-cyan-500 font-black text-[9px] uppercase">
                IRVIN ANALYTICS
              </p>

              <h1 className="pdf-title">Informe de partidos — HOY</h1>

              <p className="pdf-subtitle">
                Irvin Analytics · Poisson + fiabilidad de liga + filtros pro.
              </p>
            </div>
          </div>


          <div className="pdf-legend">
  <strong>Guía rápida:</strong>
  <span><b>1/X/2</b> = probabilidad de local, empate y visitante.</span>
  <span><b>O1.5/O2.5/O3.5</b> = probabilidad de superar esa línea de goles.</span>
  <span><b>BTTS</b> = ambos equipos marcan.</span>
 <span><b>Goles</b> = expectativa de gol local | visitante según el modelo.</span>
</div>

          {leagues.map((lg) => {
            const total = lg.fixtures.length;
            const partsCount = Math.ceil(total / CHUNK_SIZE);

            return (
              <section key={`pdf-${lg.leagueId}`} className="pdf-page">
      <h2 className="pdf-league-title flex items-center gap-2">


<span>
  [{lg.country ?? "World"}] {lg.leagueName}
</span>




</h2>

                <p className="pdf-league-meta">
                  Liga ID: {lg.leagueId} · Partidos este día: {total}
                </p>

                {Array.from({ length: partsCount }).map((_, idx) => {
                  const key = `${lg.leagueId}-${idx}`;
                  const part = parts[key];

                  if (!part || part.rows.length === 0) return null;

                  return (
                    <table key={`pdf-table-${key}`} className="pdf-table">
                      <thead>
                        <tr>
                          <th>Hora</th>
                          <th>Partido</th>
                          <th>Pick</th>
                          <th>1</th>
                          <th>X</th>
                          <th>2</th>
                          <th>O1.5</th>
                          <th>O2.5</th>
                          <th>O3.5</th>
                          <th>BTTS</th>
                          <th>Goles</th>
                          <th>Prob.</th>
                        </tr>
                      </thead>

                      <tbody>
                        {part.rows.map((m) => {
                          const evalRes = evaluateMatch(m);

                          const pickClass =
                            evalRes.status === "GREEN"
                              ? "bg-emerald-500 text-white"
                              : evalRes.status === "YELLOW"
                              ? "bg-yellow-300 text-black"
                              : "bg-gray-200 text-gray-700";

                          return (
                            <tr key={`pdf-row-${m.id}`}>
                              <td>{m.timeEs}</td>
                              <td>{m.home} vs {m.away}</td>
                              <td>
                                <span className={`rounded-full px-2 py-0.5 font-black ${pickClass}`}>
                                  {evalRes.label}
                                </span>
                              </td>
                              <td>{pct(m.pH)}</td>
                              <td>{pct(m.pD)}</td>
                              <td>{pct(m.pA)}</td>
                              <td>{pct(m.pOver15)}</td>
                              <td>{pct(m.pOver25)}</td>
                              <td>{pct(m.pOver35)}</td>
                              <td>{pct(m.pBTTS)}</td>
                              <td>
                                {m.lambdaH.toFixed(1)}-{m.lambdaA.toFixed(1)}
                              </td>
                              <td>{m.mostLikely}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })}
              </section>
            );
          })}
        </div>}

        {/* PDF EN VIVO */}
        {printMode === "live" && <div className="block print:block">
          
          <div className="bg-black text-white px-3 py-2 mb-2 rounded-lg border border-white/10">
            <div className="flex items-center gap-2">
              <img
                src="/logo-irvin.png"
                alt="Irvin Analytics"
                className="h-8 w-8 rounded-md object-contain"
              />

              <div>
                <p className="tracking-[3px] text-cyan-400 font-black text-[7px] uppercase">
                  IRVIN ANALYTICS
                </p>

                <h1 className="text-sm font-black">
                  PDF en vivo — {selectedDate}
                </h1>

                <p className="text-[8px] text-zinc-400">
                  Cuadritos profesionales · 1X2 + Overs + lectura visual
                </p>
              </div>
            </div>
          </div>

          {leagues.map((lg) => {
            const total = lg.fixtures.length;
            const partsCount = Math.ceil(total / CHUNK_SIZE);

            return (
              <section
                key={`live-cards-${lg.leagueId}`}
                className="mb-2 rounded-xl border border-zinc-700 bg-black p-2"
              >
<h2 className="text-[14px] font-black text-white mb-2">
  [{lg.country ?? "World"}] {lg.leagueName}
</h2>

                <p className="text-[8px] text-zinc-400 mb-2">
                  Liga ID: {lg.leagueId} · Partidos: {total}
                </p>

                <div className="grid grid-cols-2 gap-2 items-start">
                  {Array.from({ length: partsCount }).map((_, idx) => {
                    const key = `${lg.leagueId}-${idx}`;
                    const part = parts[key];

                    if (!part || part.rows.length === 0) return null;

                    return part.rows.map((m) => {
                      const evalRes = evaluateMatch(m);
                      const totalXg = m.lambdaH + m.lambdaA;

                      let liveIcon = "🧊";
                      let liveText = "Partido cerrado";
                      let liveClass = "bg-zinc-900 text-zinc-200 border-zinc-600";

                      if (totalXg >= 3.2 || m.pOver25 >= 0.78 || m.pBTTS >= 0.72) {
                        liveIcon = "🔥";
                        liveText = "Partido de goles";
                        liveClass = "bg-emerald-950 text-emerald-300 border-emerald-500";
                      } else if (totalXg >= 2.4 || m.pOver15 >= 0.82 || m.pOver25 >= 0.6) {
                        liveIcon = "⚠️";
                        liveText = "Partido activo";
                        liveClass = "bg-yellow-950 text-yellow-300 border-yellow-500";
                      }

                      if (evalRes.label === "No apostar") {
                        liveIcon = "🧊";
                        liveText = "Partido cerrado";
                        liveClass = "bg-zinc-900 text-zinc-200 border-zinc-600";
                      }

                      return (
                        <div
                          key={`live-card-${m.id}`}
                          className="rounded-lg border border-zinc-700 bg-zinc-950 p-1.5 break-inside-avoid text-white"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <div className="text-[11px] font-black">{m.timeEs}</div>
                              <div className="text-[7px] text-zinc-500">{m.timeUTC} UTC</div>
                            </div>

                            <div className="text-[7px] font-black rounded-full bg-zinc-800 text-zinc-200 px-1.5 py-0.5">
                              {evalRes.label}
                            </div>
                          </div>

                          <div className="text-[9px] font-black mb-1 leading-tight">
                            {m.home} <span className="text-amber-300">vs</span> {m.away}
                          </div>

                          <div className="grid grid-cols-3 gap-1 text-center mb-1">
                            <div className="rounded bg-zinc-800 border border-zinc-700 p-1">
                              <div className="text-[6px] text-zinc-400">1</div>
                              <div className="text-[9px] font-black">{pct(m.pH)}</div>
                            </div>

                            <div className="rounded bg-zinc-800 border border-zinc-700 p-1">
                              <div className="text-[6px] text-zinc-400">X</div>
                              <div className="text-[9px] font-black">{pct(m.pD)}</div>
                            </div>

                            <div className="rounded bg-zinc-800 border border-zinc-700 p-1">
                              <div className="text-[6px] text-zinc-400">2</div>
                              <div className="text-[9px] font-black">{pct(m.pA)}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1 text-center">
                            <div className="rounded bg-yellow-950 border border-yellow-700 p-1">
                              <div className="text-[6px] text-yellow-300">O1.5</div>
                              <div className="text-[9px] font-black text-yellow-300">
                                {pct(m.pOver15)}
                              </div>
                            </div>

                            <div className="rounded bg-cyan-950 border border-cyan-700 p-1">
                              <div className="text-[6px] text-cyan-300">O2.5</div>
                              <div className="text-[9px] font-black text-cyan-300">
                                {pct(m.pOver25)}
                              </div>
                            </div>

                            <div className="rounded bg-purple-950 border border-purple-700 p-1">
                              <div className="text-[6px] text-purple-300">O3.5</div>
                              <div className="text-[9px] font-black text-purple-300">
                                {pct(m.pOver35)}
                              </div>
                            </div>
                          </div>

                          <div className={`mt-1 rounded-md border p-1 text-center ${liveClass}`}>
                            <div className="text-[10px] font-black">
                              {liveIcon} {liveText}
                            </div>

                            <div className="text-[9px] font-black text-white">
  Goles: {m.lambdaH.toFixed(1)}-{m.lambdaA.toFixed(1)} · Prob: {m.mostLikely}
</div>

<div className="text-[9px] font-black text-white">
  BTTS: {pct(m.pBTTS)} · Corners: {m.cornersTotal.toFixed(1)}
</div>

                          </div>
                        </div>
                      );
                    });
                  })}
                </div>
              </section>
            );
          })}
        </div>}
      </main>
    </div>
  );
}