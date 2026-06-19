/**
 * Simple in-memory rate limiter for Next.js API routes.
 * Uses sliding window per IP. Resets across serverless cold starts —
 * acceptable for Vercel where short windows (≤60s) work well.
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

// Cleanup stale entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, win] of store.entries()) {
      if (now > win.resetAt) store.delete(key);
    }
  }, 60_000);
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * @param id      Unique key (e.g. `signup:${ip}`)
 * @param limit   Max requests per window
 * @param windowMs Window duration in ms
 */
export function rateLimit(id: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let win = store.get(id);

  if (!win || now > win.resetAt) {
    win = { count: 0, resetAt: now + windowMs };
    store.set(id, win);
  }

  win.count++;

  return {
    success: win.count <= limit,
    remaining: Math.max(0, limit - win.count),
    resetAt: win.resetAt,
  };
}

export function getClientIp(req: { headers: { get: (k: string) => string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
