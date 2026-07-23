/** Best-effort client IP for per-IP rate limiting. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export interface CsrfOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * Same-origin guard for the JSON API.
 *
 * Browsers always send an `Origin` (or `Referer`) on a cross-site POST, and a
 * `fetch` with a JSON content type triggers a CORS preflight — so a forged
 * cross-origin request is caught here. Non-browser clients (cURL, CI) send no
 * Origin at all; we let those through to the bot-check and rate limiter, which
 * are the controls that actually gate them.
 */
export function assertSameOrigin(request: Request): CsrfOutcome {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return { ok: true };

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return { ok: true };

  const source = origin ?? referer;
  if (!source) return { ok: true };

  try {
    const sourceHost = new URL(source).host;
    return sourceHost === host
      ? { ok: true }
      : { ok: false, reason: "Cross-origin requests are not allowed." };
  } catch {
    return { ok: false, reason: "Malformed origin header." };
  }
}
