import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { runDiagnostics } from "@/lib/diagnostics/dns";
import { runGuards } from "@/lib/smtp/guard";
import { diagnosticsRequestSchema, flattenZodError } from "@/lib/smtp/schema";
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

  const parsed = diagnosticsRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const body: ApiErrorBody = {
      ok: false,
      code: "validation",
      message: "Enter a valid domain.",
      fields: flattenZodError(parsed.error as ZodError),
    };
    return NextResponse.json(body, { status: 400 });
  }

  const guarded = await runGuards(request, "diagnostics", parsed.data.turnstileToken);
  if (!guarded.ok) return NextResponse.json(guarded.body, { status: guarded.status });

  const report = await runDiagnostics(parsed.data.domain);
  return NextResponse.json({ ok: true, report }, { status: 200 });
}
