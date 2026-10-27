export const SELECTED_MATCH_STORAGE_KEY = "irvin_analytics_selected_match_id";
export const LIVE_REFRESH_EVENT = "irvin-live-refresh";

export function parseFixtureId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function requestedFixture(search: string) {
  const values = new URLSearchParams(search).getAll("fixture");
  return { requested: values.length > 0, id: values.length === 1 ? parseFixtureId(values[0]) : null };
}

export function legacyLiveDestination(params: Record<string, string | string[] | undefined>) {
  const id = parseFixtureId(params.fixture);
  return id === null ? "/live-tv" : `/live-tv?fixture=${id}`;
}

// Only select IDs present in the shared live list. Never fetch an arbitrary ID
// from a URL or saved browser preference.
export function chooseLiveFixture<T extends {id: number}>(matches: T[], currentId?: number | null, requestedId?: number | null, savedId?: number | null): T | null {
  return matches.find(match => match.id === currentId) ??
    matches.find(match => match.id === requestedId) ??
    matches.find(match => match.id === savedId) ?? matches[0] ?? null;
}
