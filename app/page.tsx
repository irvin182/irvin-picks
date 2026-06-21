"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#03070b] text-white">
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-bold mb-8">
            ● IA EN TIEMPO REAL
          </div>

          <h1 className="text-6xl font-black tracking-tight">
            IRVIN <span className="text-green-400">ANALYTICS</span>
          </h1>

          <p className="mt-8 text-2xl text-white/70 max-w-4xl mx-auto leading-relaxed">
            Plataforma profesional de inteligencia artificial para fútbol.
            Predicciones en vivo, modelos Poisson, BTTS, Próximo Gol,
            Over/Under y análisis estadístico en tiempo real.
          </p>

          <div className="flex justify-center gap-5 mt-12 flex-wrap">
            <Link
              href="/login"
              className="px-8 py-4 rounded-2xl bg-green-500 text-black font-black text-lg hover:scale-105 transition"
            >
              ENTRAR AL SISTEMA
            </Link>

            <Link
              href="/probador/TV"
              className="px-8 py-4 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 transition"
            >
              VER DEMO EN VIVO
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20">
        <h2 className="text-4xl font-black text-center mb-14">
          ¿Qué incluye?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Card title="📺 TV EN VIVO" text="Visualización profesional de partidos con IA, estadísticas, eventos y probabilidades." />
          <Card title="⚽ INFORMES PREMIUM" text="Informes diarios generados automáticamente con análisis estadístico avanzado." />
          <Card title="🧠 IA PREDICTIVA" text="Poisson, Momentum, Próximo Gol, BTTS, Over/Under y recomendaciones inteligentes." />
          <Card title="📈 MERCADOS" text="Victoria, Empate, BTTS, Próximo Gol, Línea de Goles y más mercados en desarrollo." />
          <Card title="⚡ ACTUALIZACIÓN EN VIVO" text="Datos sincronizados constantemente durante el partido." />
          <Card title="🔒 ACCESO PRIVADO" text="Sistema protegido con autenticación y gestión de licencias." />
        </div>
      </section>

      <section className="relative z-50 bg-[#07111c] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-4xl font-black text-center mb-14">Planes</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Price plan="BETA" price="9,90€" desc="Acceso básico" />
            <Price plan="PREMIUM" price="19,90€" desc="TV + Informes + IA" featured />
            <Price plan="VIP" price="39,90€" desc="Todo desbloqueado" />
          </div>
        </div>
      </section>
    </main>
  );
}

function Card({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111c] p-8 transition-all duration-300 hover:border-green-400/30 hover:shadow-[0_0_35px_rgba(34,197,94,0.12)]">
      <h3 className="text-2xl font-bold mb-4">{title}</h3>
      <p className="text-white/60 leading-7">{text}</p>
    </div>
  );
}

function Price({
  plan,
  price,
  desc,
  featured,
}: {
  plan: string;
  price: string;
  desc: string;
  featured?: boolean;
}) {
  const planSlug = plan.toLowerCase();

  function goCheckout() {
    window.location.href = `/api/checkout?plan=${planSlug}`;
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl p-8 border transition-all duration-500 hover:scale-[1.03] hover:border-green-400/60 hover:bg-gradient-to-br hover:from-green-500/20 hover:via-[#07111c] hover:to-black hover:shadow-[0_0_50px_rgba(34,197,94,0.35)] ${
        featured
          ? "border-green-400/60 bg-gradient-to-br from-green-500/20 via-[#07111c] to-black shadow-[0_0_35px_rgba(34,197,94,0.25)]"
          : "border-white/10 bg-gradient-to-br from-[#07111c] to-black"
      }`}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-700 bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,0.22),transparent_45%)]" />

      {featured && (
        <div className="absolute right-4 top-4 rounded-full bg-green-400/20 border border-green-400/40 px-3 py-1 text-xs font-black text-green-300">
          MÁS POPULAR
        </div>
      )}

      <div className="relative z-10 text-2xl font-black">{plan}</div>

      <div className="relative z-10 text-5xl font-black mt-6 text-green-400">
        {price}
      </div>

      <div className="relative z-10 text-white/60 mt-4">{desc}</div>

      <button
        type="button"
        onClick={goCheckout}
        className="relative z-[9999] w-full mt-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-white font-black tracking-wide hover:border-green-400/60 hover:bg-green-400 hover:text-black hover:shadow-[0_0_35px_rgba(34,197,94,0.55)] active:scale-95 transition-all duration-300 cursor-pointer"
      >
        ACTIVAR {plan}
      </button>
    </div>
  );
}