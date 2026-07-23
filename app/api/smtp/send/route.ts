import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { runGuards } from "@/lib/smtp/guard";
import { flattenZodError, sendRequestSchema } from "@/lib/smtp/schema";
import { sendTestEmail } from "@/lib/smtp/transport";
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

  const parsed = sendRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const body: ApiErrorBody = {
      ok: false,
      code: "validation",
      message: "Check the highlighted fields.",
      fields: flattenZodError(parsed.error as ZodError),
    };
    return NextResponse.json(body, { status: 400 });
  }

  const guarded = await runGuards(request, "send", parsed.data.turnstileToken);
  if (!guarded.ok) return NextResponse.json(guarded.body, { status: guarded.status });

  const result = await sendTestEmail(parsed.data.config, parsed.data.message);
  return NextResponse.json(result, { status: 200 });
}
