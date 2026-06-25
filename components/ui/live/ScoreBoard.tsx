import React from "react";

export default function ScoreBoard({
  selected,
  prediction,
}: {
  selected: any;
  prediction: any;
}) {
  const homeWin = prediction?.homeWin ?? 0;
  const draw = prediction?.draw ?? 0;
  const awayWin = prediction?.awayWin ?? 0;

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_center,#10243a_0%,#07111c_58%,#03070b_100%)] px-6 py-4 overflow-hidden">
      <div className="h-full grid grid-rows-[24px_1fr_48px] gap-3">
        <div className="text-center text-white/50 font-black text-[11px] tracking-widest truncate">
          {selected.league.toUpperCase()}
        </div>

        <div className="grid grid-cols-[1fr_170px_1fr] items-center gap-6 min-h-0">
          <TeamSide
            name={selected.home}
            logo={selected.homeFlag}
            side="home"
          />

          <div className="text-center min-w-0">
            <div className="inline-flex items-center justify-center rounded-md border border-green-500/25 bg-green-500/15 px-3 py-1 text-[10px] font-black text-green-400 mb-2">
              EN VIVO
            </div>

            <div className="text-5xl font-black leading-none tracking-tight">
              {selected.homeScore}
              <span className="mx-2 text-white/35">-</span>
              {selected.awayScore}
            </div>

            <div className="mt-2 text-sm font-black text-green-400">
              {selected.minute}
            </div>

            <div className="text-[11px] text-white/45 font-bold">
              {selected.half}
            </div>
          </div>

          <TeamSide
            name={selected.away}
            logo={selected.awayFlag}
            side="away"
          />
        </div>

        <div>
          <div
            className="h-6 rounded-md overflow-hidden grid text-center text-[11px] font-black"
            style={{
              gridTemplateColumns: `${Math.max(homeWin, 1)}fr ${Math.max(
                draw,
                1
              )}fr ${Math.max(awayWin, 1)}fr`,
            }}
          >
            <div className="bg-green-500 text-black flex items-center justify-center">
              {homeWin}%
            </div>

            <div className="bg-slate-500 flex items-center justify-center">
              {draw}%
            </div>

            <div className="bg-blue-600 flex items-center justify-center">
              {awayWin}%
            </div>
          </div>

          <div className="grid grid-cols-3 text-center text-[10px] text-white/45 font-bold mt-1">
            <span className="truncate">{selected.home}</span>
            <span>EMPATE</span>
            <span className="truncate">{selected.away}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSide({
  name,
  logo,
  side,
}: {
  name: string;
  logo: string;
  side: "home" | "away";
}) {
  const isAway = side === "away";

  return (
    <div
      className={`min-w-0 flex items-center gap-4 ${
        isAway ? "justify-end text-right" : "justify-start text-left"
      }`}
    >
      {!isAway && <TeamLogo logo={logo} name={name} />}

      <div className="min-w-0">
        <div className="text-[10px] text-white/35 font-black tracking-widest">
          {isAway ? "VISITANTE" : "LOCAL"}
        </div>

        <div className="text-2xl font-black leading-tight truncate max-w-[360px]">
          {name.toUpperCase()}
        </div>
      </div>

      {isAway && <TeamLogo logo={logo} name={name} />}
    </div>
  );
}

function TeamLogo({ logo, name }: { logo: string; name: string }) {
  if (!logo) {
    return <div className="w-14 h-14 rounded-xl bg-white/10 shrink-0" />;
  }

  return (
    <img
      src={logo}
      alt={name}
      className="w-14 h-14 object-contain shrink-0"
    />
  );
}