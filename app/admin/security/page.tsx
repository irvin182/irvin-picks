"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Attempt = {
  id?: string;
  email: string | null;
  ip: string | null;
  user_agent?: string | null;
  success: boolean;
  reason: string | null;
  created_at: string;
};

type SecurityResponse = {
  attempts: Attempt[];
  stats: {
    total: number;
    success: number;
    failed: number;
    suspiciousIps: any[];
  };
};

function getRisk(failed: number, suspiciousIps: number) {
  if (failed >= 15 || suspiciousIps >= 5) return "HIGH";
  if (failed >= 5 || suspiciousIps >= 2) return "MEDIUM";
  return "LOW";
}

function riskStyle(risk: string) {
  if (risk === "HIGH") return "text-red-400 border-red-500/30 bg-red-500/10";
  if (risk === "MEDIUM")
    return "text-yellow-300 border-yellow-500/30 bg-yellow-500/10";
  return "text-green-400 border-green-500/30 bg-green-500/10";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-ES");
}

function getHourlyData(attempts: Attempt[]) {
  const now = new Date();
  const hours = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now);
    d.setHours(now.getHours() - (23 - i), 0, 0, 0);

    return {
      hour: `${String(d.getHours()).padStart(2, "0")}:00`,
      total: 0,
      failed: 0,
      success: 0,
    };
  });

  attempts.forEach((a) => {
    const date = new Date(a.created_at);
    const diffHours = Math.floor((now.getTime() - date.getTime()) / 3600000);

    if (diffHours >= 0 && diffHours < 24) {
      const index = 23 - diffHours;
      hours[index].total += 1;

      if (a.success) {
        hours[index].success += 1;
      } else {
        hours[index].failed += 1;
      }
    }
  });

  return hours;
}

export default function SecurityPage() {
  const [data, setData] = useState<SecurityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSecurity() {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/security", {
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Error cargando seguridad");

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSecurity();
  }, []);

  const attempts = data?.attempts ?? [];
  const stats = data?.stats;
  const risk = getRisk(stats?.failed ?? 0, stats?.suspiciousIps?.length ?? 0);
  const chartData = useMemo(() => getHourlyData(attempts), [attempts]);
  const lastEvents = attempts.slice(0, 8);

  return (
    <main className="min-h-screen bg-[#03070b] text-white p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/admin"
            className="text-green-400 hover:text-green-300 font-bold"
          >
            ← Volver al panel
          </Link>

          <h1 className="text-5xl font-black mt-4 text-green-400">
            🛡 Security Center
          </h1>

          <p className="text-white/60 mt-2">
            Monitor profesional de seguridad de Irvin Analytics.
          </p>
        </div>

        <button
          onClick={loadSecurity}
          className="bg-green-500 hover:bg-green-400 text-black font-black px-5 py-3 rounded-xl"
        >
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center text-white/60 mt-24">
          Cargando información...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-8">
            <div
              className={`lg:col-span-1 rounded-2xl border p-6 ${riskStyle(
                risk
              )}`}
            >
              <p className="text-sm opacity-80">Riesgo actual</p>
              <p className="text-4xl font-black mt-3">{risk}</p>
              <p className="text-xs opacity-70 mt-2">
                Calculado por fallos e IPs sospechosas.
              </p>
            </div>

            <Card title="Intentos" value={stats?.total ?? 0} />
            <Card title="Correctos" value={stats?.success ?? 0} />
            <Card title="Fallidos" value={stats?.failed ?? 0} />
            <Card
              title="IPs sospechosas"
              value={stats?.suspiciousIps?.length ?? 0}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
            <section className="xl:col-span-2 bg-[#07111c] border border-white/10 rounded-3xl p-6">
              <div className="mb-5">
                <h2 className="text-2xl font-black">Actividad últimas 24h</h2>
                <p className="text-white/40 text-sm">
                  Intentos totales, correctos y fallidos por hora.
                </p>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.18}
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.12}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-[#07111c] border border-white/10 rounded-3xl p-6">
              <h2 className="text-2xl font-black mb-2">Top IPs sospechosas</h2>
              <p className="text-white/40 text-sm mb-5">
                IPs con más fallos registrados.
              </p>

              <div className="space-y-3 max-h-72 overflow-y-auto">
                {(stats?.suspiciousIps ?? []).slice(0, 8).map((ip: any) => (
                  <div
                    key={ip.ip}
                    className="bg-[#0b1623] border border-white/10 rounded-2xl p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="font-mono text-sm truncate">{ip.ip}</p>
                      <span
                        className={`text-xs font-black rounded-full border px-3 py-1 ${riskStyle(
                          ip.risk
                        )}`}
                      >
                        {ip.risk}
                      </span>
                    </div>
                    <p className="text-white/50 text-sm mt-2">
                      Fallos:{" "}
                      <span className="text-red-400 font-black">
                        {ip.count}
                      </span>
                    </p>
                  </div>
                ))}

                {(stats?.suspiciousIps ?? []).length === 0 && (
                  <div className="text-white/40 text-center py-10">
                    No hay IPs sospechosas.
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="bg-[#07111c] border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black">Últimos eventos</h2>
                <p className="text-white/40 text-sm">
                  Últimos intentos de acceso registrados.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-[#0b1623]">
                  <tr>
                    <th className="text-left p-4">Fecha</th>
                    <th className="text-left p-4">Email</th>
                    <th className="text-left p-4">IP</th>
                    <th className="text-left p-4">Estado</th>
                    <th className="text-left p-4">Motivo</th>
                  </tr>
                </thead>

                <tbody>
                  {lastEvents.map((item, index) => (
                    <tr
                      key={item.id ?? index}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="p-4 text-white/70">
                        {formatDate(item.created_at)}
                      </td>

                      <td className="p-4">{item.email ?? "Sin email"}</td>

                      <td className="p-4 font-mono text-sm">
                        {item.ip ?? "Sin IP"}
                      </td>

                      <td className="p-4">
                        {item.success ? (
                          <span className="text-green-400 font-black">
                            ✔ Correcto
                          </span>
                        ) : (
                          <span className="text-red-400 font-black">
                            ✖ Fallido
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-white/60">
                        {item.reason ?? "-"}
                      </td>
                    </tr>
                  ))}

                  {lastEvents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-white/40 py-12">
                        No existen registros todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-[#07111c] rounded-2xl border border-white/10 p-6">
      <p className="text-white/50 text-sm">{title}</p>
      <p className="text-4xl font-black text-green-400 mt-3">{value}</p>
    </div>
  );
}