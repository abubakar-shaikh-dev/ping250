/**
 * Human-readable SMTP failure mapping.
 *
 * Nodemailer surfaces failures with a machine `code` (EAUTH, ECONNECTION,
 * ETIMEDOUT, EENVELOPE, ESOCKET, EPROTOCOL …), an SMTP `responseCode`
 * (535, 550, 421 …) and the raw server `response` line. None of that is
 * friendly to a human. This module turns it into a title + explanation + a
 * concrete next step, written the way an engineer who has debugged SMTP would
 * explain it - never a raw stack trace.
 */

export type DiagnosticErrorKind =
  | "auth"
  | "connection"
  | "timeout"
  | "tls"
  | "recipient"
  | "policy"
  | "unknown";

export interface DiagnosticError {
  kind: DiagnosticErrorKind;
  title: string;
  detail: string;
  hint?: string;
  /** Nodemailer error code, e.g. EAUTH. Safe to show - not a secret. */
  code?: string;
  /** SMTP reply code, e.g. 535. */
  responseCode?: number;
  /** The server's SMTP reply text. Useful for debugging, never a credential. */
  response?: string;
}

interface RawSmtpError {
  code?: string;
  responseCode?: number;
  response?: string;
  command?: string;
  message?: string;
}

function pick(error: unknown): RawSmtpError {
  if (error && typeof error === "object") return error as RawSmtpError;
  return { message: String(error) };
}

export function diagnoseSmtpError(error: unknown): DiagnosticError {
  const err = pick(error);
  const code = err.code ?? "";
  const responseCode = err.responseCode;
  const response = typeof err.response === "string" ? err.response : undefined;
  const message = err.message ?? "";
  const haystack = `${code} ${message} ${response ?? ""}`.toLowerCase();

  const base = { code: code || undefined, responseCode, response };

  // ── Authentication ────────────────────────────────────────────────────────
  if (code === "EAUTH" || responseCode === 535 || responseCode === 530 || /auth/.test(haystack)) {
    return {
      kind: "auth",
      title: "Authentication failed",
      detail:
        responseCode === 530
          ? "The server wants authentication before it will talk SMTP. It may require STARTTLS first - try turning secure off on port 587, or on for port 465."
          : "The server rejected the username/password combination.",
      hint:
        "Double-check the credentials. Gmail and Zoho need an app-specific password, not your account password. SendGrid's username is the literal string “apikey” with the API key as password. Some providers reject logins from new IPs until you confirm it was you.",
      ...base,
    };
  }

  // ── TLS / certificate problems ────────────────────────────────────────────
  if (
    code === "EPROTOCOL" ||
    /self[- ]signed|depth_zero|unable to verify the first certificate|err_tls|ssl|certificate/.test(
      haystack,
    )
  ) {
    return {
      kind: "tls",
      title: "TLS handshake failed",
      detail:
        "The encrypted connection could not be established. This is usually a port/TLS-mode mismatch or a certificate the client does not trust (common with self-signed certs on internal mail servers).",
      hint:
        "Port 465 expects implicit TLS (secure on); port 587 expects STARTTLS (secure off) - make sure they line up. If this is a known internal server with a self-signed certificate, the fix is to trust it explicitly, but Ping250 leaves certificate validation on by default for your safety.",
      ...base,
    };
  }

  // ── Timeout ───────────────────────────────────────────────────────────────
  if (code === "ETIMEDOUT" || /timeout|timed out/.test(haystack)) {
    return {
      kind: "timeout",
      title: "Connection timed out",
      detail:
        "The server did not respond in time. Something between you and the mail server is dropping the connection, or the port is wrong.",
      hint:
        "Confirm the port (465 implicit TLS, 587 STARTTLS). Many clouds and ISPs block outbound port 25. Check that no firewall or security group is blocking egress to this host.",
      ...base,
    };
  }

  // ── Cannot reach the host ─────────────────────────────────────────────────
  if (
    code === "ECONNECTION" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "ESOCKET" ||
    /getaddrinfo|econnrefused|enotfound/.test(haystack)
  ) {
    const dns = code === "ENOTFOUND" || code === "EAI_AGAIN" || /getaddrinfo/.test(haystack);
    return {
      kind: "connection",
      title: dns ? "Host not found" : "Could not reach the server",
      detail: dns
        ? "The hostname did not resolve in DNS. It is most likely a typo in the host."
        : "A connection was attempted but refused or could not be opened.",
      hint: dns
        ? "Verify the host spelling (e.g. smtp.gmail.com, not smtp.gmail.co)."
        : "Check the host and port, and make sure your network allows outbound connections to it.",
      ...base,
    };
  }

  // ── Envelope errors: recipient / mailbox / policy ─────────────────────────
  if (code === "EENVELOPE" || err.command === "RCPT TO" || err.command === "MAIL FROM") {
    if (responseCode === 550 || /5\.1\.1|5\.1\.2|no such user|unknown user|recipient rejected/.test(haystack)) {
      return {
        kind: "recipient",
        title: "Recipient address rejected",
        detail:
          err.command === "MAIL FROM"
            ? "The server rejected the sender (From) address. It may require you to send from the authenticated account's own address."
            : "The server rejected the recipient address. It may not exist, or the server does not accept mail for that domain.",
        hint:
          err.command === "MAIL FROM"
            ? "Set the From address to the same address you authenticate with."
            : "Send to an address you control and that definitely exists, then retry.",
        ...base,
      };
    }
    if (responseCode === 552 || /5\.2\.2|mailbox full|over quota/.test(haystack)) {
      return {
        kind: "recipient",
        title: "Mailbox is full",
        detail: "The recipient's mailbox is over quota and cannot accept new mail right now.",
        hint: "Try a different recipient address.",
        ...base,
      };
    }
    if (responseCode === 452 || /4\.5\.3|too many recipients|too many messages/.test(haystack)) {
      return {
        kind: "policy",
        title: "Sending limit hit",
        detail: "The server is rate-limiting you - too many recipients or messages in a short window.",
        hint: "Wait a minute and send a single test message.",
        ...base,
      };
    }
    if (responseCode === 553 || /5\.7\.1|5\.7\.0|denied|policy|spam|relay/.test(haystack)) {
      return {
        kind: "policy",
        title: "Rejected by server policy",
        detail:
          "The server accepted the connection but refused the message on policy grounds - often a spam, relay, or reputation check.",
        hint:
          "Check the sending domain's SPF, DKIM and DMARC records (run Deliverability diagnostics). If you just rotated credentials or IPs, the provider may be throttling a new sender.",
        ...base,
      };
    }
  }

  // ── Transient server unavailability ───────────────────────────────────────
  if (responseCode === 421 || /4\.7\.0|try again later|service not available/.test(haystack)) {
    return {
      kind: "policy",
      title: "Server is temporarily unavailable",
      detail: "The server closed the conversation early - it is throttling or restarting.",
      hint: "Retry in a minute. If it persists, check the provider's status page.",
      ...base,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    kind: "unknown",
    title: "The test did not complete",
    detail:
      message ||
      "Something went wrong before a result came back. The code and server reply below are the raw signal if you want to dig in.",
    hint: "Check the host, port, TLS mode and credentials, then try verifying the connection first.",
    ...base,
  };
}
