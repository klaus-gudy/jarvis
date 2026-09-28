import { normalizeTzPhone } from "@/lib/phone";

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
 * Best-effort client address, read from the **right** of `x-forwarded-for`.
 *
 * A proxy appends the address it saw, so the rightmost entries are written by
 * infrastructure and everything to their left by the client. Taking the first
 * entry — as this used to — let anyone send their own `x-forwarded-for` and get
 * a fresh per-IP budget with every request. `TRUSTED_PROXY_HOPS` is how many
 * proxies sit in front of the app (1 on Railway); the entry that many places
 * from the end is the one the outermost trusted proxy recorded. Locally there
 * is no header and every caller collapses to one bucket, which is fine.
 */
export function clientIp(request: Request) {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded.split(",").map((entry) => entry.trim()).filter(Boolean);
    const ip = chain[Math.max(0, chain.length - hops)];
    if (ip) return ip;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * The per-account limiter key for an identifier as typed.
 *
 * Normalised the same way the account lookup is, or the budget is per
 * *spelling*: `0712 345 678`, `0712-345678` and `+255712345678` are one phone
 * and must be one bucket, not an unlimited supply of fresh ones.
 */
export function identifierKey(identifier: string) {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return normalizeTzPhone(trimmed) ?? trimmed;
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
