import nodemailer from "nodemailer";
import { diagnoseSmtpError } from "@/lib/smtp/errors";
import type { ComposeMessage, SmtpConfig } from "@/lib/smtp/schema";
import type { SendResult, VerifyResult } from "@/types/smtp";

// Generous but bounded so a dead server cannot hang a serverless function.
const TRANSPORT_TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
} as const;

/**
 * Build a one-shot transport from a validated config. The transport is created
 * per request and closed in a `finally` block - credentials never outlive the
 * request, and `logger`/`debug` stay off so nothing is ever written to stdout.
 */
export function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.username ? { user: config.username, pass: config.password } : undefined,
    ...TRANSPORT_TIMEOUTS,
    logger: false,
    debug: false,
  });
}

const round = (n: number) => Math.round(n);

export async function verifyConnection(config: SmtpConfig): Promise<VerifyResult> {
  const transport = createTransport(config);
  const started = performance.now();
  try {
    await transport.verify();
    return {
      action: "verify",
      ok: true,
      latencyMs: round(performance.now() - started),
      message: "Connection verified - the server accepted the handshake and the credentials.",
    };
  } catch (error) {
    return {
      action: "verify",
      ok: false,
      latencyMs: round(performance.now() - started),
      error: diagnoseSmtpError(error),
    };
  } finally {
    transport.close();
  }
}

export async function sendTestEmail(
  config: SmtpConfig,
  message: ComposeMessage,
): Promise<SendResult> {
  const transport = createTransport(config);
  const started = performance.now();
  try {
    // Verify first so an auth/connection failure is reported before we try to
    // hand the server a message.
    await transport.verify();

    const from = config.fromName.trim()
      ? `${config.fromName.trim()} <${config.fromEmail}>`
      : config.fromEmail;

    const info = await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text?.trim() ? message.text : undefined,
      html: message.html?.trim() ? message.html : undefined,
      attachments: message.attachment
        ? [
            {
              filename: message.attachment.filename,
              contentType: message.attachment.contentType,
              content: Buffer.from(message.attachment.content, "base64"),
            },
          ]
        : undefined,
    });

    return {
      action: "send",
      ok: true,
      latencyMs: round(performance.now() - started),
      messageId: info.messageId,
      accepted: info.accepted?.map(String),
      rejected: info.rejected?.map(String),
      response: typeof info.response === "string" ? info.response : undefined,
    };
  } catch (error) {
    return {
      action: "send",
      ok: false,
      latencyMs: round(performance.now() - started),
      error: diagnoseSmtpError(error),
    };
  } finally {
    transport.close();
  }
}
