import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How Ping250 verifies SMTP connections and sends test email: the request flow, port and TLS guidance, an error glossary, deliverability records, the HTTP API, and the security model.",
  alternates: { canonical: "/docs" },
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="border-t border-border py-8 first:border-t-0">
      <h2 id={`${id}-h`} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="scrollbar-slim overflow-x-auto rounded-lg border border-border bg-card px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/90">
      {children}
    </pre>
  );
}

const PORTS = [
  { port: "465", tls: "Implicit TLS", note: "secure = true. The connection is encrypted from the first byte. Preferred when offered." },
  { port: "587", tls: "STARTTLS", note: "secure = false. Starts plain, then upgrades to TLS via STARTTLS. The modern submission standard." },
  { port: "25", tls: "Usually plain", note: "Server-to-server relay. Blocked for outbound by most clouds and ISPs - avoid for testing." },
];

const ERRORS = [
  { kind: "Authentication failed", meaning: "The server rejected the username/password (SMTP 535), or wants auth before talking (530).", fix: "Check the credentials. Gmail/Zoho/Fastmail need an app password. SendGrid's username is the literal string “apikey”." },
  { kind: "Connection timed out", meaning: "No response within the timeout (ETIMEDOUT).", fix: "Confirm the port and TLS mode line up, and that no firewall blocks egress. Port 25 is commonly blocked." },
  { kind: "Host not found", meaning: "The hostname did not resolve in DNS (ENOTFOUND).", fix: "Fix the host spelling - smtp.gmail.com, not smtp.gmail.co." },
  { kind: "TLS handshake failed", meaning: "The encrypted session could not be set up (EPROTOCOL / certificate errors).", fix: "Match port to TLS mode (465 = secure on, 587 = secure off). Self-signed certs on internal servers need explicit trust." },
  { kind: "Recipient address rejected", meaning: "The server refused the To (or From) address (550 / 5.1.1).", fix: "Send to an address you control. Some servers require From to equal the authenticated account." },
  { kind: "Rejected by server policy", meaning: "Accepted the connection, refused the message (5.7.x) - spam, relay or reputation.", fix: "Check SPF/DKIM/DMARC with the diagnostics tab. New IPs are often throttled." },
];

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Documentation</p>
      <h1 className="mt-2 font-mono text-3xl font-semibold tracking-tight">
        Ping<span className="text-primary">250</span> docs
      </h1>
      <p className="mt-2 text-muted-foreground">
        Everything the tool does, how the SMTP flow works under the hood, and how to script it.
      </p>

      <Section id="flow" title="How a test works, end to end">
        <p>
          Every action is a single HTTP POST from your browser to a server-side route. Credentials
          live only in that request body. The route validates the input with Zod, runs the
          same-origin check, the per-IP rate limiter and the bot check, then builds a throwaway
          Nodemailer transport, does the work, closes the transport, and returns a structured
          result. Nothing is written to a log, a database, or disk.
        </p>
        <Code>{`browser ──POST /api/smtp/send──▶ route handler
   │                                 │  1. Zod validation
   │   { config, message,            │  2. same-origin (CSRF) check
   │     turnstileToken }            │  3. per-IP rate limit (Upstash)
   │                                 │  4. Cloudflare Turnstile verify
   │                                 │  5. createTransport(config)
   │                                 │  6. transporter.verify()
   │                                 │  7. transporter.sendMail(message)
   │◀── { ok, latencyMs, … } ────────┘  8. transport.close()`}</Code>
      </Section>

      <Section id="ports" title="Ports and TLS, the part everyone gets wrong">
        <p>
          Most failed tests are a port/TLS mismatch. The <code>secure</code> flag must match the
          port: implicit TLS on 465, STARTTLS on 587.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-mono text-primary">Port</th>
                <th className="py-2 pr-4 font-medium text-foreground">Mode</th>
                <th className="py-2 font-medium text-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {PORTS.map((row) => (
                <tr key={row.port} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-4 font-mono text-primary">{row.port}</td>
                  <td className="py-2 pr-4 text-foreground">{row.tls}</td>
                  <td className="py-2">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="errors" title="Error glossary">
        <p>
          Failures are mapped from Nodemailer's machine codes (EAUTH, ECONNECTION, ETIMEDOUT,
          EENVELOPE…) and the server's SMTP reply into a plain title, an explanation, and a next
          step.
        </p>
        <ul className="space-y-3">
          {ERRORS.map((err) => (
            <li key={err.kind} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground">{err.kind}</p>
              <p className="mt-1 text-sm">{err.meaning}</p>
              <p className="mt-1 text-sm text-accent-foreground">
                <span className="font-medium">Fix:</span> {err.fix}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="deliverability" title="SPF, DKIM and DMARC in one paragraph each">
        <p>
          <span className="font-medium text-foreground">SPF</span> lists which servers may send for
          your domain. A record ending in <code>-all</code> (hard fail) is strongest;{" "}
          <code>~all</code> (soft fail) is common; <code>+all</code> authorises the entire internet
          and is a hole.
        </p>
        <p>
          <span className="font-medium text-foreground">DKIM</span> signs each message so receivers
          can prove it was not altered in transit. It lives at{" "}
          <code>selector._domainkey.domain</code>; the diagnostics tab tries the common selectors.
        </p>
        <p>
          <span className="font-medium text-foreground">DMARC</span> tells receivers what to do when
          SPF or DKIM fails - <code>p=none</code> only reports, <code>p=quarantine</code> sends to
          spam, <code>p=reject</code> refuses outright.
        </p>
      </Section>

      <Section id="api" title="HTTP API">
        <p>
          The same logic the UI uses is exposed as JSON routes. A failed SMTP action returns HTTP
          200 with <code>ok: false</code> and a structured error; HTTP 4xx is reserved for
          validation, rate-limit and bot-check faults.
        </p>
        <Code>{`POST /api/smtp/verify
{ "config": { "host", "port", "secure", "username", "password", "fromName", "fromEmail" },
  "turnstileToken": "…" }

POST /api/smtp/send
{ "config": { … },
  "message": { "to", "subject", "text"?, "html"?, "attachment"? },
  "turnstileToken": "…" }

POST /api/diagnostics
{ "domain": "acme.dev", "turnstileToken": "…" }`}</Code>
        <p>
          With Turnstile enabled in production, programmatic callers must supply a valid token. For
          local scripting, set <code>NEXT_PUBLIC_TURNSTILE_ENABLED=false</code> and the routes are
          gated only by the rate limiter. A dedicated, separately-authenticated API mode for CI/CD
          is on the roadmap.
        </p>
      </Section>

      <Section id="security" title="Security and abuse prevention">
        <p>
          This tool relays real mail through user-supplied credentials, so it is treated as a
          potential open-relay vector. In v1: every field is Zod-validated; recipients are capped at
          one per request; sends are gated by Cloudflare Turnstile plus a per-IP sliding-window rate
          limit (Upstash in production, in-memory for local dev); and a same-origin check blocks
          cross-site request forgery from browsers. Credentials are never logged, stored, or
          persisted server-side.
        </p>
        <p>
          Saved profiles are encrypted in the browser with AES-256-GCM under a key derived from your
          passphrase via PBKDF2-SHA256 (210,000 iterations). Only ciphertext, salt and IV are stored
          in localStorage; the passphrase never leaves the page.
        </p>
      </Section>
    </main>
  );
}
