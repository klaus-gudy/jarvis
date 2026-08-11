/**
 * A small fixed-window rate limiter for the endpoints worth brute-forcing.
 *
 * **In-memory, so it is per process.** With more than one instance an attacker
 * gets one budget per instance, and a deploy resets every counter. That is a
 * real limit and the reason this is not a security boundary on its own — it is
 * there to make online guessing slow and expensive, which is most of the value,
 * without adding Redis to a project that has no other need for it. Swap the
 * store for Redis if this ever runs on more than one instance.
 *
 * Fixed window rather than sliding: it is a few lines, and the worst case (a
 * burst either side of a window boundary) is still an order of magnitude
 * slower than unlimited.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/**
 * Entries are only cleaned when the map is walked, so a flood of unique keys
 * can't grow it without bound between requests.
 */
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();

  if (windows.size > MAX_TRACKED_KEYS) sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true };
}

/**
 * Best-effort client address. Behind Railway's proxy the real address is the
 * first entry of `x-forwarded-for`; locally there is no such header and every
 * caller collapses to one bucket, which is fine for a dev machine.
 *
 * Spoofable in principle — anyone can send `x-forwarded-for` — but the hosting
 * proxy overwrites it, and a limiter keyed on a spoofable value still costs an
 * attacker something. The per-account key below is the part that doesn't move.
 */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** The 429 every limited route returns, so they can't describe it differently. */
export function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    {
      error: `Too many attempts. Try again in ${retryAfterSeconds} second${
        retryAfterSeconds === 1 ? "" : "s"
      }.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
