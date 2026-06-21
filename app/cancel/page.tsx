import Link from "next/link";

export default function CancelPage() {
  return (
    <main className="min-h-screen bg-[#03070b] text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-500">
          Pago cancelado
        </h1>

        <p className="mt-4 text-white/70">
          No se realizó ningún cargo.
        </p>

        <Link
          href="/"
          className="inline-block mt-8 rounded-xl bg-white px-6 py-3 text-black"
        >
          Volver
        </Link>
      </div>
    </main>
  );
}