# CLAUDE.md

Instructions for Claude Code working in this repository.

## What this is

Ping250 — a Next.js 16 tool that verifies SMTP credentials and sends one real test email via
Nodemailer, with human-readable failure diagnostics and SPF/DKIM/DMARC checks. Full context in
[`README.md`](./README.md); the machine-readable brief and coding standards in
[`AGENT.md`](./AGENT.md); the threat model in [`SECURITY.md`](./SECURITY.md). Read `AGENT.md` before
non-trivial changes — do not duplicate its contents here.

## Commands

```bash
pnpm dev        # :3000 (Turbopack)
pnpm build      # production build
pnpm lint       # next lint
pnpm typecheck  # tsc --noEmit
pnpm format     # prettier
```

## Where things live

- SMTP logic: `lib/smtp/` (`schema.ts` Zod source of truth, `transport.ts`, `errors.ts`, `presets.ts`, `guard.ts`).
- Routes: `app/api/smtp/{verify,send}/route.ts`, `app/api/diagnostics/route.ts` (POST-only, Node runtime).
- UI orchestrator: `components/console/smtp-console.tsx`; panels are presentational.
- Vendored libs (don't hand-edit): `components/motion/` (beUI), `components/icons/` (lucide-animated).
- Design tokens: `app/globals.css` (Tailwind v4 `@theme`; use tokens, not raw colors).
- Client-only storage: `lib/crypto/profiles.ts`, `lib/profile-store.ts`, `lib/history-store.ts`.

## Code style

- TypeScript strict; domain-accurate names; explain *why* in comments, never *what*.
- Routes return structured results: SMTP failure = `200 { ok:false, error }`; 4xx only for
  validation/rate-limit/bot-check/csrf. Map errors in `lib/smtp/errors.ts`, never leak stack traces.
- Use the design tokens and beUI/lucide-animated for state changes only. No filler copy, no
  gradient-hero/glassmorphism clichés (see AGENT.md "Anti-AI-slop").

## Gotchas — things not to break

- **Never persist SMTP credentials server-side** (no DB/logs/cookies/sessions). Request + throwaway
  transport only; `transport.close()` in `finally`; `logger`/`debug` off.
- **Nodemailer is server-side only.** Never import it client-side; credentials travel only in the
  request body to our own routes.
- **One recipient per request** — `compose.to` is a single email by design (anti open-relay).
- Keep the guard order in `lib/smtp/guard.ts`: same-origin → rate limit → Turnstile.
- Never add a secret to `NEXT_PUBLIC_*` (it ships to the browser).
- Don't introduce a job queue / auth system for the out-of-scope roadmap items (#4–#7 in README).
- Tailwind **v4**: tokens live in `globals.css` `@theme`; dark mode is class-based via
  `@custom-variant dark`. Don't reintroduce a `tailwind.config.js` unless adding a plugin.
