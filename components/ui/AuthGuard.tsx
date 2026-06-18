"use client";

import { useEffect, useState } from "react";
import { getSession, signOut } from "next-auth/react";

export default function AuthGuard({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const session = await getSession();

        if (!session) {
          window.location.replace("/login");
          return;
        }

        const user = session.user as any;

        if (user?.blocked) {
          alert("Tu sesión fue cerrada porque esta cuenta se abrió en otro dispositivo.");
          await signOut({ callbackUrl: "/login" });
          return;
        }

        if (requireAdmin && user?.role !== "ADMIN") {
          window.location.replace("/probador/TV");
          return;
        }

        if (mounted) {
          setAllowed(true);
          setChecking(false);
        }
      } catch (error) {
        console.error("Error verificando sesión:", error);
        window.location.replace("/login");
      }
    }

    checkSession();

    const interval = setInterval(checkSession, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [requireAdmin]);

  if (checking) {
    return (
      <main className="min-h-screen bg-[#03070b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-black text-green-400">IRVIN ANALYTICS</div>
          <div className="mt-4 text-white/60">Verificando acceso seguro...</div>
        </div>
      </main>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}