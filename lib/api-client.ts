import type { ApiErrorBody } from "@/types/smtp";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: ApiErrorBody["code"];
  readonly fields?: Record<string, string>;
  readonly retryAfterMs?: number;

  constructor(message: string, init: { status: number } & Partial<ApiErrorBody>) {
    super(message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields;
    this.retryAfterMs = init.retryAfterMs;
  }
}

/**
 * POST JSON to one of Ping250's routes. HTTP non-2xx responses carry an
 * ApiErrorBody (guard / validation faults) and are thrown as ApiError.
 * SMTP-level outcomes come back as 200 with `ok: true | false` and are
 * returned for the caller to inspect.
 */
export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Network error - could not reach the server.", { status: 0, code: "server" });
  }

  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;

  if (!res.ok) {
    throw new ApiError(data?.message ?? `Request failed with status ${res.status}.`, {
      status: res.status,
      code: data?.code,
      fields: data?.fields,
      retryAfterMs: data?.retryAfterMs,
    });
  }

  return data as T;
}
