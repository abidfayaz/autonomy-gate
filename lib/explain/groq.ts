import "server-only";
import type { ExplanationInput } from "./templates";

/**
 * Rephrases a decision that has already been made.
 *
 * What this receives is the finished result and nothing else: a reason code,
 * the levels involved, and the one or two figures the wording refers to. It
 * never sees the evidence, so it has nothing to form a judgement from, and the
 * outcome is settled before it is called.
 *
 * Called over plain HTTP rather than through a vendor SDK: one request, no
 * dependency, and the credential stays in this process.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";
const TIMEOUT_MS = 4000;

const SYSTEM_PROMPT = [
  "You rewrite a governance decision that has already been made, for an AI operations manager.",
  "Rewrite the supplied summary in at most two sentences of plain English.",
  "Keep every number exactly as given. Do not add numbers, reasons or caveats.",
  "Do not agree or disagree with the decision, and do not suggest what should happen next.",
  "Never mention models, prompts, providers, inference or any implementation detail.",
  "Reply with the rewritten summary only.",
].join(" ");

export interface ExplanationRequest extends ExplanationInput {
  /** The deterministic wording, which the reply must not contradict. */
  standard: string;
}

/**
 * Returns rephrased wording, or null.
 *
 * Null on a missing credential, a refusal, a timeout, an empty reply, or a reply
 * long enough to suggest the model did something other than rephrase. Every one
 * of those falls back to the deterministic wording, which is always correct.
 */
export async function explainWithGroq(request: ExplanationRequest): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
        temperature: 0.2,
        max_tokens: 160,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              decision_code: request.code,
              level_under_review: request.target_level_label,
              summary: request.standard,
              figures: request.detail,
            }),
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;

    const text = content.trim();
    // A rephrasing is about as long as what it rephrased. Anything much longer
    // is not a rephrasing, so it is discarded rather than shown.
    if (text.length === 0 || text.length > request.standard.length * 2 + 120) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
