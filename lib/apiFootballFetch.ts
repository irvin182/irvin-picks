import { reserveApiFootballRequest, observeApiFootballUsage, quotaWindow, DAILY_LIMIT } from "@/lib/apiFootballBudget";

export class ApiFootballBudgetExceeded extends Error {
  constructor() {
    super("Límite diario de API-Football alcanzado o contador no disponible");
    this.name = "ApiFootballBudgetExceeded";
  }
}

export class ApiFootballProviderError extends Error {
  constructor() {
    super("API-Football devolvió una respuesta no válida");
    this.name = "ApiFootballProviderError";
  }
}

export async function apiFootballFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const parsed = new URL(url);

  if (
    parsed.protocol !== "https:" ||
    parsed.host !== "v3.football.api-sports.io" || parsed.username !== "" || parsed.password !== "" || parsed.hash !== "" || (init.method && init.method !== "GET") || parsed.pathname === "/status"
  ) {
    throw new Error("Destino API-Football no permitido");
  }

  const key = process.env.APIFOOTBALL_KEY;
  if (!key) {
    throw new Error("Falta APIFOOTBALL_KEY");
  }

  const day = quotaWindow().day;
  const allowed = await reserveApiFootballRequest();

  if (!allowed || day !== quotaWindow().day) {
    throw new ApiFootballBudgetExceeded();
  }

  const headers = new Headers(init.headers);
  headers.set("x-apisports-key", key);

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    redirect: "error",
  });
  const rawLimit = response.headers.get("x-ratelimit-requests-limit");
  const rawRemaining = response.headers.get("x-ratelimit-requests-remaining");
  const limit = Number(rawLimit);
  const remaining = Number(rawRemaining);
  const valid = rawLimit !== null && rawRemaining !== null && Number.isSafeInteger(limit) && limit > 0 && Number.isSafeInteger(remaining) && remaining >= 0 && remaining <= limit;
  // Never lower the shared count: concurrent and out-of-order responses are conservative.
  let quotaError = false;
  let validPayload = false;
  try {
    const data = await response.clone().json();
    const errors = data?.errors;
    const hasErrors = errors != null && (typeof errors === "object" ? Object.keys(errors).length > 0 : Boolean(errors));
    quotaError = hasErrors && /rate|quota|limit|requests/i.test(JSON.stringify(errors));
    const payload = data?.response;
    validPayload = !hasErrors && (parsed.pathname === "/teams/statistics"
      ? payload !== null && typeof payload === "object" && !Array.isArray(payload)
      : Array.isArray(payload));
  } catch { /* Invalid JSON must never become statistics or enter the data cache. */ }
  try {
    const observed = !valid ? DAILY_LIMIT : Math.max(limit - remaining,
      quotaError || response.status === 429 ? Math.min(DAILY_LIMIT, limit) : 0);
    await observeApiFootballUsage(observed, day, valid ? limit : 7500);
  } catch {
    throw new ApiFootballBudgetExceeded();
  }
  if (!response.ok || !validPayload) throw new ApiFootballProviderError();
  return response;
}
