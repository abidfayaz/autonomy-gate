import type {
  ComplexityClassification,
  ErrorClassification,
  EvidenceStateClassification,
} from "@/lib/domain/types";

/**
 * Bounded judgment.
 *
 * This layer exists for one narrow situation: the input is ambiguous human
 * language, a fixed rule cannot parse it, and the required answer is a closed
 * set. It classifies evidence that flows *into* the gate. It never touches the
 * gate itself.
 *
 * Three constraints are structural rather than conventional:
 *
 *  - every answer comes from a closed vocabulary, and anything outside it is
 *    treated as `uncertain`;
 *  - a consequential answer is not evidence until a person confirms it;
 *  - failure and uncertainty both route to a person. Nothing is ever defaulted.
 */

export const ERROR_CLASSIFICATIONS: readonly ErrorClassification[] = [
  "no_error",
  "minor_error",
  "material_error",
  "critical_error",
  "uncertain",
];

export const COMPLEXITY_CLASSIFICATIONS: readonly ComplexityClassification[] = [
  "routine",
  "complex",
  "uncertain",
];

export const EVIDENCE_STATE_CLASSIFICATIONS: readonly EvidenceStateClassification[] = [
  "sufficient",
  "incomplete",
  "contradictory",
  "unclear",
];

/** Classifications a person must confirm before they count as evidence. */
export const CONSEQUENTIAL_BY_AGENT: Record<string, readonly ErrorClassification[]> = {
  // Judgment-heavy work: a material error matters as much as a critical one.
  "tax-helper": ["critical_error", "material_error", "uncertain"],
  "invoice-helper": ["critical_error", "uncertain"],
};

export function requiresHumanConfirmation(
  agentId: string,
  result: ErrorClassification,
): boolean {
  const consequential = CONSEQUENTIAL_BY_AGENT[agentId] ?? ["critical_error", "uncertain"];
  return consequential.includes(result);
}

export interface ClassificationResult<T extends string> {
  result: T;
  /** Reported confidence. A routing signal, never a threshold the gate reads. */
  confidence: number;
  /** Which provider answered, so a mocked answer is never passed off as live. */
  source: "mock" | "live";
}

export interface JudgmentProvider {
  readonly name: string;
  readonly isLive: boolean;
  classifyError(note: string): Promise<ClassificationResult<ErrorClassification>>;
  classifyComplexity(note: string): Promise<ClassificationResult<ComplexityClassification>>;
  evaluateEvidenceState(
    note: string,
  ): Promise<ClassificationResult<EvidenceStateClassification>>;
}

/**
 * Narrows anything a provider returns to the closed vocabulary.
 *
 * A provider's answer arrives over a network, so the type system's guarantee
 * ends at the boundary. Anything unrecognised becomes `uncertain`, which routes
 * to a person rather than guessing.
 */
export function narrowToVocabulary<T extends string>(
  value: unknown,
  vocabulary: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (vocabulary as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
