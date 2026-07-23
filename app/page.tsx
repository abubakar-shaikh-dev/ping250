import { SmtpConsole } from "@/components/console/smtp-console";
import { emptyConfig } from "@/lib/smtp/presets";
import type { SmtpConfig } from "@/lib/smtp/schema";

function initialConfigFromEnv(): SmtpConfig {
  return emptyConfig({
    host: process.env.DEFAULT_SMTP_HOST || undefined,
    port: process.env.DEFAULT_SMTP_PORT ? Number.parseInt(process.env.DEFAULT_SMTP_PORT, 10) : undefined,
    secure: process.env.DEFAULT_SMTP_SECURE === "true",
    fromName: process.env.DEFAULT_SMTP_FROM_NAME || undefined,
    fromEmail: process.env.DEFAULT_SMTP_FROM_EMAIL || undefined,
  });
}

const STEPS = [
  { n: "01", title: "Connect", body: "Host, port, TLS mode and credentials - prefilled from a provider preset or typed in." },
  { n: "02", title: "Verify", body: "transporter.verify() confirms the handshake and login before you commit to a send." },
  { n: "03", title: "Send", body: "One real message to one recipient, with the server's SMTP reply shown verbatim." },
];

const CHECKS = [
  {
    title: "Connection & authentication",
    body: "Runs Nodemailer's verify() against your host and port with bounded timeouts, so a dead server or a wrong password fails in seconds - with the reason, not a stack trace.",
  },
  {
    title: "The test send",
    body: "Sends a single message to a single recipient. The server's reply - the 250 OK, or the 550 that explains why not - is surfaced exactly as the server sent it.",
  },
  {
    title: "Deliverability records",
    body: "Looks up SPF, DKIM and DMARC for the sending domain and tells you in plain English what is missing and why it pushes mail toward the spam folder.",
  },
];

export default function HomePage() {
  const initialConfig = initialConfigFromEnv();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <section aria-labelledby="intro-heading" className="mb-6 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          SMTP · Nodemailer · test client
        </p>
        <h1 id="intro-heading" className="mt-2 font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
          Ping<span className="phosphor-glow text-primary">250</span>
        </h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">Send a test. Get a 250.</p>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Enter your SMTP credentials, verify the connection, and send a real test email. When
          something fails you get the actual reason - authentication, timeout, TLS, or a rejected
          recipient - not a stack trace.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="border-l-2 border-primary/40 pl-3">
              <span className="font-mono text-[11px] text-primary">{step.n}</span>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div id="console" className="console-grid -mx-4 rounded-xl px-4 py-4 sm:-mx-6 sm:px-6">
        <SmtpConsole initialConfig={initialConfig} />
      </div>

      <section aria-labelledby="checks-heading" className="mt-10 max-w-4xl">
        <h2 id="checks-heading" className="text-lg font-semibold tracking-tight">
          What Ping250 checks
        </h2>
        <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-3">
          {CHECKS.map((check) => (
            <div key={check.title} className="border-t border-border pt-3">
              <h3 className="text-sm font-medium">{check.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{check.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 rounded-lg border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Where your credentials go:</span> your
          password travels from your browser to the server once, inside the request, and is used
          only to build a throwaway transport that is closed immediately. It is never written to a
          log, a database, or disk. Saved profiles are encrypted in your browser with a passphrase
          only you know.
        </p>
      </section>
    </main>
  );
}
