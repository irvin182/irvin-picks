export default function ScoreBoard({
  selected,
  prediction,
}: {
  selected: any;
  prediction: any;
}) {
  return (
    <div className="relative p-6 border-b border-white/10 bg-[radial-gradient(circle_at_center,#10243a_0%,#07111c_60%,#03070b_100%)]">
      <div className="text-center text-white/60 font-bold">
        {String(selected.league || "Liga").toUpperCase()}
      </div>

      <div className="absolute top-24 left-10 text-center max-w-[220px]">
        {selected.homeFlag ? (
          <img
            src={selected.homeFlag}
            alt={selected.home}
            className="w-24 h-24 object-contain mx-auto"
          />
        ) : null}

        <div className="text-3xl font-black mt-3 truncate">
          {String(selected.home || "LOCAL").toUpperCase()}
        </div>
      </div>

      <div className="absolute top-24 right-10 text-center max-w-[220px]">
        {selected.awayFlag ? (
          <img
            src={selected.awayFlag}
            alt={selected.away}
            className="w-24 h-24 object-contain mx-auto"
          />
        ) : null}

        <div className="text-3xl font-black mt-3 truncate">
          {String(selected.away || "VISITANTE").toUpperCase()}
        </div>
      </div>

      <div className="text-center mt-12">
        <div className="inline-block mb-4 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 font-black">
          EN VIVO
        </div>

        <div className="text-7xl font-black tracking-widest mt-2">
          {selected.homeScore} - {selected.awayScore}
        </div>

        <div className="text-2xl font-bold mt-3">{selected.minute}</div>
        <div className="text-white/60 font-bold">{selected.half}</div>
      </div>

      <div className="absolute left-6 right-6 bottom-6">
        <div className="text-center text-white/60 mb-2 font-bold">
          PROBABILIDAD DE VICTORIA
        </div>

        <div
          className="h-10 rounded-lg overflow-hidden grid text-center font-black"
          style={{
            gridTemplateColumns: `${prediction?.homeWin ?? 0}fr ${
              prediction?.draw ?? 0
            }fr ${prediction?.awayWin ?? 0}fr`,
          }}
        >
          <div className="bg-green-500 flex items-center justify-center">
            {prediction?.homeWin ?? 0}%
          </div>

          <div className="bg-slate-500 flex items-center justify-center">
            {prediction?.draw ?? 0}%
          </div>

          <div className="bg-blue-600 flex items-center justify-center">
            {prediction?.awayWin ?? 0}%
          </div>
        </div>

        <div className="grid grid-cols-3 text-center text-sm mt-2 text-white/60 font-bold">
          <span className="truncate">{selected.home}</span>
          <span>EMPATE</span>
          <span className="truncate">{selected.away}</span>
        </div>
      </div>
    </div>
  );
}
