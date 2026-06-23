"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export default function DashboardPage() {
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
              <h1 className="text-5xl font-black">
                Bienvenido al Panel Pro 👋
              </h1>
              <p className="text-white/60 mt-3">
                Centro premium de análisis deportivo, IA en vivo e informes.
              </p>
            </div>

            <div className="rounded-2xl border border-green-400/30 bg-green-500/10 px-5 py-4">
              <p className="text-white/50 text-xs">ESTADO DEL SISTEMA</p>
              <p className="text-green-400 font-black mt-1">
                ● ONLINE
              </p>
            </div>
          </div>
        </div>

        <div className="relative grid md:grid-cols-4 gap-5 mb-8">
          <Stat title="⚽ Partidos hoy" value="LIVE" text="Datos en tiempo real" pulse />
          <Stat title="🧠 Motor IA" value="ACTIVO" text="Poisson + Momentum" />
          <Stat title="🔥 Señales Pro" value="PREMIUM" text="BTTS / Over / Next Goal" />
          <Stat title="🔒 Licencia" value="VALIDADA" text="Protegida por Stripe" />
        </div>

        <div className="relative grid lg:grid-cols-3 gap-6">
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
                <p className="text-3xl font-black text-white">
                  PREMIUM AI
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <Info label="Estado" value="ACTIVA" green />
                <Info label="Acceso" value="PRO" />
                <Info label="Renovación" value="Stripe" />
                <Info label="Seguridad" value="JWT" />
              </div>

              <div className="mt-8 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-[82%] bg-green-400 shadow-[0_0_20px_rgba(0,255,120,.8)]" />
              </div>

              <p className="text-white/40 text-xs mt-3">
                Licencia válida y sincronizada con Stripe.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
            <Card
              title="📺 TV EN VIVO"
              text="Modo pantalla grande para seguir partidos, IA, momentum, estadísticas y eventos."
              href="/live"
              button="ENTRAR AL LIVE"
              featured
            />

            <Card
              title="📄 INFORME DE HOY"
              text="Genera informes premium con análisis avanzado, Poisson y mercados inteligentes."
              href="/reports/today"
              button="ABRIR INFORME"
            />

          <Card
  title="🏀 INFORME BASKET"
  text="Módulo de baloncesto con análisis diario y lectura estadística."
  href="/reports/basket"
  button="VER BASKET"
/>

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-[2rem] border border-red-500/30 bg-gradient-to-br from-red-500/15 to-black p-8 text-left hover:bg-red-500/20 transition"
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

        <h3 className="text-3xl font-black text-green-400">
          {value}
        </h3>
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
    <Link
      href={href}
      className={`group rounded-[2rem] border p-8 transition hover:scale-[1.01] ${
        featured
          ? "border-green-500/40 bg-gradient-to-br from-green-500/10 via-[#07111c] to-black shadow-[0_0_35px_rgba(0,255,120,.12)]"
          : "border-white/10 bg-[#07111c]/90 hover:border-green-500/50 hover:shadow-[0_0_30px_rgba(0,255,120,.15)]"
      }`}
    >
      <h3 className="text-2xl font-black">{title}</h3>

      <p className="text-white/55 mt-4 leading-7">
        {text}
      </p>

      <div className="mt-8 inline-block rounded-2xl border border-green-400/40 px-5 py-3 text-green-300 font-black group-hover:bg-green-400 group-hover:text-black transition">
        {button}
      </div>
    </Link>
  );
}