export type LiveMatchItem = {
  id: number;
  minute: string;
  half: string;
  league: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  homeFlag: string;
  awayFlag: string;
};

export default function MatchSelector({
  matches,
  selectedId,
  onSelect,
}: {
  matches: LiveMatchItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <aside className="rounded-2xl border border-white/10 bg-[#07111c]/90 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="font-black text-lg">PARTIDOS EN VIVO</h2>
        <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 font-black">
          {matches.length}
        </span>
      </div>

      <div className="p-2 space-y-2 overflow-y-auto h-[calc(100%-70px)]">
        {matches.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={`w-full rounded-xl p-4 grid grid-cols-[70px_1fr_40px] items-center text-left transition ${
              selectedId === m.id
                ? "border border-green-500 bg-green-500/10"
                : "border border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            <div>
              <div className="text-2xl font-black text-green-400">
                {m.minute}
              </div>
              <div
                className={`font-bold ${
                  m.half === "HT" ? "text-yellow-400" : "text-green-400"
                }`}
              >
                {m.half}
              </div>
            </div>

            <div className="space-y-2 min-w-0">
              <div className="text-[11px] text-white/40 uppercase truncate">
                {m.league}
              </div>

              <div className="flex items-center gap-2 text-lg truncate">
                {m.homeFlag ? (
                  <img
                    src={m.homeFlag}
                    alt={m.home}
                    className="w-5 h-5 object-contain"
                  />
                ) : null}
                <span className="truncate">{m.home}</span>
              </div>

              <div className="flex items-center gap-2 text-lg truncate">
                {m.awayFlag ? (
                  <img
                    src={m.awayFlag}
                    alt={m.away}
                    className="w-5 h-5 object-contain"
                  />
                ) : null}
                <span className="truncate">{m.away}</span>
              </div>
            </div>

            <div className="text-right space-y-4">
              <div className="text-xl font-black">{m.homeScore}</div>
              <div className="text-xl font-black">{m.awayScore}</div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}