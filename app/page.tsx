import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#03070b] text-white">

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 py-20">

        <div className="text-center">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-bold mb-8">
            ● IA EN TIEMPO REAL
          </div>

          <h1 className="text-6xl font-black tracking-tight">
            IRVIN
            <span className="text-green-400"> ANALYTICS</span>
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

      {/* CARACTERÍSTICAS */}

      <section className="max-w-7xl mx-auto px-6 pb-20">

        <h2 className="text-4xl font-black text-center mb-14">
          ¿Qué incluye?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">

          <Card
            title="📺 TV EN VIVO"
            text="Visualización profesional de partidos con IA, estadísticas, eventos y probabilidades."
          />

          <Card
            title="⚽ INFORMES PREMIUM"
            text="Informes diarios generados automáticamente con análisis estadístico avanzado."
          />

          <Card
            title="🧠 IA PREDICTIVA"
            text="Poisson, Momentum, Próximo Gol, BTTS, Over/Under y recomendaciones inteligentes."
          />

          <Card
            title="📈 MERCADOS"
            text="Victoria, Empate, BTTS, Próximo Gol, Línea de Goles y más mercados en desarrollo."
          />

          <Card
            title="⚡ ACTUALIZACIÓN EN VIVO"
            text="Datos sincronizados constantemente durante el partido."
          />

          <Card
            title="🔒 ACCESO PRIVADO"
            text="Sistema protegido con autenticación y gestión de licencias."
          />

        </div>

      </section>

      {/* PLANES */}

      <section className="bg-[#07111c] border-t border-white/10">

        <div className="max-w-7xl mx-auto px-6 py-20">

          <h2 className="text-4xl font-black text-center mb-14">
            Próximos Planes
          </h2>

          <div className="grid md:grid-cols-3 gap-8">

            <Price
              plan="BETA"
              price="9,90€"
              desc="Acceso básico"
            />

            <Price
              plan="PREMIUM"
              price="19,90€"
              desc="TV + Informes + IA"
              featured
            />

            <Price
              plan="VIP"
              price="39,90€"
              desc="Todo desbloqueado"
            />

          </div>

        </div>

      </section>

    </main>
  );
}

function Card({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111c] p-8">
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
  return (
    <div
      className={`rounded-3xl p-8 border ${
        featured
          ? "border-green-500 bg-green-500/10"
          : "border-white/10 bg-[#03070b]"
      }`}
    >
      <div className="text-2xl font-black">{plan}</div>

      <div className="text-5xl font-black mt-6 text-green-400">
        {price}
      </div>

      <div className="text-white/60 mt-4">{desc}</div>

      <button className="w-full mt-10 py-4 rounded-xl bg-green-500 text-black font-black">
        Próximamente
      </button>
    </div>
  );
}