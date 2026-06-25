"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#03070b] text-white">
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-bold mb-8">
            ● IA DEPORTIVA EN TIEMPO REAL
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight">
            IRVIN <span className="text-green-400">ANALYTICS</span>
          </h1>

          <p className="mt-8 text-xl md:text-2xl text-white/70 max-w-4xl mx-auto leading-relaxed">
            Plataforma privada de análisis deportivo con inteligencia artificial.
            Analiza partidos en vivo, detecta momentum, calcula probabilidades y
            genera informes premium para tomar mejores decisiones.
          </p>

          <div className="flex justify-center gap-5 mt-12 flex-wrap">
            <Link
              href="/demo"
              className="px-8 py-4 rounded-2xl bg-green-500 text-black font-black text-lg hover:scale-105 transition"
            >
              VER DEMO EN VIVO
            </Link>

            <Link
              href="/login"
              className="px-8 py-4 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 transition font-bold"
            >
              ENTRAR AL SISTEMA
            </Link>
          </div>

          <p className="mt-6 text-sm text-white/40">
            No garantizamos ganancias. Irvin Analytics es una herramienta de análisis estadístico e informativo.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20">
        <h2 className="text-4xl font-black text-center mb-6">
          ¿Qué puedes analizar?
        </h2>

        <p className="text-center text-white/60 max-w-3xl mx-auto mb-14 text-lg">
          Toda la información importante del partido en una sola pantalla:
          estadísticas, IA, probabilidades, momentum y señales en vivo.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          <Card title="📺 TV EN VIVO" text="Pantalla profesional para seguir partidos en directo con datos, eventos y probabilidades." />
          <Card title="🧠 IA PREDICTIVA" text="Modelo Poisson, Próximo Gol, BTTS, Over/Under, marcador probable y análisis inteligente." />
          <Card title="📊 MATCH MOMENTUM" text="Lectura del dominio del partido para detectar qué equipo está generando más peligro." />
          <Card title="⚽ INFORMES PREMIUM" text="Informes diarios con partidos destacados, probabilidades y análisis estadístico." />
          <Card title="⚡ DATOS EN TIEMPO REAL" text="Actualización constante de estadísticas, goles, tiros, corners, tarjetas y eventos." />
          <Card title="🔒 ACCESO PRIVADO" text="Sistema protegido con usuarios, planes, licencias y control de acceso." />
        </div>
      </section>

      <section className="bg-[#07111c] border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h2 className="text-4xl font-black mb-6">
            Diseñado para gente que quiere analizar mejor
          </h2>

          <p className="text-white/60 max-w-4xl mx-auto text-lg leading-8">
            Irvin Analytics no es una promesa de dinero fácil. Es una herramienta
            para ver el fútbol con datos reales, modelos matemáticos e inteligencia
            artificial, ayudándote a tomar decisiones con más información y menos intuición.
          </p>
        </div>
      </section>

      <section className="relative z-50 bg-[#03070b]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-4xl font-black text-center mb-4">Planes</h2>

          <p className="text-center text-white/60 mb-14">
            Elige tu acceso mensual y empieza a usar Irvin Analytics.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <Price plan="BETA" price="9,90€" desc="Acceso básico para probar la plataforma." />
            <Price plan="PREMIUM" price="19,90€" desc="TV en vivo, informes e IA avanzada." featured />
            <Price plan="VIP" price="39,90€" desc="Acceso completo a todas las funciones premium." />
          </div>

          <p className="mt-10 text-center text-xs text-white/35 max-w-4xl mx-auto leading-6">
            Aviso responsable: Irvin Analytics ofrece análisis estadístico y deportivo.
            Las predicciones no son garantías de resultado. El uso de la información es responsabilidad del usuario.
          </p>
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