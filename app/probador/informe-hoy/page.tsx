// app/probador/informe-hoy/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { apiGet, computeLambdasFromFixture } from "@/app/utils/stats";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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








  const generateAnalysisPdf = () => {
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

  const cancelRef = useRef(false);

  async function loadFixtures() {
    try {
      setLoading(true);
      setStatus(`Cargando partidos del ${selectedDate}…`);
      setParts({});
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

  if (existing && !existing.loading && existing.rows.length > 0) return;

  const start = partIndex * CHUNK_SIZE;
  const slice = league.fixtures.slice(start, start + CHUNK_SIZE);

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
        L = {
          lambdaHome: 1.2,
          lambdaAway: 1.0,
          meta: { source: "fallback_used" },
        };
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

  for (let i = 0; i < slice.length; i += CONCURRENCY) {
    const batch = slice.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processFixture));
    await sleep(1200);
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
}



  











































 async function autoGenerateAll() {
  if (autoProg.running) return;

  cancelRef.current = false;

  const allKeys: { lg: LeagueGroup; idx: number }[] = [];

  for (const lg of leagues) {
    const partsCount = Math.ceil(lg.fixtures.length / CHUNK_SIZE);

    for (let idx = 0; idx < partsCount; idx++) {
      const key = `${lg.leagueId}-${idx}`;
      const part = parts[key];

  const start = idx * CHUNK_SIZE;
const slice = lg.fixtures.slice(start, start + CHUNK_SIZE);

if (!part || part.rows.length < slice.length) {
  allKeys.push({ lg, idx });
}
    }
  }

  setAutoProg({
    running: true,
    done: 0,
    total: allKeys.length,
    currentLabel: "Iniciando análisis optimizado…",
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
    }));

    await sleep(150);
  }

  setAutoProg((p) => ({
    ...p,
    running: false,
    currentLabel: cancelRef.current ? "Cancelado" : "Completado",
  }));
}


















  const progressPct =
    autoProg.total > 0 ? Math.round((autoProg.done / autoProg.total) * 100) : 0;

  const pct = (v?: number | null) =>
    Number.isFinite(v) ? `${(v! * 100).toFixed(1)}%` : "—";

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100 px-4 py-6 print:bg-white print:text-black">
      <header className="max-w-6xl mx-auto mb-6 flex items-center gap-3 print:hidden">
        <img
          src="/logo-irvin.png"
          alt="Irvin Analytics"
          className="h-16 w-16 rounded-xl object-contain"
        />

        <div>
          <p className="tracking-[4px] text-cyan-400 font-black text-[10px] uppercase">
            IRVIN ANALYTICS
          </p>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide">
            Informe de partidos — <span className="text-amber-300">HOY</span>
          </h1>

          <p className="text-xs text-zinc-400 mt-1">
            <span className="font-semibold text-amber-300">Irvin Analytics</span>{" "}
            · Fiabilidad de liga + filtros pro.
          </p>
        </div>
      </header>

      <section className="max-w-6xl mx-auto mb-5 flex flex-col md:flex-row md:items-center gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400">Fecha</label>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>

        <button
          type="button"
          onClick={autoGenerateAll}
          disabled={loading || autoProg.running}
          className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-black disabled:opacity-50"
        >
          {autoProg.running
            ? `Analizando ${autoProg.done}/${autoProg.total}`
            : "Iniciar análisis"}
        </button>

        <button
          type="button"

    onClick={() => {
  setPrintMode("analysis");

  const cleanPrint = () => {
    setPrintMode(null);
    window.removeEventListener("afterprint", cleanPrint);
  };

  window.addEventListener("afterprint", cleanPrint);

  setTimeout(() => {
    window.print();

    setTimeout(() => {
      cleanPrint();
    }, 1500);

  }, 300);
}}


          className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-black"
        >
          PDF ANÁLISIS
        </button>

        <button
  type="button"
  onClick={generateAnalysisPdf}
  className="rounded-xl bg-green-500 px-4 py-2 text-sm font-black text-black"
>
  Descargar PDF análisis ⚡ (rápido)
</button>

  <button
  type="button"
  onClick={() => {
    setPrintMode("live");

    const cleanPrint = () => {
      setPrintMode(null);
      window.removeEventListener("afterprint", cleanPrint);
    };

    window.addEventListener("afterprint", cleanPrint);

    setTimeout(() => {
      window.print();

      // fallback por si Chrome falla
      setTimeout(() => {
        cleanPrint();
      }, 1500);

    }, 300);
  }}
  className="rounded-xl px-4 py-2 text-sm font-black text-white"
>
  PDF en vivo
</button>

        <div className="flex-1 flex items-center gap-2">
          <label className="text-xs text-zinc-400">Buscar liga / país</label>

          <input
            type="text"
            value={searchLeague}
            onChange={(e) => setSearchLeague(e.target.value)}
            placeholder="Ej. Primera A, Champions, México..."
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>

        <div className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-full bg-black/60 border border-emerald-500/30">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          <span>{status}</span>
        </div>
      </section>

      {autoProg.running && (
        <div className="print:hidden max-w-6xl mx-auto mb-5">
          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="mt-1 text-xs text-zinc-400">
            {progressPct}% · {autoProg.currentLabel}
          </p>
        </div>
      )}

      <main className="min-h-screen bg-black text-white print:bg-white print:text-black">
        <div className="print:hidden">
          {leagues.map((lg) => {
            const total = lg.fixtures.length;
            const partsCount = Math.ceil(total / CHUNK_SIZE);

            return (
              <section
                key={lg.leagueId}
                className="rounded-[28px] border border-white/10 bg-zinc-950/80 p-6 mb-6"
              >
                <h2 className="text-lg font-semibold flex items-center gap-2">
                {lg.country ? `${lg.country} · ` : ""}{lg.leagueName}
                  {lg.country && (
                    <span className="text-zinc-400 text-sm">({lg.country})</span>
                  )}
                </h2>

                <p className="text-xs text-zinc-400 mb-4">
                  Liga ID: {lg.leagueId} · Partidos este día: {total}
                </p>

                {Array.from({ length: partsCount }).map((_, idx) => {
                  const start = idx * CHUNK_SIZE;
                  const end = Math.min(start + CHUNK_SIZE, total);
                  const key = `${lg.leagueId}-${idx}`;
                  const part = parts[key];

                  return (
                    <div
                      key={key}
                      className="rounded-2xl bg-black/60 border border-white/10 p-4 mb-4"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <div className="text-sm font-semibold">Parte {idx + 1}</div>
                          <div className="text-xs text-zinc-400">
                            Partidos {start + 1}–{end}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleGeneratePart(lg, idx)}
                          disabled={part?.loading}
                          className="px-3 py-1.5 rounded-full bg-amber-400 text-black text-xs font-semibold"
                        >
                          {part?.loading
                            ? "Calculando..."
                            : "Generar informe de esta parte"}
                        </button>
                      </div>

                      {part?.rows.map((m) => {
                        const evalRes = evaluateMatch(m);

                        return (
                          <div
                            key={m.id}
                            className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-3 mb-2"
                          >
                            <div className="grid grid-cols-[70px_1fr_110px] gap-2 items-center">
                              <div>
                                <div className="font-black">{m.timeEs}</div>
                                <div className="text-[11px] text-zinc-500">
                                  {m.timeUTC} UTC
                                </div>
                              </div>

                              <div>
                                <div className="font-bold">
                                  {m.home}{" "}
                                  <span className="text-amber-300">vs</span>{" "}
                                  {m.away}
                                </div>

                                <div className="text-[11px] text-zinc-400">
                                  {evalRes.reason}
                                </div>
                              </div>

                              <span className="rounded-full px-3 py-1 text-xs font-black bg-zinc-800 text-zinc-300 text-center">
                                {evalRes.label}
                              </span>
                            </div>

                            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-lg bg-zinc-900 px-2 py-1">
                                <div className="text-[10px] text-zinc-500">1</div>
                                <div className="font-black">{pct(m.pH)}</div>
                              </div>

                              <div className="rounded-lg bg-zinc-900 px-2 py-1">
                                <div className="text-[10px] text-zinc-500">X</div>
                                <div className="font-black">{pct(m.pD)}</div>
                              </div>

                              <div className="rounded-lg bg-zinc-900 px-2 py-1">
                                <div className="text-[10px] text-zinc-500">2</div>
                                <div className="font-black">{pct(m.pA)}</div>
                              </div>
                            </div>

                            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-lg bg-amber-500/10 border border-amber-400/20 px-2 py-2">
                                <div className="text-[10px] text-amber-300">O1.5</div>
                                <div className="font-black text-lg text-amber-300">
                                  {pct(m.pOver15)}
                                </div>
                              </div>

                              <div className="rounded-lg bg-cyan-500/10 border border-cyan-400/20 px-2 py-2">
                                <div className="text-[10px] text-cyan-300">O2.5</div>
                                <div className="font-black text-lg text-cyan-300">
                                  {pct(m.pOver25)}
                                </div>
                              </div>

                              <div className="rounded-lg bg-violet-500/10 border border-violet-400/20 px-2 py-2">
                                <div className="text-[10px] text-violet-300">O3.5</div>
                                <div className="font-black text-lg text-violet-300">
                                  {pct(m.pOver35)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        {/* PDF ANÁLISIS */}
        <div className={printMode === "analysis" ? "block print:block" : "hidden print:hidden"}>
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
        </div>

        {/* PDF EN VIVO */}
        <div className={printMode === "live" ? "block print:block" : "hidden print:hidden"}>
          
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
        </div>
      </main>
    </div>
  );
}