import { randomUUID } from "node:crypto";
import { apiFootballFetch } from "@/lib/apiFootballFetch";
import { getApiFootballRedis } from "@/lib/apiFootballRedis";

export const LIVE_CACHE_SECONDS = 300;
export const LIVE_POLL_SECONDS = 30;
const SNAPSHOT_KEY = "irvin:api-football:live:v1:snapshot";
const REFRESH_KEY = "irvin:api-football:live:v1:refresh";
const RETAIN_SECONDS = 86400;

type Snapshot = {
  data: Record<string, unknown> & { response: unknown[] };
  updatedAt: number;
};

function validSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<Snapshot>;
  return typeof snapshot.updatedAt === "number" && Number.isFinite(snapshot.updatedAt) &&
    Boolean(snapshot.data && Array.isArray(snapshot.data.response) && !snapshot.data.error &&
      (!snapshot.data.errors || Object.keys(snapshot.data.errors).length === 0));
}

// Keep the gate for the full interval, including on failure: disconnected callers cannot retry per user.
export const PUBLISH_LIVE_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`;

export async function readLiveFixtures() {
  const redis = getApiFootballRedis();
  const cached = await redis.get<Snapshot>(SNAPSHOT_KEY);
  const previous = validSnapshot(cached) ? cached : null;
  if (previous && Date.now() - previous.updatedAt < LIVE_CACHE_SECONDS * 1000) {
    return { ...previous, stale: false };
  }

  const owner = randomUUID();
  const acquired = await redis.set(REFRESH_KEY, owner, { nx: true, ex: LIVE_CACHE_SECONDS });
  if (!acquired) {
    if (previous) return { ...previous, stale: true };
    throw new Error("Actualización compartida pendiente");
  }

  try {
    // All provider access still reserves the atomic daily budget before making a request.
    const response = await apiFootballFetch("https://v3.football.api-sports.io/fixtures?live=all", {
      signal: AbortSignal.timeout(10000),
    });
    const snapshot: Snapshot = { data: await response.json(), updatedAt: Date.now() };
    if (!response.ok || !validSnapshot(snapshot)) throw new Error("Respuesta de partidos inválida");
    const published = await redis.eval(PUBLISH_LIVE_SCRIPT,
      [REFRESH_KEY, SNAPSHOT_KEY], [owner, JSON.stringify(snapshot), RETAIN_SECONDS]);
    if (published !== 1) throw new Error("Actualización compartida caducada");
    return { ...snapshot, stale: false };
  } catch {
    // An error is never stored as match data. The gate prevents immediate retries, including at quota exhaustion.
    if (previous) return { ...previous, stale: true };
    throw new Error("Partidos temporalmente no disponibles");
  }
}
