import { NextResponse } from "next/server";
import { getJudgmentProvider } from "@/lib/judgment";

/**
 * Bounded classification, server side only.
 *
 * Pinned to the Node runtime: the real provider's SDK requires Node 20+ and
 * refuses to run in a browser, and its credential must never reach one. Keeping
 * this here means the Phase 11 swap changes nothing above it.
 */
export const runtime = "nodejs";

type Question = "error" | "complexity" | "evidence";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const { note, question } = (body ?? {}) as { note?: unknown; question?: unknown };
  if (typeof note !== "string" || note.trim().length === 0) {
    return NextResponse.json({ error: "A reviewer note is required." }, { status: 400 });
  }

  const asked: Question =
    question === "complexity" || question === "evidence" ? question : "error";

  try {
    const provider = await getJudgmentProvider();
    const result =
      asked === "complexity"
        ? await provider.classifyComplexity(note)
        : asked === "evidence"
          ? await provider.evaluateEvidenceState(note)
          : await provider.classifyError(note);

    return NextResponse.json({ ...result, question: asked, live: provider.isLive });
  } catch {
    // A failure routes the case to a person. It never produces a default.
    return NextResponse.json(
      { error: "Classification unavailable. Human review required." },
      { status: 503 },
    );
  }
}
