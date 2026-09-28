import "server-only";
import type {
  ComplexityClassification,
  ErrorClassification,
  EvidenceStateClassification,
} from "@/lib/domain/types";
import {
  COMPLEXITY_CLASSIFICATIONS,
  ERROR_CLASSIFICATIONS,
  EVIDENCE_STATE_CLASSIFICATIONS,
  narrowToVocabulary,
  type ClassificationResult,
  type JudgmentProvider,
} from "./JudgmentProvider";

/**
 * The real bounded-judgment provider.
 *
 * Sits behind the same interface as the mock, so nothing above it changes when
 * this is the one in use. Four things are deliberate, and each came out of
 * reading the SDK's published contract rather than assuming:
 *
 *  - The SDK refuses to run in a browser unless explicitly told otherwise. That
 *    option is never set here, so the credential cannot leak by mistake.
 *  - The SDK already retries with backoff. Adding another layer would multiply
 *    the wait a person is sitting through, so none is added.
 *  - The returned label is narrowed against our own vocabulary at runtime. The
 *    type system's guarantee stops at the network boundary.
 *  - Every failure, of any kind, becomes `uncertain`, which routes the case to a
 *    person. Nothing is ever defaulted to a substantive classification.
 */

/** Descriptions sent with each question. They define the closed set of answers. */
const ERROR_CRITERIA = {
  no_error: "No substantive problem with the result.",
  minor_error: "A small issue with limited impact, such as wording or presentation.",
  material_error: "A meaningful issue requiring correction to the substantive result.",
  critical_error: "A serious issue that should block progression.",
  uncertain: "Cannot be classified confidently from the note alone.",
} as const;

const COMPLEXITY_CRITERIA = {
  routine: "An ordinary case handled by the standard treatment.",
  complex: "A case needing judgement beyond the standard treatment.",
  uncertain: "Cannot be classified confidently from the note alone.",
} as const;

const EVIDENCE_CRITERIA = {
  sufficient: "The supporting evidence needed is present.",
  incomplete: "Some required supporting evidence is missing.",
  contradictory: "The supporting evidence disagrees with itself.",
  unclear: "The state of the supporting evidence cannot be determined.",
} as const;

export class TypeSafeJevProvider implements JudgmentProvider {
  readonly name = "typesafe";
  readonly isLive = true;

  async classifyError(note: string): Promise<ClassificationResult<ErrorClassification>> {
    return this.ask(note, "How serious is this error?", ERROR_CRITERIA, ERROR_CLASSIFICATIONS, "uncertain");
  }

  async classifyComplexity(
    note: string,
  ): Promise<ClassificationResult<ComplexityClassification>> {
    return this.ask(
      note,
      "How complex is this case?",
      COMPLEXITY_CRITERIA,
      COMPLEXITY_CLASSIFICATIONS,
      "uncertain",
    );
  }

  async evaluateEvidenceState(
    note: string,
  ): Promise<ClassificationResult<EvidenceStateClassification>> {
    return this.ask(
      note,
      "What is the state of the supporting evidence?",
      EVIDENCE_CRITERIA,
      EVIDENCE_STATE_CLASSIFICATIONS,
      "unclear",
    );
  }

  /**
   * One bounded question.
   *
   * The SDK is imported at call time rather than at module load, so a packaging
   * or runtime problem degrades to human review instead of breaking the page
   * that merely renders the panel.
   */
  private async ask<T extends string>(
    note: string,
    instructions: string,
    criteria: Record<string, string>,
    vocabulary: readonly T[],
    fallback: T,
  ): Promise<ClassificationResult<T>> {
    try {
      const { TypeSafeClient, choice } = await import("@typesafe-ai/sdk");
      // The key is read from the environment by the SDK, and stays in this process.
      const client = new TypeSafeClient();

      const response = await client.systemOne({
        state: { reviewerNote: note },
        questions: { classification: choice(instructions, criteria) },
      });

      const answer = response.answers.classification;
      return {
        // Narrowed against our vocabulary: a label we do not recognise is not an
        // answer, and pretending otherwise would put it into the evidence.
        result: narrowToVocabulary(answer.choice, vocabulary, fallback),
        // A routing signal. No threshold in the product reads it.
        confidence: typeof answer.confidence === "number" ? answer.confidence : 0,
        source: "live",
      };
    } catch {
      // Authentication, rate limiting, timeout, connection loss, a malformed
      // reply: all of them mean a person has to look at this.
      return { result: fallback, confidence: 0, source: "live" };
    }
  }
}
