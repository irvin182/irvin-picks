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

        const sessionCheck = await fetch("/api/auth/check-session", {
          cache: "no-store",
        });

        const sessionData = await sessionCheck.json().catch(() => null);

        if (
          !sessionCheck.ok ||
          sessionData?.valid === false ||
          user?.forceLogout === true
        ) {
          await signOut({ callbackUrl: "/login?error=session_replaced" });
          return;
        }

        const role = String(user?.role ?? "").toUpperCase();
        const plan = String(user?.plan ?? "").toLowerCase();
        const blocked = user?.blocked === true;
        const active = user?.active !== false;
        const expiresAt = user?.expires_at ?? null;

        if (blocked || !active) {
          await signOut({ callbackUrl: "/login?error=account_disabled" });
          return;
        }

        if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
          await signOut({ callbackUrl: "/pricing?error=expired" });
          return;
        }

        if (requireAdmin && role !== "ADMIN") {
          window.location.replace("/dashboard");
          return;
        }

        if (!requireAdmin && role !== "ADMIN") {
          const allowedPlans = ["beta", "premium", "vip"];

          if (!allowedPlans.includes(plan)) {
            window.location.replace("/pricing");
            return;
          }
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

    const interval = setInterval(checkSession, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [requireAdmin]);

  if (checking) {
    return (
      <main className="min-h-screen bg-[#03070b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-black text-green-400">
            IRVIN ANALYTICS
          </div>
          <div className="mt-4 text-white/60">
            Verificando acceso seguro...
          </div>
        </div>
      </main>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}