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
    <div className="h-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_center,#10243a_0%,#07111c_55%,#03070b_100%)] px-6 py-4 overflow-hidden grid grid-rows-[20px_minmax(0,1fr)_34px] gap-3">
      <div className="text-center text-white/45 text-[11px] font-black tracking-widest truncate">
        {selected.league.toUpperCase()}
      </div>

      <div className="grid grid-cols-[1fr_170px_1fr] items-center gap-6 min-h-0">
        <Team logo={selected.homeFlag} name={selected.home} align="left" />

        <div className="text-center min-w-0">
          <div className="inline-flex items-center justify-center rounded-lg border border-green-400/25 bg-green-500/15 px-3 py-1 text-[10px] text-green-400 font-black mb-2">
            EN VIVO
          </div>

          <div className="text-5xl font-black leading-none tracking-tight">
            {selected.homeScore}
            <span className="mx-2 text-white/35">-</span>
            {selected.awayScore}
          </div>

          <div className="text-[12px] text-white/55 font-black mt-2 truncate">
            {selected.minute} · {selected.half}
          </div>
        </div>

        <Team logo={selected.awayFlag} name={selected.away} align="right" />
      </div>

      <div>
        <div
          className="h-6 rounded-lg overflow-hidden grid text-[11px] font-black text-center shadow-[0_0_24px_rgba(34,197,94,0.15)]"
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

        <div className="grid grid-cols-3 text-center text-[10px] text-white/45 font-black mt-1">
          <span className="truncate">{selected.home}</span>
          <span>EMPATE</span>
          <span className="truncate">{selected.away}</span>
        </div>
      </div>
    </div>
  );
}

function Team({
  logo,
  name,
  align,
}: {
  logo: string;
  name: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-4 min-w-0 ${
        align === "right" ? "justify-end text-right" : "justify-start text-left"
      }`}
    >
      {align === "left" && <Logo logo={logo} name={name} />}

      <div className="min-w-0">
        <div className="text-white/35 text-[10px] font-black tracking-widest">
          {align === "left" ? "LOCAL" : "VISITANTE"}
        </div>
        <div className="text-3xl font-black truncate max-w-[390px] leading-tight">
          {name.toUpperCase()}
        </div>
      </div>

      {align === "right" && <Logo logo={logo} name={name} />}
    </div>
  );
}

function Logo({ logo, name }: { logo: string; name: string }) {
  return logo ? (
    <img src={logo} alt={name} className="w-14 h-14 object-contain shrink-0" />
  ) : (
    <div className="w-14 h-14 bg-white/10 rounded-xl shrink-0" />
  );
}
