type BasketApiParams = Record<string, string | number | undefined | null>;

type BasketApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
};

const DEFAULT_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 15000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiGetBasket<T = unknown>(
  params: BasketApiParams = {},
  retries = DEFAULT_RETRIES
): Promise<BasketApiResult<T>> {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    const trimmed =
      typeof value === "string" ? value.trim() : String(value);

    if (trimmed === "") continue;
    search.set(key, trimmed);
  }

  const qs = search.toString();
  const url = `/api/stats/api-basket${qs ? `?${qs}` : ""}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      const text = await res.text();
      let data: T | null = null;

      try {
        data = text ? (JSON.parse(text) as T) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        if (attempt === retries) {
          return {
            ok: false,
            status: res.status,
            data,
          };
        }

        if (res.status === 429) {
          await sleep(1200 * (attempt + 1));
        } else if (res.status >= 500) {
          await sleep(700 * (attempt + 1));
        } else {
          await sleep(400);
        }

        continue;
      }

      return {
        ok: true,
        status: res.status,
        data,
      };
    } catch (error: unknown) {
      if (attempt === retries) {
        const isAbort =
          error instanceof Error && error.name === "AbortError";

        return {
          ok: false,
          status: isAbort ? 504 : 500,
          data: null,
        };
      }

      await sleep(500 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    status: 500,
    data: null,
  };
}