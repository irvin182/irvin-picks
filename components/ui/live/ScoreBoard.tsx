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
    <div className="h-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_center,#10243a_0%,#07111c_58%,#03070b_100%)] px-5 py-3 overflow-hidden">
     <div className="h-full grid grid-rows-[22px_120px_44px] gap-2">
        <div className="text-center text-white/45 font-black text-[11px] tracking-widest truncate">
          {selected.league.toUpperCase()}
        </div>

        <div className="grid grid-cols-[1fr_170px_1fr] items-center gap-5 min-h-0">
          <Team name={selected.home} logo={selected.homeFlag} side="home" />

          <div className="text-center min-w-0">
            <div className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-green-500/15 border border-green-500/20 text-green-400 font-black text-[10px] mb-2">
              EN VIVO
            </div>

            <div className="text-5xl font-black leading-none tracking-tight">
              {selected.homeScore}
              <span className="text-white/35 mx-2">-</span>
              {selected.awayScore}
            </div>

            <div className="mt-2 text-sm font-black text-green-400">
              {selected.minute}
            </div>

            <div className="text-[11px] text-white/45 font-bold truncate">
              {selected.half}
            </div>
          </div>

          <Team name={selected.away} logo={selected.awayFlag} side="away" />
        </div>

        <div className="min-h-0">
          <div
            className="h-6 rounded-md overflow-hidden grid text-center font-black text-[11px]"
            style={{
              gridTemplateColumns: `${Math.max(homeWin, 1)}fr ${Math.max(
                draw,
                1
              )}fr ${Math.max(awayWin, 1)}fr`,
            }}
          >
            <div className="bg-green-500 flex items-center justify-center text-black">
              {homeWin}%
            </div>
            <div className="bg-slate-500 flex items-center justify-center">
              {draw}%
            </div>
            <div className="bg-blue-600 flex items-center justify-center">
              {awayWin}%
            </div>
          </div>

          <div className="grid grid-cols-3 text-center text-[10px] mt-1 text-white/45 font-bold gap-2">
            <span className="truncate">{selected.home}</span>
            <span>EMPATE</span>
            <span className="truncate">{selected.away}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Team({
  name,
  logo,
  side,
}: {
  name: string;
  logo: string;
  side: "home" | "away";
}) {
  return (
    <div
      className={`min-w-0 flex items-center gap-3 ${
        side === "away" ? "justify-end text-right" : "justify-start text-left"
      }`}
    >
      {side === "home" && <Logo logo={logo} name={name} />}

      <div className="min-w-0">
        <div className="text-[11px] text-white/35 font-black tracking-widest">
          {side === "home" ? "LOCAL" : "VISITANTE"}
        </div>
        <div className="text-2xl font-black leading-tight truncate max-w-[330px]">
          {name.toUpperCase()}
        </div>
      </div>

      {side === "away" && <Logo logo={logo} name={name} />}
    </div>
  );
}

function Logo({ logo, name }: { logo: string; name: string }) {
  if (!logo) {
    return <div className="w-16 h-16 rounded-xl bg-white/10 shrink-0" />;
  }

  return (
    <img
      src={logo}
      alt={name}
      className="w-16 h-16 object-contain shrink-0"
    />
  );
}