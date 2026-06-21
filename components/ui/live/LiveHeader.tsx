export default function LiveHeader({
  matchesCount,
  lastUpdate,
  dataMode,
  dataModeColor,
}: {
  matchesCount: number;
  lastUpdate: string;
  dataMode: string;
  dataModeColor: string;
}) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center border border-white/10 bg-[#07111c]/80 rounded-2xl px-5">
      <div className="flex items-center gap-8">
        <div>
          <div className="text-3xl font-black tracking-[0.18em]">
            IRVIN
          </div>
          <div className="text-xs tracking-[0.45em] text-green-400 font-bold">
            ANALYTICS
          </div>
        </div>

        <div className="text-2xl font-bold">
          IRVIN ANALYTICS PRO
        </div>

        <div className="px-4 py-2 rounded-full bg-green-500/15 text-green-400 font-bold border border-green-500/30">
          ● EN VIVO
        </div>

        <div
          className={`px-4 py-2 rounded-full bg-white/5 font-bold border border-white/10 ${dataModeColor}`}
        >
          {dataMode}
        </div>
      </div>

      <div className="text-center">
        <div className="text-4xl font-black text-green-400">
          {matchesCount}
        </div>
        <div className="text-sm font-bold text-white/80">
          PARTIDOS EN VIVO
        </div>
      </div>

      <div className="text-right">
        <div className="text-2xl font-black">
          {lastUpdate || "--:--:--"}
        </div>
        <div className="text-sm text-white/60">
          Actualización automática
        </div>
      </div>
    </header>
  );
}