"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

type LiveFixture = {
  fixture?: {
    id?: number;
    status?: {
      elapsed?: number | null;
      short?: string | null;
    };
  };
  league?: {
    name?: string;
    country?: string;
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
};

export default function DashboardPage() {
  const [fixtures, setFixtures] = useState<LiveFixture[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadLive() {
      try {
        const res = await fetch("/api/live", {
          cache: "no-store",
        });

        const json = await res.json();

        const data = Array.isArray(json?.response)
          ? json.response
          : Array.isArray(json)
          ? json
          : [];

        if (mounted) {
          setFixtures(data);
        }
      } catch (error) {
        console.error("Error loading live fixtures:", error);
      } finally {
        if (mounted) {
          setLoadingLive(false);
        }
      }
    }

    loadLive();

    const interval = setInterval(loadLive, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const topFixtures = useMemo(() => fixtures.slice(0, 4), [fixtures]);

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-[#010409] via-[#03070b] to-[#07111c] text-white px-6 py-10">
      <section className="max-w-7xl mx-auto relative">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-green-500/10 blur-3xl" />
        <div className="absolute top-80 -left-24 h-72 w-72 rounded-full bg-green-500/10 blur-3xl" />

        <div className="relative mb-10 rounded-[2rem] border border-green-500/20 bg-[#07111c]/70 p-8 shadow-[0_0_45px_rgba(0,255,120,.10)]">
          <p className="text-green-400 font-black tracking-[5px] text-xs">
            IRVIN ANALYTICS AI
          </p>

          <div className="mt-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black">Centro de Control IA</h1>

              <p className="text-white/60 mt-3">
                Analítica deportiva profesional con inteligencia artificial en
                tiempo real.
              </p>
            </div>

            <div className="rounded-2xl border border-green-400/30 bg-green-500/10 px-5 py-4">
              <p className="text-white/50 text-xs">ESTADO DEL SISTEMA</p>
              <p className="text-green-400 font-black mt-1">● ONLINE</p>
            </div>
          </div>
        </div>

        <div className="relative grid md:grid-cols-4 gap-5 mb-8">
          <Stat
            title="⚽ Partidos hoy"
            value={loadingLive ? "..." : String(fixtures.length)}
            text="Datos en tiempo real"
            pulse
          />
          <Stat title="🧠 Motor IA" value="ACTIVO" text="Poisson + Momentum" />
          <Stat
            title="🔥 Señales Pro"
            value="PREMIUM"
            text="BTTS / Over / Next Goal"
          />
          <Stat title="🔒 Licencia" value="VALIDADA" text="JWT + Supabase" />
        </div>

        <div className="relative mb-8 rounded-[2rem] border border-green-500/25 bg-gradient-to-r from-[#07111c] via-[#06131f] to-black p-6 shadow-[0_0_35px_rgba(0,255,120,.10)]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-green-400 font-black tracking-[4px] text-xs">
                FÚTBOL EN VIVO
              </p>

              <h2 className="text-3xl font-black mt-2">
                Sigue el partido desde tu plataforma oficial
              </h2>

              <p className="text-white/55 mt-3 max-w-2xl leading-7">
                Irvin Analytics no retransmite señales de terceros. Puedes abrir
                tu proveedor autorizado y usar esta pantalla junto con la IA,
                momentum, xG, estadísticas y alertas en tiempo real.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/40 p-5 min-w-[280px]">
              <div className="aspect-video rounded-2xl border border-green-500/20 bg-[#02060a] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl">📺</div>
                  <p className="font-black mt-2">Transmisión oficial</p>
                  <p className="text-white/40 text-xs mt-1">
                    DAZN / FIFA+ / Operador autorizado
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <a
                  href="https://www.dazn.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-green-500 text-black font-black text-center py-3 hover:bg-green-400 transition"
                >
                  ABRIR DAZN
                </a>

                <a
                  href="/live"
                  className="rounded-xl border border-green-400/40 text-green-300 font-black text-center py-3 hover:bg-green-400 hover:text-black transition"
                >
                  VER IA LIVE
                </a>
              </div>
            </div>
          </div>
        </div>

        <LiveMatchesBlock
          fixtures={topFixtures}
          loading={loadingLive}
          total={fixtures.length}
        />

        <div className="relative grid lg:grid-cols-3 gap-6 mt-8">
          <div className="rounded-[2rem] border border-green-500/30 bg-gradient-to-br from-green-500/20 via-[#07111c] to-black p-8 shadow-[0_0_45px_rgba(0,255,120,.16)]">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-green-400">
                Licencia Premium
              </h2>
              <span className="rounded-full bg-green-400/20 border border-green-400/40 px-3 py-1 text-xs font-black text-green-300">
                ACTIVA
              </span>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-black/40 p-6">
              <p className="text-green-400 font-black tracking-[4px] text-xs">
                IRVIN ANALYTICS
              </p>

              <div className="mt-8">
                <p className="text-white/40 text-sm">PLAN</p>
                <p className="text-3xl font-black text-white">PREMIUM AI</p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <Info label="Estado" value="ACTIVA" green />
                <Info label="Acceso" value="PRO" />
                <Info label="Motor" value="Poisson" />
                <Info label="Seguridad" value="JWT" />
              </div>

              <div className="mt-8 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-[82%] bg-green-400 shadow-[0_0_20px_rgba(0,255,120,.8)]" />
              </div>

              <p className="text-white/40 text-xs mt-3">
                Licencia activa y protegida.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
            <Card
              title="📺 LIVE TV"
              text="Pantalla grande para seguir partidos, IA, momentum, estadísticas y eventos."
              href="/live"
              button="ENTRAR AL LIVE"
              featured
            />

            <Card
              title="📄 INFORME DE HOY"
              text="Informe premium con análisis avanzado, Poisson y mercados inteligentes."
              href="/reports/today"
              button="ABRIR HOY"
            />

            <Card
              title="📆 INFORME DE MAÑANA"
              text="Preparación anticipada de partidos, lectura previa y oportunidades."
              href="/reports/tomorrow"
              button="VER MAÑANA"
            />

            <Card
              title="🏀 INFORME BASKET"
              text="Módulo de baloncesto con análisis diario y lectura estadística."
              href="/reports/basket"
              button="VER BASKET"
            />

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="md:col-span-2 rounded-[2rem] border border-red-500/30 bg-gradient-to-br from-red-500/15 to-black p-8 text-left hover:bg-red-500/20 transition"
            >
              <h3 className="text-2xl font-black text-red-400">
                🚪 Cerrar sesión
              </h3>
              <p className="text-white/50 mt-4 leading-7">
                Finalizar sesión y volver a la página principal.
              </p>

              <div className="mt-8 inline-block rounded-2xl border border-red-400/40 px-5 py-3 text-red-300 font-black">
                SALIR
              </div>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function LiveMatchesBlock({
  fixtures,
  loading,
  total,
}: {
  fixtures: LiveFixture[];
  loading: boolean;
  total: number;
}) {
  return (
    <div className="relative rounded-[2rem] border border-green-500/25 bg-[#07111c]/90 p-6 shadow-[0_0_35px_rgba(0,255,120,.10)]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <p className="text-green-400 font-black tracking-[4px] text-xs">
            PARTIDOS EN VIVO AHORA
          </p>
          <h2 className="text-3xl font-black mt-2">
            Marcadores conectados a la IA
          </h2>
          <p className="text-white/45 mt-2">
            {loading
              ? "Cargando partidos en vivo..."
              : total > 0
              ? `${total} partidos detectados en tiempo real`
              : "No hay partidos en vivo ahora mismo"}
          </p>
        </div>

        <a
          href="/live"
          className="rounded-2xl bg-green-500 text-black px-6 py-3 font-black hover:bg-green-400 transition text-center"
        >
          ABRIR LIVE TV
        </a>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 rounded-2xl border border-white/10 bg-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : fixtures.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/50">
          Ahora no hay partidos live disponibles desde la API. Cuando empiecen,
          aparecerán aquí automáticamente.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {fixtures.map((match) => {
            const id = match.fixture?.id;
            const home = match.teams?.home?.name ?? "Local";
            const away = match.teams?.away?.name ?? "Visitante";
            const homeLogo = match.teams?.home?.logo;
            const awayLogo = match.teams?.away?.logo;
            const gh = match.goals?.home ?? 0;
            const ga = match.goals?.away ?? 0;
            const min = match.fixture?.status?.elapsed;
            const status = match.fixture?.status?.short ?? "LIVE";
            const league = match.league?.name ?? "Liga";

            return (
              <a
                key={id ?? `${home}-${away}`}
                href={id ? `/live?fixture=${id}` : "/live"}
                className="rounded-2xl border border-white/10 bg-black/30 p-5 hover:border-green-400/50 hover:bg-green-500/10 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white/40 text-xs truncate max-w-[220px]">
                      {league}
                    </p>
                    <p className="text-green-400 font-black mt-1">
                      {min ? `${min}'` : status}
                    </p>
                  </div>

                  <div className="rounded-full bg-green-500/10 border border-green-500/30 px-3 py-1 text-xs font-black text-green-300">
                    LIVE
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <TeamRow logo={homeLogo} name={home} score={gh} />
                  <TeamRow logo={awayLogo} name={away} score={ga} />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-white/40">IA lista para analizar</span>
                  <span className="text-green-300 font-black">VER EN LIVE →</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeamRow({
  logo,
  name,
  score,
}: {
  logo?: string;
  name: string;
  score: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {logo ? (
          <img src={logo} alt={name} className="h-7 w-7 object-contain" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-white/10" />
        )}
        <span className="font-bold truncate">{name}</span>
      </div>

      <span className="text-2xl font-black">{score}</span>
    </div>
  );
}

function Stat({
  title,
  value,
  text,
  pulse,
}: {
  title: string;
  value: string;
  text: string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111c]/90 p-6 shadow-[0_0_25px_rgba(0,0,0,.25)]">
      <p className="text-white/50 text-sm">{title}</p>

      <div className="flex items-center gap-2 mt-3">
        {pulse && (
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
          </span>
        )}

        <h3 className="text-3xl font-black text-green-400">{value}</h3>
      </div>

      <p className="text-white/40 text-sm mt-2">{text}</p>
    </div>
  );
}

function Info({
  label,
  value,
  green,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div>
      <p className="text-white/40 text-xs">{label}</p>
      <p className={green ? "text-green-400 font-black" : "font-bold"}>
        {value}
      </p>
    </div>
  );
}

function Card({
  title,
  text,
  href,
  button,
  featured,
}: {
  title: string;
  text: string;
  href: string;
  button: string;
  featured?: boolean;
}) {
  return (
    <a
      href={href}
      className={`group rounded-[2rem] border p-8 transition hover:scale-[1.01] ${
        featured
          ? "border-green-500/40 bg-gradient-to-br from-green-500/10 via-[#07111c] to-black shadow-[0_0_35px_rgba(0,255,120,.12)]"
          : "border-white/10 bg-[#07111c]/90 hover:border-green-500/50 hover:shadow-[0_0_30px_rgba(0,255,120,.15)]"
      }`}
    >
      <h3 className="text-2xl font-black">{title}</h3>

      <p className="text-white/55 mt-4 leading-7">{text}</p>

      <div className="mt-8 inline-block rounded-2xl border border-green-400/40 px-5 py-3 text-green-300 font-black group-hover:bg-green-400 group-hover:text-black transition">
        {button}
      </div>
    </a>
  );
}