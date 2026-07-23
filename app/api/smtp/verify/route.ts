import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { runGuards } from "@/lib/smtp/guard";
import { flattenZodError, verifyRequestSchema } from "@/lib/smtp/schema";
import { verifyConnection } from "@/lib/smtp/transport";
import type { ApiErrorBody } from "@/types/smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    const body: ApiErrorBody = { ok: false, code: "validation", message: "Request body must be JSON." };
    return NextResponse.json(body, { status: 400 });
  }

  const parsed = verifyRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const body: ApiErrorBody = {
      ok: false,
      code: "validation",
      message: "Check the highlighted fields.",
      fields: flattenZodError(parsed.error as ZodError),
    };
    return NextResponse.json(body, { status: 400 });
  }

  const guarded = await runGuards(request, "verify", parsed.data.turnstileToken);
  if (!guarded.ok) return NextResponse.json(guarded.body, { status: guarded.status });

  const result = await verifyConnection(parsed.data.config);
  // A failed SMTP verify is a *successful* API call that reports ok:false, so
  // it returns 200 — HTTP error codes are reserved for guard/validation faults.
  return NextResponse.json(result, { status: 200 });
}
