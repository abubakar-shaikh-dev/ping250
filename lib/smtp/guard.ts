import { assertSameOrigin, getClientIp } from "@/lib/csrf";
import { checkRateLimit, type RateLimitAction } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import type { ApiErrorBody } from "@/types/smtp";

export type GuardResult =
  | { ok: true; ip: string }
  | { ok: false; status: number; body: ApiErrorBody };

const RATE_LIMIT_COPY: Record<RateLimitAction, string> = {
  verify: "Too many connection checks from your network in a short window.",
  send: "Too many test sends from your network in a short window.",
  diagnostics: "Too many DNS lookups from your network in a short window.",
};

/**
 * The abuse-prevention pipeline every mutating route runs before touching
 * Nodemailer: same-origin check, per-IP rate limit, then the bot check.
 * Order matters — cheap synchronous checks run first.
 */
export async function runGuards(
  request: Request,
  action: RateLimitAction,
  turnstileToken?: string,
): Promise<GuardResult> {
  const csrf = assertSameOrigin(request);
  if (!csrf.ok) {
    return { ok: false, status: 403, body: { ok: false, code: "csrf", message: csrf.reason ?? "Blocked." } };
  }

  const ip = getClientIp(request);
  const limit = await checkRateLimit(ip, action);
  if (!limit.success) {
    const seconds = Math.max(1, Math.ceil(limit.resetMs / 1000));
    return {
      ok: false,
      status: 429,
      body: {
        ok: false,
        code: "rate_limited",
        message: `${RATE_LIMIT_COPY[action]} Try again in about ${seconds}s.`,
        retryAfterMs: limit.resetMs,
      },
    };
  }

  const bot = await verifyTurnstile(turnstileToken, ip);
  if (!bot.ok) {
    return { ok: false, status: 403, body: { ok: false, code: "bot_check", message: bot.reason ?? "Bot check failed." } };
  }

  return { ok: true, ip };
}
