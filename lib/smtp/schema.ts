import { z } from "zod";

/** Accept a boolean or the string forms a form/JSON body might carry. */
const booleanish = z.preprocess((value) => {
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes" || v === "on";
  }
  return value;
}, z.boolean());

const trimmedString = z.string().trim();

export const smtpConfigSchema = z.object({
  host: trimmedString
    .min(1, "Host is required")
    .max(253, "Host is too long")
    .regex(
      /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
      "Enter a valid hostname such as smtp.gmail.com",
    ),
  port: z.coerce.number().int("Port must be a whole number").min(1).max(65535),
  secure: booleanish,
  username: z.string().max(320, "Username is too long"),
  password: z.string().max(2048, "Password is too long"),
  fromName: trimmedString.max(120, "From name is too long"),
  fromEmail: trimmedString
    .min(1, "From email is required")
    .email("Enter a valid from address"),
});

export type SmtpConfig = z.infer<typeof smtpConfigSchema>;

const MAX_BASE64_BYTES = 1_400_000; // ~1 MB once decoded

export const attachmentSchema = z.object({
  filename: trimmedString.min(1).max(255),
  contentType: z
    .string()
    .max(120)
    .regex(/^[\w.+/-]+$/, "Invalid content type"),
  content: z
    .string()
    .max(MAX_BASE64_BYTES, "Attachment is too large (max ~1 MB)")
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, "Attachment must be base64-encoded"),
});

export type Attachment = z.infer<typeof attachmentSchema>;

export const composeSchema = z
  .object({
    // A single recipient - this is a test-mail tool, not a bulk sender.
    to: trimmedString.min(1, "Recipient is required").email("Enter a valid recipient address"),
    subject: trimmedString.min(1, "Subject is required").max(998, "Subject is too long"),
    text: z.string().max(100_000, "Plain body is too long").optional().or(z.literal("")),
    html: z.string().max(200_000, "HTML body is too long").optional().or(z.literal("")),
    attachment: attachmentSchema.optional(),
  })
  .refine((value) => Boolean(value.text?.trim() || value.html?.trim()), {
    message: "Add a plain or HTML body",
    path: ["text"],
  });

export type ComposeMessage = z.infer<typeof composeSchema>;

export const sendRequestSchema = z.object({
  config: smtpConfigSchema,
  message: composeSchema,
  turnstileToken: z.string().optional(),
});

export type SendRequest = z.infer<typeof sendRequestSchema>;

export const verifyRequestSchema = z.object({
  config: smtpConfigSchema,
  turnstileToken: z.string().optional(),
});

export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

export const diagnosticsRequestSchema = z.object({
  domain: trimmedString
    .min(1, "Domain is required")
    .max(253)
    .regex(/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i, "Enter a valid domain"),
  turnstileToken: z.string().optional(),
});

export type DiagnosticsRequest = z.infer<typeof diagnosticsRequestSchema>;

/** Flatten a ZodError into a field → first-message map the UI can render inline. */
export function flattenZodError(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
