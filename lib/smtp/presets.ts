import type { SmtpConfig } from "@/lib/smtp/schema";

export type SmtpPresetId =
  | "gmail"
  | "outlook"
  | "sendgrid"
  | "mailgun"
  | "mailtrap"
  | "zoho"
  | "fastmail"
  | "postmark"
  | "ses"
  | "custom";

export interface SmtpPreset {
  id: SmtpPresetId;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  /** Placeholder shown on the username field to steer the user. */
  usernameHint?: string;
  passwordHint?: string;
  /** One line of provider-specific gotcha, shown under the preset select. */
  note?: string;
}

export const SMTP_PRESETS: SmtpPreset[] = [
  {
    id: "gmail",
    label: "Gmail / Google Workspace",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    usernameHint: "you@gmail.com",
    passwordHint: "16-char App Password",
    note: "Requires an App Password (Google Account → Security → 2-Step Verification → App passwords). Your normal Google password will not work.",
  },
  {
    id: "outlook",
    label: "Outlook / Microsoft 365",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    usernameHint: "you@outlook.com",
    note: "Uses STARTTLS on 587. If MFA is enabled you may need an app password or an OAuth2 token.",
  },
  {
    id: "sendgrid",
    label: "SendGrid",
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    usernameHint: "apikey",
    passwordHint: "SG. … API key",
    note: "Username is literally the string “apikey”; the password is a SendGrid API key with Mail Send scope.",
  },
  {
    id: "mailgun",
    label: "Mailgun",
    host: "smtp.mailgun.org",
    port: 587,
    secure: false,
    usernameHint: "postmaster@yourdomain.com",
    passwordHint: "SMTP password",
    note: "Use the SMTP credentials from your Mailgun domain's sending settings, not the API key.",
  },
  {
    id: "mailtrap",
    label: "Mailtrap (sandbox)",
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    secure: false,
    usernameHint: "sandbox username",
    passwordHint: "sandbox password",
    note: "Great for testing without delivering real mail - messages are caught in the Mailtrap inbox.",
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    host: "smtp.zoho.com",
    port: 465,
    secure: true,
    usernameHint: "you@zoho.com",
    note: "If your account is in another region use smtp.zoho.eu / smtp.zoho.in. App-specific password required when 2FA is on.",
  },
  {
    id: "fastmail",
    label: "Fastmail",
    host: "smtp.fastmail.com",
    port: 465,
    secure: true,
    usernameHint: "you@fastmail.com",
    note: "Generate an app password under Settings → Privacy & Security → App Passwords.",
  },
  {
    id: "postmark",
    label: "Postmark",
    host: "smtp.postmarkapp.com",
    port: 587,
    secure: false,
    usernameHint: "server API token",
    passwordHint: "server API token",
    note: "Both username and password are the server's API token.",
  },
  {
    id: "ses",
    label: "Amazon SES",
    host: "email-smtp.us-east-1.amazonaws.com",
    port: 587,
    secure: false,
    usernameHint: "SMTP username",
    passwordHint: "SMTP password",
    note: "Host is region-specific (email-smtp.<region>.amazonaws.com). Create SMTP credentials in SES - IAM keys are not the same thing.",
  },
  {
    id: "custom",
    label: "Custom",
    host: "",
    port: 587,
    secure: false,
    note: "Port 465 = implicit TLS (secure on). Port 587 = STARTTLS (secure off). Port 25 is usually blocked by cloud providers.",
  },
];

export function getPreset(id: SmtpPresetId): SmtpPreset {
  return SMTP_PRESETS.find((preset) => preset.id === id) ?? SMTP_PRESETS[SMTP_PRESETS.length - 1]!;
}

/** Non-secret defaults that may be prefilled from server env (never the password). */
export interface SmtpDefaults {
  host?: string;
  port?: number;
  secure?: boolean;
  fromName?: string;
  fromEmail?: string;
}

export function emptyConfig(defaults: SmtpDefaults = {}): SmtpConfig {
  return {
    host: defaults.host ?? "",
    port: defaults.port ?? 587,
    secure: defaults.secure ?? false,
    username: "",
    password: "",
    fromName: defaults.fromName ?? "",
    fromEmail: defaults.fromEmail ?? "",
  };
}
