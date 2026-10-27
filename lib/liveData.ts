export type FixtureStatistics = {
  team?: { id?: number; name?: string };
  statistics?: { type: string; value: unknown }[];
};

// Absence is distinct from an observed zero. Only numeric provider values are accepted.
export function liveNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+(\.\d+)?%?$/.test(value.trim())) return null;
  const number = typeof value === "number" ? value : Number(value.trim().replace(/%$/, ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function readLiveStat(stats: FixtureStatistics[], team: string | number, name: string) {
  const row = stats.find(item => typeof team === "number" ? item?.team?.id === team : item?.team?.name === team);
  const raw = Array.isArray(row?.statistics)
    ? row.statistics.find(item => item?.type === name)?.value
    : undefined;
  if (name !== "Ball Possession" && typeof raw === "string" && raw.includes("%")) return null;
  const value = liveNumber(raw);
  if (value === null || (name === "Ball Possession" && value > 100)) return null;
  if (["Total Shots", "Shots on Goal", "Corner Kicks"].includes(name) && !Number.isInteger(value)) return null;
  return value;
}

export function liveValue(value: number | null | undefined, suffix = "") {
  return typeof value === "number" && Number.isFinite(value) ? `${value}${suffix}` : "No disponible";
}
