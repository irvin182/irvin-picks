import Link from "next/link";

const plans = [
  {
    name: "BETA",
    price: "9,90€",
    slug: "beta",
    badge: "Para empezar",
    desc: "Acceso inicial para probar Irvin Analytics.",
    features: [
      "Acceso limitado",
      "Vista básica del sistema",
      "Marcador y datos principales",
      "Demo ampliada",
    ],
  },
  {
    name: "PREMIUM",
    price: "19,90€",
    slug: "premium",
    badge: "Más vendido",
    desc: "El plan ideal para usar el sistema completo.",
    featured: true,
    features: [
      "TV en vivo completa",
      "Informes Premium",
      "BTTS",
      "Próximo Gol",
      "Over / Under",
      "Poisson Live",
      "IA predictiva",
    ],
  },
  {
    name: "VIP",
    price: "39,90€",
    slug: "vip",
    badge: "Acceso total",
    desc: "Para usuarios avanzados que quieren todo desbloqueado.",
    vip: true,
    features: [
      "Todo Premium incluido",
      "Match Momentum",
      "IA avanzada",
      "Dashboard PRO",
      "Nuevas funciones antes que nadie",
      "Soporte prioritario",
      "Todas las futuras mejoras",
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#03070b] text-white px-6 py-14">
      <section className="max-w-7xl mx-auto">
        <div className="text-center">
          <Link href="/" className="text-green-400 font-bold">
            ← Volver
          </Link>

          <div className="mt-8 inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-green-400 font-black">
            PLANES IRVIN ANALYTICS
          </div>

          <h1 className="text-5xl md:text-6xl font-black mt-6">
            Elige tu acceso
          </h1>

          <p className="text-white/60 text-xl mt-6 max-w-3xl mx-auto">
            Accede a predicciones en vivo, informes, IA, BTTS, Próximo Gol,
            Momentum y análisis avanzado según tu plan.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mt-14 items-stretch">
          {plans.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} />
          ))}
        </div>

        <div className="mt-14 rounded-3xl border border-white/10 bg-[#07111c] p-8 text-center">
          <h2 className="text-3xl font-black text-green-400">
            ¿No sabes cuál elegir?
          </h2>

          <p className="text-white/60 mt-4 max-w-3xl mx-auto">
            Empieza con Premium si quieres el sistema completo. Elige VIP si
            quieres acceso total, funciones avanzadas y prioridad en nuevas
            mejoras.
          </p>

          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            <Link
              href="/demo"
              className="rounded-2xl border border-white/20 bg-white/5 px-8 py-4 font-black hover:bg-white/10 transition"
            >
              Ver demo
            </Link>

            <Link
              href="/api/checkout?plan=vip"
              className="rounded-2xl bg-green-500 px-8 py-4 text-black font-black hover:scale-105 transition"
            >
              Quiero VIP
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function PlanCard({ plan }: { plan: any }) {
  return (
    <div
      className={`relative rounded-3xl p-8 border ${
        plan.vip
          ? "border-yellow-400/50 bg-yellow-500/10 scale-[1.02]"
          : plan.featured
          ? "border-green-500/50 bg-green-500/10"
          : "border-white/10 bg-[#07111c]"
      }`}
    >
      <div
        className={`inline-flex rounded-full px-4 py-2 text-sm font-black ${
          plan.vip
            ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400/30"
            : plan.featured
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : "bg-white/10 text-white/60 border border-white/10"
        }`}
      >
        {plan.vip ? "👑 " : plan.featured ? "⭐ " : "🟢 "}
        {plan.badge}
      </div>

      <h2 className="text-3xl font-black mt-6">{plan.name}</h2>

      <p className="text-white/60 mt-3">{plan.desc}</p>

      <div
        className={`text-5xl font-black mt-8 ${
          plan.vip ? "text-yellow-300" : "text-green-400"
        }`}
      >
        {plan.price}
        <span className="text-lg text-white/40"> / mes</span>
      </div>

      <ul className="mt-8 space-y-4 text-white/75">
        {plan.features.map((feature: string) => (
          <li key={feature}>✅ {feature}</li>
        ))}
      </ul>

      <Link
        href={`/api/checkout?plan=${plan.slug}`}
        className={`block mt-10 rounded-2xl py-4 text-center font-black transition ${
          plan.vip
            ? "bg-yellow-400 text-black hover:scale-105"
            : plan.featured
            ? "bg-green-500 text-black hover:scale-105"
            : "bg-white/10 border border-white/20 hover:bg-white/15"
        }`}
      >
        {plan.vip
          ? "QUIERO VIP"
          : plan.featured
          ? "ELEGIR PREMIUM"
          : "EMPEZAR BETA"}
      </Link>
    </div>
  );
}


