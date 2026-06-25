"use client";

type LiveMobileHeaderProps = {
  matchesCount: number;
  loading: boolean;
  onRefresh: () => void;
};

export default function LiveMobileHeader({
  matchesCount,
  loading,
  onRefresh,
}: LiveMobileHeaderProps) {
  return (
    <header
      onClick={onRefresh}
      className="rounded-3xl bg-[#07111c] border border-white/10 p-4 flex items-center gap-4 shadow-2xl active:scale-[0.98] transition cursor-pointer"
    >
      <img
        src="/logo-irvin.png"
        alt="Irvin Analytics"
        className="w-16 h-16 rounded-2xl object-contain bg-black p-2 border border-cyan-400/30 shadow-lg"
      />

      <div className="min-w-0">
        <div className="text-2xl font-black text-green-400 leading-none truncate">
          IRVIN ANALYTICS
        </div>

        <div className="text-white/50 text-sm mt-2">
          {loading
            ? "Actualizando datos..."
            : `Modo móvil · ${matchesCount} partidos en vivo`}
        </div>
      </div>
    </header>
  );
}