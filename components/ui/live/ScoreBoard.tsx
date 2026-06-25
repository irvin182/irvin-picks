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
    <div className="h-full border-b border-white/10 bg-[radial-gradient(circle_at_center,#10243a_0%,#07111c_60%,#03070b_100%)] p-5 grid grid-rows-[32px_1fr_92px] gap-3 overflow-hidden">
      <div className="text-center text-white/60 font-black text-sm tracking-wide truncate">
        {selected.league.toUpperCase()}
      </div>

      <div className="grid grid-cols-[1fr_260px_1fr] items-center gap-6 min-h-0">
        <TeamBlock name={selected.home} logo={selected.homeFlag} align="left" />

        <div className="text-center">
          <div className="inline-block mb-3 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 font-black text-sm">
            EN VIVO
          </div>

          <div className="text-6xl font-black tracking-widest leading-none">
            {selected.homeScore} - {selected.awayScore}
          </div>

          <div className="text-xl font-black mt-3 text-green-400">
            {selected.minute}
          </div>

          <div className="text-white/50 font-bold text-sm">{selected.half}</div>
        </div>

        <TeamBlock name={selected.away} logo={selected.awayFlag} align="right" />
      </div>

      <div>
        <div className="text-center text-white/50 mb-2 font-black text-xs tracking-wide">
          PROBABILIDAD DE VICTORIA
        </div>

        <div
          className="h-9 rounded-lg overflow-hidden grid text-center font-black text-sm"
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

        <div className="grid grid-cols-3 text-center text-xs mt-2 text-white/60 font-bold gap-2">
          <span className="truncate">{selected.home}</span>
          <span>EMPATE</span>
          <span className="truncate">{selected.away}</span>
        </div>
      </div>
    </div>
  );
}

function TeamBlock({
  name,
  logo,
  align,
}: {
  name: string;
  logo: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`min-w-0 flex flex-col items-center ${
        align === "left" ? "text-left" : "text-right"
      }`}
    >
      {logo ? (
        <img
          src={logo}
          alt={name}
          className="w-24 h-24 object-contain mb-4"
        />
      ) : (
        <div className="w-24 h-24 mb-4 rounded-2xl bg-white/10" />
      )}

      <div className="w-full text-center text-3xl font-black leading-tight truncate">
        {name.toUpperCase()}
      </div>
    </div>
  );
}