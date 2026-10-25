// Keep every endpoint used by prediction, reporting, and match detail clients.
const parameters: Record<string, string[]> = {
  fixtures: ["id", "ids", "live", "date", "league", "season", "team", "last", "next", "from", "to", "round", "status", "venue", "timezone"],
  "fixtures/headtohead": ["h2h", "date", "league", "season", "last", "next", "from", "to", "status", "timezone"],
  "fixtures/statistics": ["fixture", "team", "type"],
  "fixtures/events": ["fixture", "team", "player", "type"],
  "fixtures/lineups": ["fixture", "team", "player", "type"],
  "fixtures/players": ["fixture", "team"],
  teams: ["id", "name", "league", "season", "country", "code", "venue", "search"],
  "teams/statistics": ["league", "season", "team", "date"],
  leagues: ["id", "name", "country", "code", "season", "team", "type", "current", "search", "last"],
  standings: ["league", "season", "team"],
  predictions: ["fixture"],
  odds: ["fixture", "league", "season", "date", "timezone", "page", "bookmaker", "bet"],
};
const numeric = new Set(["id", "fixture", "league", "season", "team", "last", "next", "venue", "player", "page", "bookmaker", "bet"]);
export function validApiFootballQuery(path: string, params: URLSearchParams) {
  const allowed = parameters[path];
  if (!allowed || !params.size || params.toString().length > 1024) return false;
  for (const [name, value] of params) {
    if (!allowed.includes(name) || params.getAll(name).length !== 1 || !value || value.length > 100 || /[\x00-\x1f\x7f]/.test(value)) return false;
    if (numeric.has(name) && !/^[1-9]\d{0,9}$/.test(value)) return false;
    if (["last", "next", "page"].includes(name) && Number(value) > 100) return false;
    if (["date", "from", "to"].includes(name) && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) return false;
    if (name === "current" && !/^(true|false)$/.test(value)) return false;
    if (name === "h2h" && !/^\d{1,10}-\d{1,10}$/.test(value)) return false;
    if (name === "ids" && !/^\d{1,10}(-\d{1,10}){0,19}$/.test(value)) return false;
  }
  return true;
}
