# AGENT.md — Ping250

Machine-readable project brief for any AI coding agent working in this repo. Read this first;
`README.md` has the human-facing version and `SECURITY.md` has the threat model.

## Purpose

Ping250 is a single-purpose developer tool: enter SMTP credentials, verify the connection
(`transporter.verify()`), send one real test email, and get a human-readable diagnosis when it
fails. It also checks the sending domain's SPF/DKIM/DMARC. It is **not** a bulk sender, not a mail
client, and not a marketing site.

## Tech stack (pinned)

- Next.js **16** (App Router, route handlers, `metadata`/`sitemap`/`robots`/`next/og`)
- TypeScript **5**, `strict: true`, `noUncheckedIndexedAccess: true`
- React **19**
- Nodemailer **6** (server-side only; `serverExternalPackages: ["nodemailer"]`)
- Zod **3** (validation + inline field errors)
- Tailwind CSS **v4** (CSS-first `@theme` tokens in `app/globals.css`; class-based dark via
  `@custom-variant dark`)
- beUI (vendored under `components/motion/`), lucide-animated (vendored under `components/icons/`)
- motion **11**, lucide-react, next-themes, clsx, tailwind-merge
- @upstash/ratelimit + @upstash/redis (per-IP rate limiting; in-memory fallback for dev)
- Cloudflare Turnstile (bot-check on send/verify/diagnostics)
- Web Crypto (PBKDF2-SHA256 210k → AES-GCM-256) for client-side encrypted profiles

## Commands

```bash
pnpm install        # install
pnpm dev            # dev server (Turbopack) on :3000
pnpm build          # production build
pnpm start          # serve the build
pnpm lint           # next lint (eslint-config-next)
pnpm typecheck      # tsc --noEmit
pnpm format         # prettier --write
```

## Architecture & folder conventions

- `app/api/smtp/{verify,send}/route.ts`, `app/api/diagnostics/route.ts` — POST-only route handlers,
  `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- `lib/smtp/` — `schema.ts` (Zod, source of truth for request shapes), `transport.ts` (per-request
  transport factory, closed in `finally`), `errors.ts` (machine code → human message), `presets.ts`
  (provider presets), `guard.ts` (CSRF → rate limit → Turnstile pipeline).
- `lib/diagnostics/dns.ts` — SPF/DKIM/DMARC via `node:dns`.
- `lib/crypto/profiles.ts` + `lib/profile-store.ts` + `lib/history-store.ts` — client-only storage.
- `components/console/smtp-console.tsx` — the client orchestrator (all state + handlers). Panels are
  presentational and receive props/callbacks.
- `components/motion/`, `components/icons/` — **vendored** third-party source. Do not hand-edit
  unless fixing a real bug; prefer upgrading via the shadcn registry commands in the README.
- Path alias: `@/*` → repo root.

## Coding standards

- **Naming:** domain-accurate. `smtpConnectionStatus`, `verifyConnection`, `diagnoseSmtpError` —
  never `data`, `state1`, `doStuff`.
- **Error handling:** routes return structured results. A failed SMTP action is HTTP `200` with
  `{ ok: false, error }`; HTTP 4xx is only for validation/rate-limit/bot-check/csrf faults
  (`ApiErrorBody`). The client throws `ApiError` for non-2xx. Never surface a raw stack trace to the
  UI — map it in `lib/smtp/errors.ts`.
- **Comments:** explain *why* (a timeout choice, a security decision), never *what* an obvious line
  does. No `// set loading to true`.
- **Abstraction:** keep it as simple as the shipped scope requires. Do not add a job queue, an auth
  system, or a plugin layer "for scalability" — the retention roadmap items #4–#7 are explicitly out
  of v1 scope.
- **Copy:** specific and functional, written in an engineer's voice. No "seamlessly/effortlessly/
  unlock/elevate/empower", no exclamation-point enthusiasm, no lorem ipsum, no generic "Something
  went wrong".
- **UI:** use the design tokens (`bg-primary`, `text-muted-foreground`, …) — never hardcode the
  default shadcn zinc/slate. Motion (beUI/lucide-animated) is for state changes, not decoration.
  Keep it accessible: labels, `aria-*`, keyboard focus, AA contrast.

## Anti-AI-slop constraints (hard)

- No purple→blue gradient heroes, no glassmorphism blobs, no centered oversized-headline + two-pill
  hero, no stock emoji as icons.
- No filler marketing copy or vague value props.
- No over-commented code, no premature abstraction, no placeholder content in the shipped UI.
- Every design/copy decision must be justifiable on its merits.

## Hard rules (do not break)

1. **Never persist SMTP credentials server-side** — no DB, no logs, no cookies, no server-side
   sessions holding secrets. Credentials live only in the request and a throwaway transport.
2. **Nodemailer is server-side only.** Never import it in a client component; never send credentials
   from the client except in the request body to our own routes.
3. **One recipient per request.** `compose.to` is a single email string by design.
4. Keep the guard order in `lib/smtp/guard.ts`: same-origin → rate limit → Turnstile.
5. Never put a secret in a `NEXT_PUBLIC_*` variable (it ships to the client bundle).
6. Keep `transport.close()` in a `finally`; keep `logger`/`debug` off.

## Testing expectations

No test runner is wired in v1. When adding tests, use **Vitest** + **@testing-library/react**.
Priority unit tests (pure, high-value): `lib/smtp/schema.ts` (accept/reject cases),
`lib/smtp/errors.ts` (each error kind from a synthetic Nodemailer error), `lib/diagnostics/dns.ts`
(with `node:dns` mocked), `lib/ratelimit.ts` (in-memory window), `lib/crypto/profiles.ts`
(round-trip encrypt/decrypt + wrong-passphrase rejection). Route handlers via `next`'s request
helpers with the guard dependencies mocked.
