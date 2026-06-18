export function calculateMomentum({
  homeShots,
  awayShots,
  homeShotsOn,
  awayShotsOn,
  homeCorners,
  awayCorners,
  homePossession,
  awayPossession,
}: {
  homeShots: number;
  awayShots: number;
  homeShotsOn: number;
  awayShotsOn: number;
  homeCorners: number;
  awayCorners: number;
  homePossession: string | number;
  awayPossession: string | number;
}) {
  const parse = (v: string | number) =>
    typeof v === "number" ? v : Number(String(v).replace("%", "")) || 50;

  const homePoss = parse(homePossession);
  const awayPoss = parse(awayPossession);

  const home =
    homeShots * 1.2 +
    homeShotsOn * 2.5 +
    homeCorners * 1.4 +
    homePoss * 0.25;

  const away =
    awayShots * 1.2 +
    awayShotsOn * 2.5 +
    awayCorners * 1.4 +
    awayPoss * 0.25;

  const total = Math.max(1, home + away);

  const homePercent = Math.round((home / total) * 100);
  const awayPercent = 100 - homePercent;

  const leader =
    homePercent > awayPercent + 8
      ? "LOCAL DOMINA"
      : awayPercent > homePercent + 8
      ? "VISITANTE DOMINA"
      : "PARTIDO EQUILIBRADO";

  return {
    homePercent,
    awayPercent,
    leader,
  };
}