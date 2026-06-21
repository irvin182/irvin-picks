"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  };
  teams?: {
    home?: {
      name?: string;
      logo?: string;
    };
    away?: {
      name?: string;
      logo?: string;
    };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  events?: any[];
};

export default function DemoPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [modal, setModal] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadLive() {
    try {
      setError("");

      const res = await fetch("/api/demo-live", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "No se pudieron cargar partidos en vivo.");
        return;
      }

      setMatches(json?.response || []);
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

  const selectedMatch = matches[selectedIndex] || matches[0];

  return (
    <main className="min-h-screen bg-[#03070b] text-white px-6 py-10">
      <section className="max-w-7xl mx-auto">
        <header className="text-center">
          <div className="inline-flex px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-bold">
            DEMO REAL EN VIVO
          </div>

          <h1 className="text-5xl font-black mt-6">
            Prueba limitada de{" "}
            <span className="text-green-400">Irvin Analytics</span>
          </h1>

          <p className="text-white/60 text-xl mt-6 max-w-4xl mx-auto">
            Esta demo usa partidos reales en vivo. La IA avanzada, BTTS, Próximo
            Gol, Momentum e informes están reservados para usuarios Premium.
          </p>
        </header>

        {loading && (
          <div className="mt-14 rounded-3xl border border-white/10 bg-[#07111c] p-10 text-center">
            <p className="text-green-400 font-black">Cargando partidos en vivo...</p>
          </div>
        )}

        {!loading && error && (
          <div className="mt-14 rounded-3xl border border-red-500/30 bg-red-500/10 p-10 text-center text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className="mt-14 rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-10 text-center">
            <h2 className="text-3xl font-black text-yellow-400">
              No hay partidos en vivo ahora mismo
            </h2>
            <p className="text-white/60 mt-4">
              Vuelve cuando haya partidos activos o entra al sistema Premium
              para consultar informes e inteligencia avanzada.
            </p>

            <Link
              href="/pricing"
              className="inline-block mt-8 rounded-2xl bg-green-500 px-8 py-4 text-black font-black"
            >
              ACTIVAR PREMIUM
            </Link>
          </div>
        )}

        {!loading && !error && matches.length > 0 && (
          <>
            <div className="grid lg:grid-cols-[320px_1fr] gap-8 mt-14">
              <aside className="rounded-3xl border border-white/10 bg-[#07111c] p-5">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="font-black">Partidos reales</h2>
                  <span className="rounded-full bg-green-500/20 px-3 py-1 text-green-400 font-black text-sm">
                    {matches.length}
                  </span>
                </div>

                <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                  {matches.slice(0, 10).map((match, index) => (
                    <button
                      key={match.fixture?.id || index}
                      onClick={() => setSelectedIndex(index)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedIndex === index
                          ? "border-green-500 bg-green-500/10"
                          : "border-white/10 bg-black/20 hover:border-white/30"
                      }`}
                    >
                      <p className="text-white/40 text-xs">
                        {match.league?.name || "Liga"} ·{" "}
                        {match.fixture?.status?.short || "LIVE"}
                      </p>

                      <div className="mt-3 flex justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold truncate">
                            {match.teams?.home?.name || "Local"}
                          </p>
                          <p className="font-bold truncate">
                            {match.teams?.away?.name || "Visitante"}
                          </p>
                        </div>

                        <div className="font-black text-right">
                          <p>{match.goals?.home ?? 0}</p>
                          <p>{match.goals?.away ?? 0}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="grid xl:grid-cols-[1fr_420px] gap-8">
                <MatchCard match={selectedMatch} />
                <PremiumCard onLockedClick={setModal} />
              </div>
            </div>

            <Comparison />
          </>
        )}
      </section>

      {modal && <PremiumModal title={modal} onClose={() => setModal("")} />}
    </main>
  );
}

function MatchCard({ match }: { match: LiveMatch }) {
  const home = match.teams?.home;
  const away = match.teams?.away;

  const elapsed = match.fixture?.status?.elapsed;
  const status = match.fixture?.status?.short || "LIVE";

  const demoConfidence = useMemo(() => {
    const minute = typeof elapsed === "number" ? elapsed : 45;
    return Math.min(87, Math.max(58, 60 + Math.floor(minute / 3)));
  }, [elapsed]);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111c] p-8">
      <div className="flex justify-between gap-5">
        <div>
          <p className="text-white/40">
            {match.league?.name || "Liga en vivo"}
          </p>

          <h2 className="text-3xl font-black mt-2">
            {home?.name || "Local"} vs {away?.name || "Visitante"}
          </h2>
        </div>

        <div className="text-green-400 font-black text-2xl whitespace-nowrap">
          {elapsed ? `${elapsed}'` : status}
        </div>
      </div>

      <div className="flex justify-center items-center gap-8 mt-10">
        <TeamLogo src={home?.logo} name={home?.name || "Local"} />

        <div className="text-center">
          <div className="text-6xl font-black">
            {match.goals?.home ?? 0} - {match.goals?.away ?? 0}
          </div>
          <p className="text-green-400 font-black mt-2">
            {match.fixture?.status?.long || "En vivo"}
          </p>
        </div>

        <TeamLogo src={away?.logo} name={away?.name || "Visitante"} />
      </div>

      <div className="grid grid-cols-3 gap-4 mt-10">
        <Stat title="Eventos" value={String(match.events?.length || 0)} />
        <Stat title="Minuto" value={elapsed ? `${elapsed}'` : status} />
        <Stat title="Estado" value={status} />
      </div>

      <div className="mt-8">
        <Row label="Predicción demo" value="Over 1.5" />
        <Row label="Confianza demo" value={`${demoConfidence}%`} />
        <Row label="IA completa" value="Premium" yellow />
      </div>

      <div className="mt-8 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 p-5">
        <p className="text-yellow-300 font-black">Vista limitada</p>
        <p className="text-white/60 mt-2">
          Estás viendo solo una parte del sistema. Las decisiones avanzadas de
          IA están bloqueadas en la demo.
        </p>
      </div>
    </div>
  );
}

function PremiumCard({
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
    <div className="rounded-3xl border border-green-500/20 bg-[#07111c] p-8">
      <h2 className="text-3xl font-black text-green-400">
        Funciones Premium bloqueadas
      </h2>

      <p className="text-white/50 mt-3">
        Pulsa cualquier candado para ver qué desbloquea Premium.
      </p>

      <div className="mt-8 space-y-4">
        {locked.map((item) => (
          <Lock key={item} text={item} onClick={onLockedClick} />
        ))}
      </div>

      <div className="mt-10 rounded-2xl bg-green-500/10 border border-green-500/20 p-6">
        <h3 className="text-2xl font-black">Acceso Premium</h3>

        <p className="text-white/60 mt-3">
          Sistema completo con TV en vivo, informes, IA, BTTS, Próximo Gol,
          Momentum y análisis premium.
        </p>

        <div className="flex gap-4 mt-8">
          <Link
            href="/pricing"
            className="flex-1 rounded-2xl bg-green-500 py-4 text-center text-black font-black hover:scale-105 transition"
          >
            ACTIVAR PREMIUM
          </Link>

          <Link
            href="/login"
            className="flex-1 rounded-2xl border border-white/20 py-4 text-center hover:bg-white/10 transition"
          >
            LOGIN
          </Link>
        </div>
      </div>
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
          <li>✅ Escudos y liga</li>
          <li>✅ Predicción básica de ejemplo</li>
          <li>❌ BTTS avanzado</li>
          <li>❌ Próximo Gol</li>
          <li>❌ Momentum IA</li>
          <li>❌ Informes Premium</li>
        </ul>
      </div>

      <div className="rounded-3xl border border-green-500/30 bg-green-500/10 p-8">
        <h3 className="text-2xl font-black text-green-400">Premium</h3>
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
          href="/api/checkout?plan=premium"
          className="block mt-8 rounded-2xl bg-green-500 py-4 text-center text-black font-black"
        >
          QUIERO PREMIUM
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
          Función Premium
        </h2>

        <p className="text-white/70 mt-4">
          <b>{title}</b> utiliza el motor avanzado de Irvin Analytics y está
          disponible solo para usuarios Premium.
        </p>

 <Link
  href="/pricing"
  className="rounded-2xl border border-green-400/40 px-8 py-4 text-green-300 font-black"
>
  Ver planes Premium
</Link>

        <button onClick={onClose} className="mt-4 text-white/50 hover:text-white">
          Cerrar
        </button>
      </div>
    </div>
  );
}

function TeamLogo({ src, name }: { src?: string; name: string }) {
  return (
    <div className="text-center w-28">
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-20 h-20 object-contain mx-auto bg-white rounded-xl p-2"
        />
      ) : (
        <div className="w-20 h-20 mx-auto rounded-xl bg-white/10" />
      )}

      <p className="text-xs text-white/60 mt-3 truncate">{name}</p>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/30 p-4 border border-white/10">
      <p className="text-white/40 text-sm">{title}</p>
      <p className="text-2xl font-black mt-2">{value}</p>
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
    <div className="flex justify-between py-4 border-b border-white/10">
      <span>{label}</span>
      <span className={`font-black ${yellow ? "text-yellow-400" : "text-green-400"}`}>
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