import { NextResponse } from "next/server";
import { explainWithGroq } from "@/lib/explain/groq";
import { standardSummary, type ExplanationInput } from "@/lib/explain/templates";
import { REASON_CODES, type ReasonCode } from "@/lib/engine";

/**
 * Plain-language wording for a decision that is already final.
 *
 * Server side only, so the credential never reaches a browser. The request
 * carries a reason code and the figures the wording mentions; it carries no
 * evidence, because nothing here is allowed to reach a conclusion.
 */
export const runtime = "nodejs";

const VALID_CODES = new Set<string>(Object.values(REASON_CODES));

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const { code, target_level_label, detail } = (body ?? {}) as Partial<ExplanationInput>;

  if (typeof code !== "string" || !VALID_CODES.has(code)) {
    return NextResponse.json({ error: "Unknown decision code." }, { status: 400 });
  }

  const input: ExplanationInput = {
    code: code as ReasonCode,
    target_level_label: typeof target_level_label === "string" ? target_level_label : null,
    detail: (detail ?? {}) as Record<string, string | number | null>,
  };

  // The deterministic wording is produced first and is what gets returned
  // unless the rephrasing succeeds. The answer is never absent.
  const standard = standardSummary(input);
  const live = await explainWithGroq({ ...input, standard });

  return NextResponse.json({
    summary: live ?? standard,
    source: live ? "live" : "standard",
  });
}
