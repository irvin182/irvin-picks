"use client";

import Link from "next/link";
import { useHomeTranslations } from "@/components/i18n/HomeTranslations";

export default function HomePage() {
  const t = useHomeTranslations();
  return (
    <main className="min-h-screen bg-[#03070b] text-white">
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-bold mb-8">
            ● {t.badge}
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight">
            IRVIN <span className="text-green-400">ANALYTICS</span>
          </h1>

          <p className="mt-8 text-xl md:text-2xl text-white/70 max-w-4xl mx-auto leading-relaxed">
            {t.heroDescription}
          </p>

          <div className="flex justify-center gap-5 mt-12 flex-wrap">
            <Link
              href="/demo"
              className="px-8 py-4 rounded-2xl bg-green-500 text-black font-black text-lg hover:scale-105 transition"
            >
              {t.demo}
            </Link>

            <Link
              href="/login"
              className="px-8 py-4 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 transition font-bold"
            >
              {t.login}
            </Link>
          </div>

          <p className="mt-6 text-sm text-white/40">
            {t.shortNotice}
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20">
        <h2 className="text-4xl font-black text-center mb-6">
          {t.features}
        </h2>

        <p className="text-center text-white/60 max-w-3xl mx-auto mb-14 text-lg">
          {t.featuresIntro}
        </p>

        <div className="grid md:grid-cols-3 gap-8">
            {t.cards.map((card, index) => {
              const icons = ["📺", "🧠", "📊", "⚽", "⚡", "🔒"];
              return (
                <Card
                  key={index}
                  title={`${icons[index]} ${card.title}`}
                  text={card.text}
                />
              );
            })}
        </div>
      </section>

      <section className="bg-[#07111c] border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h2 className="text-4xl font-black mb-6">
            {t.sectionTitle}
          </h2>

          <p className="text-white/60 max-w-4xl mx-auto text-lg leading-8">
            {t.sectionText}
          </p>
        </div>
      </section>

      <section className="relative z-50 bg-[#03070b]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-4xl font-black text-center mb-4">{t.plans}</h2>

          <p className="text-center text-white/60 mb-14">
            {t.plansIntro}
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <Price activate={t.activate} popular={t.popular} plan="BETA" price="9,90€" desc={t.betaDesc} />
            <Price activate={t.activate} popular={t.popular} plan="PREMIUM" price="19,90€" desc={t.premiumDesc} featured />
            <Price activate={t.activate} popular={t.popular} plan="VIP" price="39,90€" desc={t.vipDesc} />
          </div>

          <p className="mt-10 text-center text-xs text-white/35 max-w-4xl mx-auto leading-6">
            {t.disclaimer}
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
  activate,
  popular,
  plan,
  price,
  desc,
  featured,
}: {
  activate: string;
  popular: string;
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
          {popular}
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
        {activate} {plan}
      </button>
    </div>
  );
}