export async function apiGetBasket(
  params: Record<string, string | number | undefined> = {},
  retries = 2
) {
  const search = new URLSearchParams();

  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    search.set(k, String(v));
  }

  const qs = search.toString();
  const url = `/api/stats/api-basket${qs ? `?${qs}` : ""}`;

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();

      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
        } else {
          await new Promise((r) => setTimeout(r, 400));
        }

        if (i === retries) {
          return { ok: false, status: res.status, data };
        }

        continue;
      }

      return { ok: true, status: res.status, data };
    } catch {
      if (i === retries) {
        return { ok: false, status: 500, data: null };
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return { ok: false, status: 500, data: null };
}