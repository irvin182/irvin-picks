"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Introduce email y contraseña.");
      return;
    }

    try {
      setLoading(true);

      const result = await signIn("credentials", {
        email: cleanEmail,
        password,
        redirect: false,
      });
if (result?.error) {
  setError(
    "No se ha podido iniciar sesión. Verifica tu correo electrónico y contraseña, o contacta con el administrador si el problema persiste."
  );
  return;
}

  const sessionRes = await fetch("/api/auth/session");
const session = await sessionRes.json();

if (session?.user?.role === "ADMIN" || session?.user?.plan === "admin") {
  window.location.replace("/admin");
} else {
  window.location.replace("/probador/TV");
}
    } catch (err) {
      console.error("Error login:", err);
      setError("Error al iniciar sesión. Inténtalo otra vez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#03070b] text-white flex items-center justify-center px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md bg-[#07111c] border border-white/10 rounded-3xl p-8 space-y-5"
      >
        <div className="text-center">
          <h1 className="text-4xl font-black text-green-400">
            IRVIN ANALYTICS
          </h1>
          <p className="text-white/50 mt-2 text-sm">
            Acceso privado al sistema
          </p>
        </div>

        {error && (
<div className="rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/10 to-red-500/5 px-5 py-4">
  <div className="flex items-start gap-3">
    <div className="text-red-400 text-xl">⚠️</div>

    <div>
      <h3 className="font-bold text-red-300">
        Acceso denegado
      </h3>

      <p className="text-red-200/90 text-sm mt-1">
        {error}
      </p>
    </div>
  </div>
</div>
        )}

        <input
          className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-400"
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-400"
          placeholder="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 disabled:bg-green-500/40 disabled:cursor-not-allowed text-black font-black rounded-xl py-3"
        >
          {loading ? "VERIFICANDO..." : "ENTRAR"}
        </button>

        <p className="text-center text-xs text-white/40">
          Acceso protegido · IRVIN ANALYTICS
        </p>
      </form>
    </main>
  );
}