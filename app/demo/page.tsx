"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type LiveMatch = {
  fixture?: {
    id?: number;
    status?: {
      elapsed?: number | null;
      short?: string;
      long?: string;
    };
  };
league?: {
  name?: string;
  country?: string;
  logo?: string;
  flag?: string;
};  
  teams?: {
    home?: { name?: string; logo?: string };
    away?: { name?: string; logo?: string };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  events?: any[];
};

export default function DemoPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const analysisRef = useRef<HTMLDivElement | null>(null);

  async function loadLive() {
    try {
      setError("");

      const res = await fetch("/api/demo-live", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "No se pudieron cargar partidos en vivo.");
        return;
      }

      const newMatches: LiveMatch[] = json?.response || [];

      setMatches(newMatches);

      setSelectedId((currentId) => {
        if (!newMatches.length) return null;

        const stillExists = newMatches.some(
          (m) => m.fixture?.id === currentId
        );

        if (currentId && stillExists) return currentId;

        return newMatches[0]?.fixture?.id ?? null;
      });
    } catch {
      setError("Error conectando con el sistema en vivo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLive();
    const timer = setInterval(loadLive, 60000);
    return () => clearInterval(timer);
  }, []);

  const selectedMatch =
    matches.find((m) => m.fixture?.id === selectedId) || matches[0];

  function selectMatch(match: LiveMatch) {
    setSelectedId(match.fixture?.id ?? null);

    setTimeout(() => {
      analysisRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  return (
    <main className="min-h-screen bg-[#03070b] text-white px-4 py-8">
      <section className="max-w-7xl mx-auto">
        <header className="text-center">
          <div className="inline-flex px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-black text-sm">
            DEMO REAL EN VIVO
          </div>

          <h1 className="text-4xl md:text-6xl font-black mt-6 leading-tight">
            Prueba limitada de{" "}
            <span className="text-green-400">Irvin Analytics</span>
          </h1>

          <p className="text-white/60 text-lg md:text-xl mt-6 max-w-4xl mx-auto">
            Partidos reales en vivo. La IA avanzada, BTTS, Próximo Gol,
            Momentum e informes están bloqueados para usuarios Premium.
          </p>
        </header>

        {loading && (
          <Box>
            <p className="text-green-400 font-black">
              Cargando partidos en vivo...
            </p>
          </Box>
        )}

        {!loading && error && (
          <Box red>
            <p>{error}</p>
          </Box>
        )}

        {!loading && !error && matches.length === 0 && (
          <Box yellow>
            <h2 className="text-3xl font-black text-yellow-400">
              No hay partidos en vivo ahora mismo
            </h2>
            <p className="text-white/60 mt-4">
              Vuelve cuando haya partidos activos o revisa los planes para
              desbloquear informes e IA avanzada.
            </p>

            <Link
              href="/pricing"
              className="inline-block mt-8 rounded-2xl bg-green-500 px-8 py-4 text-black font-black"
            >
              VER PLANES
            </Link>
          </Box>
        )}

        {!loading && !error && matches.length > 0 && selectedMatch && (





          <>
           <section ref={analysisRef} className="mt-10">
  <MatchAnalysis match={selectedMatch} />
</section>

<section className="mt-8 rounded-3xl border border-white/10 bg-[#07111c] p-5">
  <div className="flex items-center justify-between gap-4 mb-5">
    <div>
      <h2 className="text-2xl font-black">Cambiar partido</h2>
      <p className="text-white/45 text-sm mt-1">
        Selecciona otro partido real en vivo.
      </p>
    </div>

    <span className="rounded-full bg-green-500/20 px-4 py-2 text-green-400 font-black">
      {matches.length}
    </span>
  </div>

  <div className="flex gap-4 overflow-x-auto pb-2">
    {matches.slice(0, 12).map((match, index) => (
      <MatchButton
        key={match.fixture?.id || index}
        match={match}
        active={match.fixture?.id === selectedMatch.fixture?.id}
        onClick={() => selectMatch(match)}
      />
    ))}
  </div>
</section>

<section className="mt-8">
  <PremiumLocks onLockedClick={setModal} />
</section>

<Comparison />




          </>
        )}
      </section>

      {modal && <PremiumModal title={modal} onClose={() => setModal("")} />}
    </main>
  );
}

function MatchButton({
  match,
  active,
  onClick,
}: {
  match: LiveMatch;
  active: boolean;
  onClick: () => void;
}) {
  const badge = match.league?.flag || match.league?.logo;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[280px] md:min-w-[330px] rounded-3xl border p-5 text-left transition ${
        active
          ? "border-green-500 bg-green-500/10 shadow-[0_0_25px_rgba(0,255,120,.15)]"
          : "border-white/10 bg-black/20 hover:border-green-500/40"
      }`}
    >
      <div className="flex items-center gap-2 text-white/45 text-sm">
        {badge && (
          <img
            src={badge}
            alt={match.league?.country || "league"}
            className="w-5 h-5 rounded-full object-cover bg-white"
          />
        )}

        <span className="truncate">
          {match.league?.country ? `${match.league.country} · ` : ""}
          {match.league?.name || "Liga"} ·{" "}
          {match.fixture?.status?.short || "LIVE"}
        </span>
      </div>

      <div className="mt-4 flex justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg font-black truncate">
            {match.teams?.home?.name || "Local"}
          </p>
          <p className="text-lg font-black truncate mt-1">
            {match.teams?.away?.name || "Visitante"}
          </p>
        </div>

        <div className="text-2xl font-black text-right">
          <p>{match.goals?.home ?? 0}</p>
          <p>{match.goals?.away ?? 0}</p>
        </div>
      </div>
    </button>
  );
}



function MatchAnalysis({ match }: { match: LiveMatch }) {
  const home = match.teams?.home;
  const away = match.teams?.away;
  const elapsed = match.fixture?.status?.elapsed;
  const status = match.fixture?.status?.short || "LIVE";

  const demoConfidence = useMemo(() => {
    const minute = typeof elapsed === "number" ? elapsed : 45;
    return Math.min(87, Math.max(58, 60 + Math.floor(minute / 3)));
  }, [elapsed]);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111c] p-6 md:p-8">
      <div className="flex justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-white/40">
            {match.league?.flag && (
              <img
                src={match.league.flag}
                alt={match.league?.country || "flag"}
                className="w-5 h-5 rounded-full object-cover"
              />
            )}
            <span>{match.league?.name || "Liga en vivo"}</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-black mt-3 leading-tight">
            {home?.name || "Local"} vs {away?.name || "Visitante"}
          </h2>
        </div>

        <div className="text-green-400 font-black text-3xl whitespace-nowrap">
          {elapsed ? `${elapsed}'` : status}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mt-10">
        <TeamLogo src={home?.logo} name={home?.name || "Local"} />

        <div className="text-center">
          <div className="text-5xl md:text-7xl font-black">
            {match.goals?.home ?? 0} - {match.goals?.away ?? 0}
          </div>
          <p className="text-green-400 font-black mt-2">
            {match.fixture?.status?.long || "En vivo"}
          </p>
        </div>

        <TeamLogo src={away?.logo} name={away?.name || "Visitante"} />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-10">
        <Stat title="Eventos" value={String(match.events?.length || 0)} />
        <Stat title="Minuto" value={elapsed ? `${elapsed}'` : status} />
        <Stat title="Estado" value={status} />
      </div>

      <div className="mt-8">
        <Row label="Predicción demo" value="Over 1.5" />
        <Row label="Confianza demo" value={`${demoConfidence}%`} />
        <Row label="IA completa" value="Bloqueada" yellow />
      </div>

      <div className="mt-8 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 p-5">
        <p className="text-yellow-300 font-black">Vista limitada</p>
        <p className="text-white/60 mt-2">
          Estás viendo solo una parte del sistema. BTTS, Próximo Gol, Momentum,
          Poisson e informes están bloqueados en la demo.
        </p>
      </div>
    </div>
  );
}

function PremiumLocks({
  onLockedClick,
}: {
  onLockedClick: (title: string) => void;
}) {
  const locked = [
    "BTTS - Ambos anotan",
    "Próximo Gol",
    "Momentum IA",
    "Poisson Avanzado",
    "Over / Under IA",
    "Marcador Probable",
    "Recomendación Inteligente",
    "Informes Premium PDF",
  ];

  return (
    <div className="rounded-3xl border border-green-500/20 bg-[#07111c] p-6 md:p-8">
      <h2 className="text-3xl font-black text-green-400">
        Funciones bloqueadas
      </h2>

      <p className="text-white/50 mt-3">
        Pulsa cualquier candado para ver qué desbloquean Premium y VIP.
      </p>

      <div className="mt-8 space-y-4">
        {locked.map((item) => (
          <Lock key={item} text={item} onClick={onLockedClick} />
        ))}
      </div>

      <Link
        href="/pricing"
        className="block mt-10 rounded-2xl bg-green-500 py-4 text-center text-black font-black hover:scale-105 transition"
      >
        VER PLANES
      </Link>
    </div>
  );
}

function Comparison() {
  return (
    <div className="mt-10 grid md:grid-cols-2 gap-8">
      <div className="rounded-3xl border border-white/10 bg-[#07111c] p-8">
        <h3 className="text-2xl font-black">Demo gratuita</h3>
        <ul className="mt-6 space-y-3 text-white/70">
          <li>✅ Partidos reales en vivo</li>
          <li>✅ Marcador y minuto</li>
          <li>✅ Escudos, país y liga</li>
          <li>✅ Predicción básica de ejemplo</li>
          <li>❌ BTTS avanzado</li>
          <li>❌ Próximo Gol</li>
          <li>❌ Momentum IA</li>
          <li>❌ Informes Premium</li>
        </ul>
      </div>

      <div className="rounded-3xl border border-green-500/30 bg-green-500/10 p-8">
        <h3 className="text-2xl font-black text-green-400">
          Premium / VIP
        </h3>

        <ul className="mt-6 space-y-3 text-white/80">
          <li>✅ TV en vivo completa</li>
          <li>✅ IA predictiva</li>
          <li>✅ BTTS, Over/Under y Próximo Gol</li>
          <li>✅ Momentum del partido</li>
          <li>✅ Informes diarios</li>
          <li>✅ Recomendaciones inteligentes</li>
          <li>✅ Acceso privado con licencia</li>
        </ul>

        <Link
          href="/pricing"
          className="block mt-8 rounded-2xl bg-green-500 py-4 text-center text-black font-black"
        >
          VER PLANES
        </Link>
      </div>
    </div>
  );
}

function PremiumModal({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="max-w-md w-full rounded-3xl bg-[#07111c] border border-green-500/30 p-8 text-center">
        <div className="text-5xl">🔒</div>

        <h2 className="text-3xl font-black mt-4 text-green-400">
          Función bloqueada
        </h2>

        <p className="text-white/70 mt-4">
          <b>{title}</b> utiliza el motor avanzado de Irvin Analytics y está
          disponible en los planes Premium y VIP.
        </p>

        <Link
          href="/pricing"
          className="block mt-8 rounded-2xl bg-green-500 py-4 text-black font-black"
        >
          Ver planes
        </Link>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-white/50 hover:text-white"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

function TeamLogo({ src, name }: { src?: string; name: string }) {
  return (
    <div className="text-center min-w-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-16 h-16 md:w-20 md:h-20 object-contain mx-auto bg-white rounded-xl p-2"
        />
      ) : (
        <div className="w-16 h-16 md:w-20 md:h-20 mx-auto rounded-xl bg-white/10" />
      )}

      <p className="text-xs text-white/60 mt-3 truncate">{name}</p>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/30 p-4 border border-white/10">
      <p className="text-white/40 text-xs md:text-sm">{title}</p>
      <p className="text-xl md:text-2xl font-black mt-2">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  yellow,
}: {
  label: string;
  value: string;
  yellow?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 py-4 border-b border-white/10">
      <span>{label}</span>
      <span
        className={`font-black text-right ${
          yellow ? "text-yellow-400" : "text-green-400"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Lock({
  text,
  onClick,
}: {
  text: string;
  onClick: (title: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      className="w-full flex justify-between items-center rounded-xl bg-black/20 border border-white/10 p-4 hover:border-green-500/40 hover:bg-green-500/5 transition text-left"
    >
      <span>{text}</span>
      <span className="text-yellow-400">🔒</span>
    </button>
  );
}

function Box({
  children,
  red,
  yellow,
}: {
  children: React.ReactNode;
  red?: boolean;
  yellow?: boolean;
}) {
  return (
    <div
      className={`mt-14 rounded-3xl border p-10 text-center ${
        red
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : yellow
          ? "border-yellow-500/30 bg-yellow-500/10"
          : "border-white/10 bg-[#07111c]"
      }`}
    >
      {children}
    </div>
  );
}