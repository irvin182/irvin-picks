type IrvinAIPanelProps = {
  fixtureEvents: any[];
  selected: any;
  prediction: any;
  bestAction: string;
  risk: string;
  aiDecisions: string[];
  hasStats: boolean;
};

function eventIcon(type: string) {
  if (type === "Goal") return "⚽";
  if (type === "Card") return "🟨";
  if (type === "subst") return "🔁";
  return "•";
}

export default function IrvinAIPanel({
  fixtureEvents,
  selected,
  prediction,
  bestAction,
  risk,
  aiDecisions,
  hasStats,
}: IrvinAIPanelProps) {
  return (
    <aside className="space-y-3 min-h-0 overflow-y-auto pr-1">
      <Panel title="EVENTOS EN VIVO">
        {(fixtureEvents.length > 0 ? fixtureEvents.slice(-5).reverse() : []).map(
          (e: any, i: number) => (
            <div
              key={i}
              className="grid grid-cols-[45px_35px_1fr_auto] py-3 border-b border-white/10 text-sm"
            >
              <span>{e.time?.elapsed}'</span>
              <span>{eventIcon(e.type)}</span>
              <span className="font-bold">{e.type}</span>
              <span
                className={
                  e.team?.name === selected.home ? "text-green-400" : "text-red-400"
                }
              >
                {e.team?.name}
              </span>
            </div>
          )
        )}

        {fixtureEvents.length === 0 && (
          <div className="text-white/50 text-sm">
            Sin eventos disponibles todavía.
          </div>
        )}
      </Panel>

      <Panel title="IRVIN AI DECISIONES">
        <div className="space-y-3">
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
            <div className="text-white/50 text-xs font-bold">
              RECOMENDACIÓN PRINCIPAL
            </div>

            <div className="text-3xl font-black text-green-400 mt-1">
              {prediction?.recommendation ?? "ESPERAR"}
            </div>

            <div className="text-xs text-white/60 mt-2">
              No es garantía de acierto. Úsalo como lectura estadística, no como apuesta segura.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <MiniBox label="ACCIÓN" value={bestAction} color="text-yellow-400" />
            <MiniBox label="RIESGO" value={risk} color="text-red-400" />
            <MiniBox
              label="CONFIANZA"
              value={`${prediction?.confidence ?? 0}%`}
              color="text-green-400"
            />
            <MiniBox
              label="IRVIN SCORE"
              value={`${prediction?.irvinScore ?? 0}/100`}
              color="text-cyan-400"
            />
          </div>

          <div className="space-y-2">
            <div className="text-white/50 text-xs font-bold">LECTURA DE LA IA</div>

            {(aiDecisions.length > 0
              ? aiDecisions
              : ["⚠️ Sin suficientes datos avanzados. Mejor esperar confirmación."]
            )
              .slice(0, 7)
              .map((decision, index) => (
                <div
                  key={index}
                  className="rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-white/80 leading-snug"
                >
                  {decision}
                </div>
              ))}
          </div>

          <div className="rounded-xl bg-[#030b13] border border-white/10 p-3 text-xs text-white/60 leading-relaxed">
            <span className="text-white font-bold">Resumen:</span>{" "}
            {hasStats
              ? "El sistema está usando marcador, minuto, tiros, tiros al arco, posesión, eventos, momentum y Poisson Live."
              : "Modo básico: esta liga no entrega estadísticas avanzadas. La decisión se basa sobre todo en marcador, minuto y eventos."}
          </div>
        </div>
      </Panel>
    </aside>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#07111c]/90 p-4 overflow-hidden">
      <h3 className="font-black text-lg mb-3">{title}</h3>
      {children}
    </div>
  );
}

function MiniBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3 border border-white/10">
      <div className="text-white/40 text-[11px] font-bold">{label}</div>
      <div className={`text-lg font-black mt-1 ${color}`}>{value}</div>
    </div>
  );
}