type Summary = {
  risk: string;
  attempts: number;
  success: number;
  failed: number;
  suspiciousIps: number;
  events?: number;
};

function riskStyle(risk: string) {
  if (risk === "HIGH") return "text-red-400 border-red-500/30 bg-red-500/10";
  if (risk === "MEDIUM") return "text-yellow-300 border-yellow-500/30 bg-yellow-500/10";
  return "text-green-400 border-green-500/30 bg-green-500/10";
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-[#07111c] rounded-2xl border border-white/10 p-6">
      <p className="text-white/50 text-sm">{title}</p>
      <p className="text-4xl font-black text-green-400 mt-3">{value}</p>
    </div>
  );
}

export default function SecuritySummary({ summary }: { summary?: Summary }) {
  const risk = summary?.risk ?? "LOW";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-5 mb-8">
      <div className={`rounded-2xl border p-6 ${riskStyle(risk)}`}>
        <p className="text-sm opacity-80">Riesgo actual</p>
        <p className="text-4xl font-black mt-3">{risk}</p>
        <p className="text-xs opacity-70 mt-2">
          Calculado por fallos e IPs sospechosas.
        </p>
      </div>

      <Card title="Intentos" value={summary?.attempts ?? 0} />
      <Card title="Correctos" value={summary?.success ?? 0} />
      <Card title="Fallidos" value={summary?.failed ?? 0} />
      <Card title="IPs sospechosas" value={summary?.suspiciousIps ?? 0} />
      <Card title="Eventos" value={summary?.events ?? 0} />
    </div>
  );
}