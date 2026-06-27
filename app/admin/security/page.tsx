"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import SecuritySummary from "@/components/security/SecuritySummary";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SecurityMap = dynamic(
  () => import("@/components/ui/admin/SecurityMap").then((mod) => mod.default),
  { ssr: false }
);

type Attempt = {
  id?: string;
  email: string | null;
  ip: string | null;
  success: boolean;
  reason: string | null;
  created_at: string;
};

type LoginLog = {
  id: string;
  email: string | null;
  ip: string | null;

  browser: string | null;
  os: string | null;
  device: string | null;

  country: string | null;
  city: string | null;

  latitude: number | null;
  longitude: number | null;

  isp: string | null;
  asn: string | null;

  is_vpn: boolean;
  is_proxy: boolean;
  is_tor: boolean;

  risk: "LOW" | "MEDIUM" | "HIGH" | null;

  created_at: string;
};

type SecurityEvent = {
  id: string;
  type: string;
  title: string;
  email: string | null;
  ip: string |null;

  browser: string | null;
  os: string | null;
  device: string | null;

  country: string | null;
  city: string | null;

  isp: string | null;
  asn: string | null;

  is_vpn: boolean;
  is_proxy: boolean;
  is_tor: boolean;

  connection_type: string | null;

  reason?: string | null;

  risk: string;

  created_at: string;
};  

type SecurityResponse = {
  summary: {
    risk: string;
    attempts: number;
    success: number;
    failed: number;
    suspiciousIps: number;
    events?: number;
  };
  attempts: Attempt[];
  logs: LoginLog[];
  events: SecurityEvent[];
  countries: Record<string, number>;
};

function riskStyle(risk: string) {
  if (risk === "HIGH") return "text-red-400 border-red-500/30 bg-red-500/10";
  if (risk === "MEDIUM") return "text-yellow-300 border-yellow-500/30 bg-yellow-500/10";
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

      if (a.success) hours[index].success += 1;
      else hours[index].failed += 1;
    }
  });

  return hours;
}

function getTopSuspiciousIps(attempts: Attempt[]) {
  const failed = attempts.filter((a) => a.success === false && a.ip);

  const grouped = failed.reduce((acc: Record<string, number>, item) => {
    const ip = item.ip || "Sin IP";
    acc[ip] = (acc[ip] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([ip, count]) => ({
      ip,
      count,
      risk: count >= 10 ? "HIGH" : count >= 3 ? "MEDIUM" : "LOW",
    }))
    .sort((a, b) => b.count - a.count);
}

export default function SecurityPage() {
  const [data, setData] = useState<SecurityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSecurity() {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/security", { cache: "no-store" });
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
  const logs = data?.logs ?? [];
  const events = data?.events ?? [];
  const summary = data?.summary;

  const chartData = useMemo(() => getHourlyData(attempts), [attempts]);
  const topSuspiciousIps = useMemo(() => getTopSuspiciousIps(attempts), [attempts]);

  return (
    <main className="min-h-screen bg-[#03070b] text-white p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <Link href="/admin" className="text-green-400 hover:text-green-300 font-bold">
            ← Volver al panel
          </Link>

          <h1 className="text-3xl md:text-5xl font-black mt-4 text-green-400">
            🛡 Security Center
          </h1>

          <p className="text-white/60 mt-2">
            Monitor profesional de seguridad de Irvin Analytics.
          </p>
        </div>

        <button
          onClick={loadSecurity}
          className="bg-green-500 hover:bg-green-400 text-black font-black px-5 py-3 rounded-xl w-full md:w-auto"
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
          <SecuritySummary summary={summary} />

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
                    <Area type="monotone" dataKey="total" stroke="#22c55e" fill="#22c55e" fillOpacity={0.18} />
                    <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="#ef4444" fillOpacity={0.12} />
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
                {topSuspiciousIps.slice(0, 8).map((ip) => (
                  <div key={ip.ip} className="bg-[#0b1623] border border-white/10 rounded-2xl p-4">
                    <div className="flex justify-between gap-3">
                      <p className="font-mono text-sm truncate">{ip.ip}</p>
                      <span className={`text-xs font-black rounded-full border px-3 py-1 ${riskStyle(ip.risk)}`}>
                        {ip.risk}
                      </span>
                    </div>

                    <p className="text-white/50 text-sm mt-2">
                      Fallos: <span className="text-red-400 font-black">{ip.count}</span>
                    </p>
                  </div>
                ))}

                {topSuspiciousIps.length === 0 && (
                  <div className="text-white/40 text-center py-10">
                    No hay IPs sospechosas.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
            <section className="xl:col-span-2 bg-[#07111c] border border-white/10 rounded-3xl p-6">
              <div className="mb-5">
                <h2 className="text-2xl font-black">🌍 Mapa de conexiones</h2>
                <p className="text-white/40 text-sm">
                  Últimas ubicaciones detectadas por IP.
                </p>
              </div>

              <SecurityMap logs={logs} />
            </section>

            <section className="bg-[#07111c] border border-white/10 rounded-3xl p-6">
              <h2 className="text-2xl font-black mb-2">🌎 Países conectados</h2>
              <p className="text-white/40 text-sm mb-5">
                Accesos agrupados por país.
              </p>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {Object.entries(data?.countries ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([country, count]) => (
                    <div key={country} className="bg-[#0b1623] border border-white/10 rounded-2xl p-4 flex justify-between items-center">
                      <div>
                        <div className="font-black">{country}</div>
                        <div className="text-white/40 text-sm">Conexiones</div>
                      </div>

                      <div className="text-3xl font-black text-green-400">{count}</div>
                    </div>
                  ))}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
            <StatsBox title="🌐 Navegadores" field="browser" logs={logs} />
            <StatsBox title="💻 Sistemas" field="os" logs={logs} />
            <StatsBox title="📱 Dispositivos" field="device" logs={logs} />
          </div>

          <section className="bg-[#07111c] border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-2xl font-black">Últimos eventos</h2>
              <p className="text-white/40 text-sm">
                Últimos accesos, intentos y eventos de seguridad registrados.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px]">

<thead className="bg-[#0b1623]">
  <tr>
    <th className="text-left p-4">Fecha</th>
    <th className="text-left p-4">Evento</th>
    <th className="text-left p-4">Email</th>
    <th className="text-left p-4">IP</th>
    <th className="text-left p-4">Ubicación</th>
    <th className="text-left p-4">Dispositivo</th>
    <th className="text-left p-4">Proveedor</th>
    <th className="text-left p-4">Conexión</th>
    <th className="text-left p-4">VPN</th>
    <th className="text-left p-4">Riesgo</th>
  </tr>
</thead>




            <tbody>
  {events.slice(0, 20).map((event) => (
    <tr
      key={event.id}
      className="border-t border-white/10 hover:bg-white/5"
    >
      <td className="p-4 text-white/70">
        {formatDate(event.created_at)}
      </td>

      <td className="p-4 font-black">
        {event.title}
      </td>

      <td className="p-4">
        {event.email ?? "Sin email"}
      </td>

      <td className="p-4 font-mono text-sm">
        {event.ip ?? "Sin IP"}
      </td>

      <td className="p-4 text-white/70">
        {[event.city, event.country].filter(Boolean).join(", ") || "Sin ubicación"}
      </td>

      <td className="p-4 text-white/70">
        {[event.device, event.os, event.browser].filter(Boolean).join(" · ") || "-"}
      </td>

      <td className="p-4">
        {event.isp ?? "-"}
      </td>

      <td className="p-4">
        {event.connection_type ?? "-"}
      </td>

      <td className="p-4">
        {event.is_tor ? (
          <span className="text-red-500 font-black">TOR</span>
        ) : event.is_vpn ? (
          <span className="text-yellow-400 font-black">VPN</span>
        ) : event.is_proxy ? (
          <span className="text-orange-400 font-black">PROXY</span>
        ) : (
          <span className="text-green-400">Normal</span>
        )}
      </td>

      <td className="p-4">
        <span
          className={`text-xs font-black rounded-full border px-3 py-1 ${riskStyle(
            event.risk
          )}`}
        >
          {event.risk}
        </span>
      </td>
    </tr>
  ))}

  {events.length === 0 && (
    <tr>
      <td colSpan={10} className="text-center text-white/40 py-12">
        No existen eventos todavía.
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

function StatsBox({
  title,
  field,
  logs,
}: {
  title: string;
  field: "browser" | "os" | "device";
  logs: LoginLog[];
}) {
  const items = Object.entries(
    logs.reduce((acc: Record<string, number>, log) => {
      const key = log[field] ?? "Desconocido";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const total = items.reduce((sum, [, value]) => sum + value, 0);

  return (
    <section className="bg-[#07111c] border border-white/10 rounded-3xl p-6">
      <h2 className="text-2xl font-black mb-5">{title}</h2>

      <div className="space-y-4">
        {items.map(([label, count]) => {
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={label}>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-bold">{label}</span>
                <span className="text-green-400 font-black">
                  {count} · {percent}%
                </span>
              </div>

              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full" style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-center text-white/40 py-10">
            Sin datos todavía.
          </div>
        )}
      </div>
    </section>
  );
}