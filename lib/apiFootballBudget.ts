import { getApiFootballRedis } from "@/lib/apiFootballRedis";

export const DAILY_LIMIT = 7000;
const PREFIX = "irvin:api-football:quota:v2:";
export function quotaWindow(now = new Date()) {
  return { day: now.toISOString().slice(0, 10), reset: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) / 1000 };
}

// A missing observation must never be interpreted as zero consumption.
export const RESERVE_SCRIPT = `
local count = tonumber(redis.call("GET", KEYS[1]))
local ceiling = tonumber(ARGV[1])
if KEYS[2] then
  local provider_ceiling = tonumber(redis.call("GET", KEYS[2]))
  if not provider_ceiling or provider_ceiling < 0 or provider_ceiling ~= math.floor(provider_ceiling) then return 0 end
  ceiling = math.min(ceiling, provider_ceiling)
end
if not count or count < 0 or count ~= math.floor(count) or count >= ceiling then return 0 end
redis.call("INCR", KEYS[1])
return 1
`;
export const SYNC_SCRIPT = `
local count = tonumber(redis.call("GET", KEYS[1]) or "0")
local observed = tonumber(ARGV[1])
redis.call("SET", KEYS[1], math.max(count, observed))
redis.call("EXPIREAT", KEYS[1], ARGV[2])
if KEYS[2] then
  local ceiling = tonumber(ARGV[3])
  local previous = tonumber(redis.call("GET", KEYS[2]) or ARGV[3])
  redis.call("SET", KEYS[2], math.min(previous, ceiling))
  redis.call("EXPIREAT", KEYS[2], ARGV[2])
end
return math.max(count, observed)
`;

export function apiFootballEffectiveLimit(providerLimit: number) {
  // Preview can exercise an independent Free account; production keeps the 500-call margin.
  const margin = process.env.VERCEL_ENV === "preview"
    ? Math.min(500, Math.max(1, Math.ceil(providerLimit * 0.1)))
    : 500;
  return Math.min(DAILY_LIMIT, Math.max(0, providerLimit - margin));
}

export async function observeApiFootballUsage(used: number, day: string, providerLimit = 7500) {
  if (!Number.isSafeInteger(used) || used < 0 || !Number.isSafeInteger(providerLimit) || providerLimit <= 0) throw new Error("Invalid quota observation");
  const window = quotaWindow();
  if (day !== window.day) return;
  // Consumption remains a real reservation/observation count, never an offset for a smaller plan.
  await getApiFootballRedis().eval(SYNC_SCRIPT, [PREFIX + day, PREFIX + day + ":limit"], [used, window.reset + 86400, apiFootballEffectiveLimit(providerLimit)]);
}

export async function getApiFootballBudget() {
  const { day, reset } = quotaWindow();
  const redis = getApiFootballRedis();
  const [used, ceiling] = await Promise.all([
    redis.get<number>(PREFIX + day), redis.get<number>(PREFIX + day + ":limit"),
  ]);
  const validCeiling = Number.isSafeInteger(ceiling) && ceiling !== null && ceiling >= 0 && ceiling <= DAILY_LIMIT;
  return { used, limit: validCeiling ? ceiling : DAILY_LIMIT, preventiveLimit: DAILY_LIMIT,
    resetAt: new Date(reset * 1000).toISOString(),
    synchronized: used !== null && Number.isSafeInteger(used) && used >= 0 && validCeiling };
}

export async function reserveApiFootballRequest(): Promise<boolean> {
  try {
    const redis = getApiFootballRedis();
    const window = quotaWindow();
    const budgetKey = PREFIX + window.day;
    const current = await redis.get<number>(budgetKey);
    if (current !== null && Number(current) >= DAILY_LIMIT) return false;
    if (current === null || await redis.get(budgetKey + ":limit") === null) {
      // Incident baseline reported by the production dashboard. Never probe an exhausted day.
      if (window.day === "2026-10-25" && process.env.VERCEL_ENV !== "preview") {
        await observeApiFootballUsage(7503, window.day);
        return false;
      }
      // One synchronization attempt per five minutes across all instances, including failures.
      const lock = await redis.set(budgetKey + ":sync", "1", { nx: true, ex: 300 });
      if (!lock) return false;
      const key = process.env.APIFOOTBALL_KEY;
      if (!key) return false;
      const response = await fetch("https://v3.football.api-sports.io/status", {
        headers: { "x-apisports-key": key }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      });
      if (response.status === 429) {
        await observeApiFootballUsage(DAILY_LIMIT, window.day);
        return false;
      }
      if (!response.ok) return false;
      const data = await response.json();
      const used = data?.response?.requests?.current;
      const limit = data?.response?.requests?.limit_day;
      if (typeof used !== "number" || !Number.isSafeInteger(used) || used < 0 || !Number.isSafeInteger(limit) || limit <= 0 || Object.keys(data?.errors ?? {}).length) return false;
      await observeApiFootballUsage(used, window.day, limit);
    }
    if (quotaWindow().day !== window.day) return false;
    return Number(await redis.eval(RESERVE_SCRIPT, [budgetKey, budgetKey + ":limit"], [DAILY_LIMIT])) === 1;
  } catch {
    console.error("API-Football budget unavailable");
    return false;
  }
}
