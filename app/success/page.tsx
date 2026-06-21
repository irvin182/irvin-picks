"use client";

import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-[#03070b] text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full rounded-3xl border border-green-500/30 bg-[#07111c] p-10 text-center shadow-[0_0_40px_rgba(0,255,153,0.15)]">

        <div className="text-7xl mb-6">🎉</div>

        <h1 className="text-5xl font-black text-green-400">
          ¡Pago recibido!
        </h1>

        <p className="mt-6 text-xl text-white/80 leading-8">
          Gracias por confiar en <b>Irvin Analytics</b>.
        </p>

        <p className="mt-4 text-white/60 leading-8">
          Tu pago ha sido recibido correctamente.
        </p>

        <p className="mt-4 text-white/60 leading-8">
          Estamos activando tu cuenta automáticamente.
        </p>

        <div className="mt-10 rounded-2xl border border-green-500/20 bg-green-500/10 p-6">

          <h2 className="text-2xl font-bold text-green-300">
            ¿Qué ocurre ahora?
          </h2>

          <div className="mt-6 space-y-3 text-left text-white/80">

            <p>✅ Se verifica el pago.</p>

            <p>✅ Se crea tu cuenta automáticamente.</p>

            <p>✅ Se activa tu licencia.</p>

            <p>✅ Recibirás un correo con tus datos de acceso.</p>

          </div>

        </div>

        <Link
          href="/demo"
          className="inline-block mt-10 rounded-2xl bg-green-500 px-10 py-4 text-black font-black hover:scale-105 transition"
        >
          Ir al Login
        </Link>

      </div>
    </main>
  );
}