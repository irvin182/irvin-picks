const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60000
) {
  const now = Date.now();

  const current = buckets.get(key);

  if (!current || current.resetAt < now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return { ok: true };
  }

  if (current.count >= limit) {
    return { ok: false };
  }

  current.count++;

  return { ok: true };
}

export function getClientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}