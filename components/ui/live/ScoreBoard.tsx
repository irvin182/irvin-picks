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
    return (
  <div className="h-full bg-red-600 text-white text-5xl font-black flex items-center justify-center">
    SCOREBOARD NUEVO
  </div>
);
    <div className="h-full rounded-2xl border border-white/10 bg-[#07111c] px-5 py-3 overflow-hidden grid grid-rows-[20px_1fr_38px] gap-2">
      <div className="text-center text-white/45 font-black text-[10px] tracking-widest truncate">
        {selected.league.toUpperCase()}
      </div>

      <div className="grid grid-cols-[1fr_130px_1fr] items-center gap-4 min-h-0">
        <Team name={selected.home} logo={selected.homeFlag} side="home" />

        <div className="text-center min-w-0">
          <div className="inline-block px-2 py-1 rounded bg-green-500/20 text-green-400 font-black text-[9px] mb-1">
            EN VIVO
          </div>

          <div className="text-4xl font-black leading-none tracking-tight">
            {selected.homeScore}
            <span className="mx-1 text-white/35">-</span>
            {selected.awayScore}
          </div>

          <div className="text-[11px] text-green-400 font-black mt-1">
            {selected.minute} · {selected.half}
          </div>
        </div>

        <Team name={selected.away} logo={selected.awayFlag} side="away" />
      </div>

      <div className="min-h-0">
        <div
          className="h-5 rounded-md overflow-hidden grid text-center font-black text-[10px]"
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

        <div className="grid grid-cols-3 text-center text-[9px] text-white/45 font-bold mt-0.5">
          <span className="truncate">{selected.home}</span>
          <span>EMPATE</span>
          <span className="truncate">{selected.away}</span>
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
        <div className="text-white/35 text-[9px] font-black tracking-widest">
          {side === "home" ? "LOCAL" : "VISITANTE"}
        </div>

        <div className="text-xl font-black truncate max-w-[360px] leading-tight">
          {name.toUpperCase()}
        </div>
      </div>

      {side === "away" && <Logo logo={logo} name={name} />}
    </div>
  );
}

function Logo({ logo, name }: { logo: string; name: string }) {
  return logo ? (
    <img src={logo} alt={name} className="w-10 h-10 object-contain shrink-0" />
  ) : (
    <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
  );
}