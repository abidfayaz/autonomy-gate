import { NextResponse } from "next/server";
import { judgments } from "@/lib/data/seed";
import { getJudgmentProvider, MockJevProvider } from "@/lib/judgment";
import { judgmentProviderStatus } from "@/lib/judgment/status";
import { consumeLiveCall, visitorKey } from "@/lib/judgment/usageLimit";

/**
 * Bounded classification, server side only.
 *
 * Pinned to the Node runtime: the real provider's SDK requires Node 20+ and
 * refuses to run in a browser, and its credential must never reach one.
 *
 * The request names a classification rather than carrying text. The product only
 * ever needs to re-classify a note that is already in the seed, so accepting
 * arbitrary text would have bought nothing and offered a public endpoint that
 * spends credit on whatever it is handed. The note is looked up here, which
 * makes the cost of a call fixed and known.
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

  const { judgment_id, question } = (body ?? {}) as {
    judgment_id?: unknown;
    question?: unknown;
  };

  if (typeof judgment_id !== "string" || judgment_id.trim().length === 0) {
    return NextResponse.json({ error: "A classification id is required." }, { status: 400 });
  }

  const judgment = judgments.find((item) => item.judgment_id === judgment_id);
  if (!judgment) {
    // Nothing reaches the provider for an id we do not recognise.
    return NextResponse.json({ error: "Unknown classification." }, { status: 400 });
  }

  const asked: Question =
    question === "complexity" || question === "evidence" ? question : "error";

  // Only a live call costs anything, so only a live call is rationed. With no
  // credential configured the seeded provider answers and the limit is moot.
  const configuredLive = judgmentProviderStatus().live;
  const decision = configuredLive
    ? consumeLiveCall(visitorKey(request))
    : { allowed: true as const };

  // Over the limit falls back to the seeded provider rather than failing. The
  // response says so, and the panel tells the visitor.
  const limited = configuredLive && !decision.allowed;
  const provider = limited ? new MockJevProvider() : await getJudgmentProvider();

  try {
    const note = judgment.reviewer_note;
    const result =
      asked === "complexity"
        ? await provider.classifyComplexity(note)
        : asked === "evidence"
          ? await provider.evaluateEvidenceState(note)
          : await provider.classifyError(note);

    return NextResponse.json({
      ...result,
      question: asked,
      live: provider.isLive,
      limited,
    });
  } catch {
    // A failure routes the case to a person. It never produces a default.
    return NextResponse.json(
      { error: "Classification unavailable. Human review required." },
      { status: 503 },
    );
  }
}
