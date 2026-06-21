"use client";

import Link from "next/link";
import { useState } from "react";

export default function DemoPage() {
  const [modal, setModal] = useState("");

  return (
    <main className="min-h-screen bg-[#03070b] text-white px-6 py-12">
      <section className="max-w-7xl mx-auto">
        <div className="text-center">
          <div className="inline-flex px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-bold">
            DEMO GRATUITA
          </div>

          <h1 className="text-5xl font-black mt-6">
            Prueba limitada de{" "}
            <span className="text-green-400">Irvin Analytics</span>
          </h1>

          <p className="text-white/60 text-xl mt-6 max-w-4xl mx-auto">
            Mira una parte del sistema. Las predicciones avanzadas, informes y módulos IA están reservados para usuarios Premium.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mt-14">
          <MatchCard />
          <PremiumCard onLockedClick={setModal} />
        </div>

        <Comparison />
      </section>

      {modal && <PremiumModal title={modal} onClose={() => setModal("")} />}
    </main>
  );
}

function MatchCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111c] p-8">
      <div className="flex justify-between">
        <div>
          <p className="text-white/40">Champions League</p>
          <h2 className="text-3xl font-black mt-2">Barcelona vs Milan</h2>
        </div>
        <div className="text-green-400 font-black text-2xl">72'</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-8">
        <Stat title="Resultado" value="2 - 1" />
        <Stat title="Corners" value="9" />
        <Stat title="Posesión" value="61%" />
      </div>

      <div className="mt-8">
        <Row label="Predicción demo" value="Over 1.5" />
        <Row label="Confianza demo" value="78%" />
        <Row label="Estado" value="Demo limitada" yellow />
      </div>
    </div>
  );
}

function PremiumCard({
  onLockedClick,
}: {
  onLockedClick: (title: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-green-500/20 bg-[#07111c] p-8">
      <h2 className="text-3xl font-black text-green-400">
        Funciones Premium bloqueadas
      </h2>

      <p className="text-white/50 mt-3">
        Pulsa cualquier candado para ver qué desbloquea Premium.
      </p>

      <div className="mt-8 space-y-4">
        {[
          "BTTS - Ambos anotan",
          "Próximo Gol",
          "Momentum IA",
          "Poisson Avanzado",
          "Over / Under IA",
          "Marcador Probable",
          "Recomendación Inteligente",
          "Informes Premium PDF",
        ].map((item) => (
          <Lock key={item} text={item} onClick={onLockedClick} />
        ))}
      </div>

      <div className="mt-10 rounded-2xl bg-green-500/10 border border-green-500/20 p-6">
        <h3 className="text-2xl font-black">Premium</h3>
        <p className="text-5xl font-black text-green-400 mt-4">19,90€</p>
        <p className="text-white/60 mt-3">
          Acceso completo al sistema en vivo, informes e inteligencia artificial.
        </p>

        <div className="flex gap-4 mt-8">
          <Link
            href="/api/checkout?plan=premium"
            className="flex-1 rounded-2xl bg-green-500 py-4 text-center text-black font-black hover:scale-105 transition"
          >
            DESBLOQUEAR
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
          <li>✅ Resultado y minuto</li>
          <li>✅ Vista limitada del partido</li>
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
          <b>{title}</b> utiliza el motor avanzado de Irvin Analytics y está disponible solo para usuarios Premium.
        </p>

        <Link
          href="/api/checkout?plan=premium"
          className="block mt-8 rounded-2xl bg-green-500 py-4 text-black font-black"
        >
          Desbloquear por 19,90€/mes
        </Link>

        <button onClick={onClose} className="mt-4 text-white/50 hover:text-white">
          Cerrar
        </button>
      </div>
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
      onClick={() => onClick(text)}
      className="w-full flex justify-between items-center rounded-xl bg-black/20 border border-white/10 p-4 hover:border-green-500/40 hover:bg-green-500/5 transition text-left"
    >
      <span>{text}</span>
      <span className="text-yellow-400">🔒</span>
    </button>
  );
}