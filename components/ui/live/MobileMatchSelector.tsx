"use client";

type Match = {
  id: number;
  minute: string;
  minuteNumber: number;
  half: string;
  league: string;
  country: string;
  leagueLogo: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  homeFlag: string;
  awayFlag: string;
  apiUpdatedAt: number;
};

type Props = {
  matches: Match[];
  selectedId: number;
  tick: number;
  getLiveMinute: (match: Match, tick: number) => string;
  onSelect: (match: Match) => void;
};

export default function MobileMatchSelector({
  matches,
  selectedId,
  tick,
  getLiveMinute,
  onSelect,
}: Props) {
  return (
    <section className="rounded-3xl bg-[#07111c] border border-white/10 p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="font-black text-white/80">Cambiar partido</div>
        <div className="text-green-400 font-black text-sm">
          {matches.length} LIVE
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m)}
            className={`min-w-[230px] rounded-2xl p-3 border text-left ${
              selectedId === m.id
                ? "bg-green-500/15 border-green-400/50"
                : "bg-white/5 border-white/10"
            }`}
          >
            <div className="flex justify-between items-center gap-2">
              <span className="text-green-400 font-black">
                {getLiveMinute(m, tick)}
              </span>
              <span className="font-black">
                {m.homeScore}-{m.awayScore}
              </span>
            </div>

            <div className="mt-2 text-sm font-bold truncate">{m.home}</div>
            <div className="text-sm font-bold truncate text-white/60">
              {m.away}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}