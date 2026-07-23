import type { ComposeMessage, SmtpConfig } from "@/lib/smtp/schema";
import type { DiagnosticError } from "@/lib/smtp/errors";

export type { DiagnosticError } from "@/lib/smtp/errors";
export type { Attachment, ComposeMessage, SmtpConfig } from "@/lib/smtp/schema";

export interface VerifyResult {
  action: "verify";
  ok: boolean;
  latencyMs: number;
  message?: string;
  /** The server's SMTP reply text — useful signal, never a credential. */
  response?: string;
  error?: DiagnosticError;
}

export interface SendResult {
  action: "send";
  ok: boolean;
  latencyMs: number;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  response?: string;
  error?: DiagnosticError;
}

export type SmtpActionResult = VerifyResult | SendResult;

/** A saved connection. Lives only in the browser, encrypted at rest (see lib/crypto). */
export interface SmtpProfile {
  id: string;
  name: string;
  config: SmtpConfig;
  createdAt: number;
  updatedAt: number;
}

/** One row in the local, session-persisted test history. No bodies, no secrets. */
export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: "verify" | "send";
  presetLabel: string;
  host: string;
  to?: string;
  status: "success" | "error";
  latencyMs: number;
  errorTitle?: string;
}

export type DnsStatus = "pass" | "warn" | "fail" | "info";

export interface DnsFinding {
  status: DnsStatus;
  label: string;
  detail: string;
  records?: string[];
}

export interface DiagnosticsReport {
  domain: string;
  spf: DnsFinding;
  dkim: DnsFinding;
  dmarc: DnsFinding;
  summary: string[];
  checkedAt: number;
}

/** Shape returned by every API route on the happy path or a handled failure. */
export interface ApiErrorBody {
  ok: false;
  code:
    | "validation"
    | "rate_limited"
    | "bot_check"
    | "csrf"
    | "method"
    | "server";
  message: string;
  fields?: Record<string, string>;
  retryAfterMs?: number;
}
