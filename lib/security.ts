const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60000) {
  const now = Date.now();

  for (const [bucketKey, bucket] of buckets.entries()) {
    if (bucket.resetAt < now) {
      buckets.delete(bucketKey);
    }
  }

  const current = buckets.get(key);

  if (!current || current.resetAt < now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return { ok: true, remaining: limit - 1 };
  }

  if (current.count >= limit) {
    return { ok: false, remaining: 0 };
  }

  current.count++;

  return {
    ok: true,
    remaining: Math.max(0, limit - current.count),
  };
}

export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return req.headers.get("x-real-ip") || "unknown";
}