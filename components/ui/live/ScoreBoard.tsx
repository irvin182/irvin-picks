import React from "react";

export default function ScoreBoard({
  selected,
}: {
  selected: any;
  prediction: any;
}) {
  return (
    <div className="h-full rounded-2xl border border-white/10 bg-[#07111c] px-5 py-3 overflow-hidden">
      <div className="h-full grid grid-rows-[16px_minmax(0,1fr)] gap-2">
        <div className="text-center text-white/45 text-[9px] font-black tracking-widest truncate">
          {selected.league.toUpperCase()}
        </div>

        <div className="grid grid-cols-[1fr_120px_1fr] items-center gap-4 min-h-0">
          <Team logo={selected.homeFlag} name={selected.home} align="left" />

          <div className="text-center min-w-0">
            <div className="inline-block rounded bg-green-500/20 px-2 py-0.5 text-[8px] text-green-400 font-black mb-1">
              EN VIVO
            </div>

            <div className="text-3xl font-black leading-none">
              {selected.homeScore}
              <span className="mx-1 text-white/35">-</span>
              {selected.awayScore}
            </div>

            <div className="text-[9px] text-white/50 font-bold mt-1 truncate">
              {selected.minute} · {selected.half}
            </div>
          </div>

          <Team logo={selected.awayFlag} name={selected.away} align="right" />
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
      className={`flex items-center gap-2 min-w-0 ${
        align === "right" ? "justify-end text-right" : "justify-start text-left"
      }`}
    >
      {align === "left" && <Logo logo={logo} name={name} />}

      <div className="min-w-0">
        <div className="text-white/35 text-[8px] font-black leading-none">
          {align === "left" ? "LOCAL" : "VISITANTE"}
        </div>
        <div className="text-lg font-black truncate max-w-[320px] leading-tight">
          {name.toUpperCase()}
        </div>
      </div>

      {align === "right" && <Logo logo={logo} name={name} />}
    </div>
  );
}

function Logo({ logo, name }: { logo: string; name: string }) {
  return logo ? (
    <img src={logo} alt={name} className="w-8 h-8 object-contain shrink-0" />
  ) : (
    <div className="w-8 h-8 bg-white/10 rounded-lg shrink-0" />
  );
}
