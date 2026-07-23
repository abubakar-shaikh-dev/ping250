import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitAction = "verify" | "send" | "diagnostics";

interface LimitSpec {
  limit: number;
  windowMs: number;
}

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SPECS: Record<RateLimitAction, LimitSpec> = {
  verify: { limit: intFromEnv(process.env.RATE_LIMIT_VERIFY_PER_MIN, 10), windowMs: 60_000 },
  send: { limit: intFromEnv(process.env.RATE_LIMIT_SEND_PER_MIN, 5), windowMs: 60_000 },
  diagnostics: { limit: 20, windowMs: 60_000 },
};

export interface RateLimitOutcome {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

// ── Upstash (production) ──────────────────────────────────────────────────────
// One Ratelimit instance per action, built lazily and cached at module scope.
const upstashCache = new Map<RateLimitAction, Ratelimit>();
let upstashAvailable: boolean | undefined;

function getUpstash(action: RateLimitAction): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    upstashAvailable = false;
    return null;
  }
  upstashAvailable = true;
  const cached = upstashCache.get(action);
  if (cached) return cached;
  const spec = SPECS[action];
  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(spec.limit, `${spec.windowMs / 1000} s`),
    analytics: false,
    prefix: "ping250:rl",
  });
  upstashCache.set(action, limiter);
  return limiter;
}

// ── In-memory fallback (local dev) ────────────────────────────────────────────
// Not shared across serverless instances — fine for one dev process, useless as
// production abuse protection, which is exactly why Upstash exists above.
const memoryBuckets = new Map<string, number[]>();

function memoryCheck(key: string, spec: LimitSpec): RateLimitOutcome {
  const now = Date.now();
  const windowStart = now - spec.windowMs;
  const hits = (memoryBuckets.get(key) ?? []).filter((t) => t > windowStart);
  const allowed = hits.length < spec.limit;
  if (allowed) hits.push(now);
  memoryBuckets.set(key, hits);
  const oldest = hits[0] ?? now;
  return {
    success: allowed,
    limit: spec.limit,
    remaining: Math.max(0, spec.limit - hits.length),
    resetMs: Math.max(0, oldest + spec.windowMs - now),
  };
}

/**
 * Rate-limit a caller. `identifier` should already be scoped per-IP (and per
 * action) by the caller — e.g. `${ip}:send`.
 */
export async function checkRateLimit(
  identifier: string,
  action: RateLimitAction,
): Promise<RateLimitOutcome> {
  const spec = SPECS[action];
  const limiter = getUpstash(action);
  if (!limiter) return memoryCheck(`${action}:${identifier}`, spec);

  try {
    const result = await limiter.limit(`${action}:${identifier}`);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetMs: Math.max(0, result.reset - Date.now()),
    };
  } catch {
    // If Redis is unreachable, fail open for availability but record nothing
    // sensitive. Production should treat persistent failures as an alert.
    return { success: true, limit: spec.limit, remaining: spec.limit, resetMs: 0 };
  }
}

export function isUsingUpstash(): boolean {
  return upstashAvailable === true;
}
