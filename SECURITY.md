# Security & tradeoffs

Ping250 relays real email through user-supplied SMTP credentials, so it is treated as a potential
open-relay / spam vector first and a form second. This document states the controls and the
tradeoffs taken, and why.

## Controls (v1)

- **No server-side credential persistence.** Credentials are read from the request body, used to
  build a one-shot Nodemailer transport, and discarded. `logger`/`debug` are disabled so nothing is
  written to stdout. There is no database, no server-side session, and no cookie holding secrets.
- **Validation.** Every field passes a Zod schema (`lib/smtp/schema.ts`). Hosts must be valid
  hostnames, ports 1–65535, bodies size-capped, attachments base64- and size-checked (~1 MB).
- **One recipient per request.** `compose.to` is a single email string. The tool cannot be used to
  blast a recipient list.
- **Per-IP rate limiting.** Sliding-window limits (verify 10/min, send 5/min, diagnostics 20/min by
  default) via Upstash Redis in production; an in-memory fallback covers local dev.
- **Bot-check (Cloudflare Turnstile).** Required on verify/send/diagnostics in production.
- **CSRF.** A same-origin check (`lib/csrf.ts`) rejects cross-origin browser requests; a JSON
  content type forces a CORS preflight as a second line.
- **Transport hardening.** Bounded `connectionTimeout`/`greetingTimeout`/`socketTimeout` so a dead
  or malicious server cannot hang a serverless function.
- **Client-side encrypted profiles.** AES-256-GCM under a PBKDF2-SHA256 key (210,000 iterations).
  Only ciphertext, salt and IV are written to `localStorage`; the passphrase never leaves the page
  and is held in memory only while the vault is unlocked.
- **Sandboxed HTML preview.** Pasted HTML is rendered in an `<iframe sandbox="">` (no scripts).

## Tradeoffs and why

1. **Turnstile instead of accounts/invites.** Accounts would be the strongest gate but add signup
   friction to a tool whose value is "open it, test, leave." Turnstile blocks scripted abuse with
   one human click. *Residual risk:* a determined human can still send — bounded by the per-IP rate
   limit and the one-recipient cap. Acceptable for a public tool; a private deployment can put it
   behind auth at the edge.

2. **Rate limiter fails open on Redis errors.** If Upstash is unreachable, `checkRateLimit` returns
   `success` rather than blocking all mail (availability over strict enforcement). *Consequence:*
   the in-memory fallback is per-instance and useless across serverless replicas, so **production
   must configure Upstash**; without it, abuse protection degrades to Turnstile alone.

3. **CSRF same-origin lets through requests with no `Origin`.** cURL/CI clients send no `Origin`
   header, so they are allowed past the CSRF check and gated instead by Turnstile + rate limit. This
   is intentional: browser CSRF necessarily presents an `Origin`/`Referer`, so the check still stops
   the browser attack it exists for. *Consequence:* with Turnstile disabled (dev), the API is open to
   unauthenticated scripting — fine locally, never disable Turnstile in production.

4. **TLS certificate validation is always on; no `rejectUnauthorized: false` toggle.** Exposing a
   "trust self-signed certs" switch would let the tool be pointed at arbitrary internal servers and
   weaken the default for everyone. *Consequence:* a server with a self-signed certificate cannot be
   tested without a code change. We chose the safer default for a public tool.

5. **Encrypted-profile security is bounded by the passphrase.** There is no recovery (by design — we
   cannot read the vault), and a weak passphrase is a weak vault. While unlocked, the plaintext
   profiles exist in page memory, so an XSS in the page could read them — the standard SPA caveat.
   Mitigation: strict CSP-friendly defaults, no third-party UI scripts beyond Turnstile, and the
   vault is locked on demand.

6. **SMTP-level failures return HTTP 200 with `ok:false`.** This keeps "the server said 535" distinct
   from "our API rejected your request" (4xx). *Consequence:* API consumers must check the `ok`
   field, not just the status code. Documented in `/docs`.

## Reporting

To report a vulnerability, open a private security advisory (or email the maintainer) rather than a
public issue.
