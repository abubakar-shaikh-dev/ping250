const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === "true";
}

export interface TurnstileOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * Verify a Cloudflare Turnstile token server-side. When the widget is disabled
 * (local dev) every request passes — the rate limiter is then the only gate,
 * which is acceptable on localhost but not in production.
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string | undefined,
): Promise<TurnstileOutcome> {
  if (!turnstileEnabled()) return { ok: true };

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false, reason: "Bot check is enabled but the secret key is not configured." };
  }
  if (!token) {
    return { ok: false, reason: "The bot check did not complete. Reload the page and try again." };
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    if (!res.ok) {
      return { ok: false, reason: "The bot-check service returned an error. Try again." };
    }

    const data = (await res.json()) as { success?: boolean };
    return data.success
      ? { ok: true }
      : { ok: false, reason: "We could not confirm you are human. Reload and try again." };
  } catch {
    return { ok: false, reason: "Could not reach the bot-check service. Try again in a moment." };
  }
}
