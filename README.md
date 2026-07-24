<div align="center">

# Ping250 - **Send a test. Get a 250.**
<img width="1774" height="887" alt="ChatGPT Image Jul 24, 2026, 11_53_34 AM" src="https://github.com/user-attachments/assets/c3e6aec3-a550-464c-a9ad-667b348d3755" />

Verify SMTP credentials and send a real test message with Nodemailer — and get the exact reason it failed when it doesn't.

[![Build](https://img.shields.io/badge/build-passing-1fe07a?style=flat-square)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-7d8a83?style=flat-square)](#license)

</div>

<!-- ── HERO ────────────────────────────────────────────────────────────────
     Drop a screenshot or a 10–15s GIF here: enter credentials → Verify → the
     log streaming "250 2.0.0 OK". Recommended size 1600×1000, dark theme.
     e.g. <img src="./docs/assets/hero.gif" alt="Ping250 console" width="100%" />
────────────────────────────────────────────────────────────────────────── -->

## Why this exists

Every backend developer has done the same dance: change an SMTP password, redeploy, trigger a
"forgot password" email, open the inbox, wait, refresh, wonder. The logs say
`Error: Invalid login: 535-5.7.8 Username and Password not accepted` and you still aren't sure if
it's the password, the port, the TLS mode, or a firewall.

Ping250 collapses that loop to five seconds. Enter the credentials, hit **Verify**, and either see
`250 OK` or get a plain-English explanation of precisely what broke — authentication, timeout, TLS
handshake, or a rejected recipient — with the server's own SMTP reply shown alongside. Then check
the sending domain's SPF/DKIM/DMARC so you know the mail will actually land in the inbox, not spam.

It is a technical instrument, not a form: the connection stays put while you iterate on recipients
and bodies, every run streams to a response log, and a session history lets you compare configs.

## Layout strategy (and why)

The interface is a **command-console split-panel**, chosen deliberately over a single-card form or a
guided stepper:

- **Left rail — Connection.** Host, port, TLS, credentials, provider presets, and the encrypted
  profile switcher. It stays mounted, so testing a second recipient or a tweaked body never means
  re-typing credentials.
- **Center — Compose.** Recipient, subject, plain/HTML body with a sandboxed live preview, optional
  attachment, the Verify/Send actions, and a copyable cURL example.
- **Right — Response.** A streaming, terminal-style log of the SMTP conversation, the structured
  result, and tabs for Deliverability diagnostics and Test history.

A stepper is friendlier for a first-time user but hostile to the actual use case — this is a tool
you run twenty times in a session while wiring up a new provider. The console layout optimises for
that repeat use and reads as an instrument (monospace log, phosphor accents) rather than a marketing
page.

## Tech stack

| Choice | Why |
| --- | --- |
| **Next.js 16 (App Router)** | Server-side route handlers keep Nodemailer and credentials off the client; `metadata`, `sitemap`, `robots` and `next/og` cover SEO cleanly. |
| **TypeScript (strict)** | A tool that handles credentials should not have loose types. `noUncheckedIndexedAccess` is on. |
| **Nodemailer** | The de-facto Node SMTP client; `transporter.verify()` gives a clean connection check before any send. Kept out of the bundler via `serverExternalPackages`. |
| **Zod** | One schema layer validates every field on the server and produces inline field errors for the UI. |
| **Tailwind CSS v4** | CSS-first `@theme` tokens drive one coherent colour system across every component. |
| **beUI** | Motion-first, shadcn-compatible components (`StatefulButton`, `Switch`, `Tabs`, `Select`, `AnimatedToastStack`, `ThemeToggle`). Motion is used to communicate state — a button morphing idle→loading→250 OK — not as decoration. |
| **lucide-animated** | Motion-powered icons reserved for stateful moments (send, verify, copy, success/error). |
| **Upstash Ratelimit** | Per-IP sliding-window rate limiting that actually works across serverless instances, with an in-memory fallback for local dev. |
| **Cloudflare Turnstile** | Bot-check gating on send/verify with no account friction (see [Access gating](#access-gating)). |
| **Web Crypto (PBKDF2 + AES-GCM)** | Client-side encrypted profiles — the passphrase never leaves the browser. |

## Quickstart

```bash
# 1. Clone and install
git clone https://github.com/<you>/ping250.git
cd ping250
pnpm install            # or npm install / bun install

# 2. Configure
cp .env.example .env.local
#    Fill in NEXT_PUBLIC_APP_URL. For local dev the Turnstile test keys in
#    .env.example already work; set NEXT_PUBLIC_TURNSTILE_ENABLED=false to skip it.

# 3. Run
pnpm dev                # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, `pnpm format`.

## Architecture

```
app/
  layout.tsx            # fonts, ThemeProvider, metadata, JSON-LD
  page.tsx              # the console (reads non-secret env defaults)
  globals.css           # Tailwind v4 + the "250 OK" design tokens
  docs/page.tsx         # reference docs (also an SEO surface)
  api/
    smtp/verify/route.ts    # POST — transporter.verify()
    smtp/send/route.ts      # POST — verify + sendMail, one recipient
    diagnostics/route.ts    # POST — SPF / DKIM / DMARC lookup
  sitemap.ts  robots.ts  manifest.ts  opengraph-image.tsx  icon.svg
components/
  console/              # the instrument: connection, compose, response log,
                        #   diagnostics, history, profiles, turnstile, orchestrator
  motion/               # vendored beUI components
  icons/                # vendored lucide-animated icons
lib/
  smtp/                 # schema (Zod), transport, errors (human mapping),
                        #   presets, guard (CSRF → ratelimit → turnstile)
  diagnostics/dns.ts    # SPF/DKIM/DMARC analysis
  crypto/profiles.ts    # PBKDF2 → AES-GCM vault
  ratelimit.ts  turnstile.ts  csrf.ts  api-client.ts
  profile-store.ts  history-store.ts
types/smtp.ts           # shared result / profile / history / report types
```

**The SMTP flow.** The browser POSTs `{ config, message, turnstileToken }` to a route handler. The
handler validates with Zod, runs the guard pipeline (same-origin → per-IP rate limit → Turnstile),
builds a one-shot Nodemailer transport with bounded timeouts, calls `verify()` then `sendMail()`,
closes the transport in a `finally`, and returns a structured result. A failed SMTP action is a
*successful* API call that returns `200 { ok: false, error }`; HTTP 4xx is reserved for
guard/validation faults. Credentials exist only inside the request and are never logged.

## Screenshots

<!-- Replace these placeholders with real captures. -->

| | |
| --- | --- |
| `docs/assets/console-dark.png` — *the console, dark theme* | `docs/assets/console-light.png` — *light theme* |
| `docs/assets/error-auth.png` — *a human-readable auth failure* | `docs/assets/diagnostics.png` — *SPF/DKIM/DMARC report* |

## Security

- **No server-side credential persistence.** Credentials are used to build a throwaway transport and
  discarded; `logger`/`debug` are off so nothing reaches stdout. No database, no server logs, no
  cookies holding secrets.
- **Validation everywhere.** Every field passes a Zod schema; recipients are capped at one per
  request (this is a test tool, not a bulk sender); attachments are size- and charset-checked.
- **Rate limiting per IP.** Sliding-window limits (verify 10/min, send 5/min by default) via Upstash
  in production, with an in-memory fallback for local dev.
- **CSRF.** A same-origin check blocks cross-site browser requests; JSON content type forces a CORS
  preflight as a second line. See [`SECURITY.md`](./SECURITY.md) for the tradeoffs.
- **Client-side encrypted profiles.** AES-256-GCM under a PBKDF2-SHA256 key (210k iterations); only
  ciphertext is stored in `localStorage`, the passphrase never leaves the page.

### Access gating

v1 gates send/verify with **Cloudflare Turnstile** (a managed bot-check) rather than accounts or
invites. Rationale: the tool should be usable without signup friction, but because it relays real
mail it must not be an open relay — Turnstile blocks scripted abuse while a human passes in one
click. It is paired with the per-IP rate limiter and the one-recipient cap. For local development,
`NEXT_PUBLIC_TURNSTILE_ENABLED=false` (or Cloudflare's always-pass test keys) skips the widget.

## Retention features — phasing

**Shipped in v1 (core):**

1. **Client-side encrypted profiles** — save named configs ("Gmail — personal", "SES — prod"),
   encrypted in the browser, one-click switching.
2. **Test history** — local log of runs (provider, status, response time, error) with filtering and
   CSV/JSON export. No bodies or credentials retained.
3. **Deliverability diagnostics** — SPF/DKIM/DMARC checks with a plain-English report.

**Fast-follow / stretch (out of v1 scope):**

4. **Scheduled canary checks** — recurring health checks with webhook/Slack alerts. *Requires Vercel
   Cron Jobs or an external scheduler; cannot run on plain serverless functions — flagged explicitly.*
5. **Shareable redacted reports** — a credentials-stripped link/JSON summary of a result.
6. **CLI / API mode** — a separately-authenticated, documented endpoint for CI/CD pre-deploy checks.
7. **Command palette** (`Cmd+K`) — quick provider switch, send, and history search.

v1's architecture deliberately does **not** anticipate #4–#7 (no job queue, no auth system) — it
stays as simple as the shipped scope requires.

## Deployment (Vercel)

1. Push the repo and import it in [Vercel](https://vercel.com/new). Framework preset: **Next.js**.
2. Set environment variables:
   - `NEXT_PUBLIC_APP_URL` — the production URL (canonical tags, OG, sitemap, CSRF host check).
   - `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_TURNSTILE_ENABLED=true`.
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — **required in production** for shared
     rate limiting (the in-memory fallback does not work across serverless instances).
   - Optional `RATE_LIMIT_*_PER_MIN` and non-secret `DEFAULT_SMTP_*` prefills.
3. Deploy. The SMTP routes run on the Node.js runtime (`export const runtime = "nodejs"`), which
   Vercel selects automatically.

## License

[MIT](./LICENSE) © [Abubakar Shaikh](https://abubakarshaikh.dev).
