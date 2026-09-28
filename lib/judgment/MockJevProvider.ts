import type {
  ComplexityClassification,
  ErrorClassification,
  EvidenceStateClassification,
} from "@/lib/domain/types";
import type { ClassificationResult, JudgmentProvider } from "./JudgmentProvider";

/**
 * Stand-in for the real bounded-judgment service.
 *
 * Deterministic, so the prototype reads the same every time, and honest about
 * what it is: `isLive` is false and every answer is marked `mock`, so a seeded
 * classification is never presented as a live one.
 *
 * It classifies by looking for the language a reviewer actually uses. Crude on
 * purpose: making it cleverer would only disguise that it is a stand-in.
 */

interface Rule<T extends string> {
  result: T;
  confidence: number;
  phrases: readonly string[];
}

const ERROR_RULES: ReadonlyArray<Rule<ErrorClassification>> = [
  {
    result: "critical_error",
    confidence: 0.93,
    phrases: [
      "missing required",
      "filed without",
      "should have blocked",
      "serious",
      "critical",
      "unsafe",
      "marked ready",
    ],
  },
  {
    result: "material_error",
    confidence: 0.88,
    phrases: [
      "missed an important",
      "missed a",
      "wrong treatment",
      "incorrect",
      "needs correction",
      "cross-border",
      "material",
    ],
  },
  {
    result: "minor_error",
    confidence: 0.82,
    phrases: ["wording", "house style", "formatting", "cosmetic", "phrasing", "minor"],
  },
  {
    result: "no_error",
    confidence: 0.9,
    phrases: ["correct", "no issue", "nothing wrong", "accepted as is", "fine"],
  },
];

const COMPLEXITY_RULES: ReadonlyArray<Rule<ComplexityClassification>> = [
  {
    result: "complex",
    confidence: 0.86,
    phrases: ["cross-border", "unusual", "multiple entities", "edge case", "ambiguous"],
  },
  {
    result: "routine",
    confidence: 0.9,
    phrases: ["standard", "routine", "ordinary", "straightforward"],
  },
];

const EVIDENCE_RULES: ReadonlyArray<Rule<EvidenceStateClassification>> = [
  {
    result: "contradictory",
    confidence: 0.84,
    phrases: ["conflicts", "contradict", "disagrees", "inconsistent"],
  },
  {
    result: "incomplete",
    confidence: 0.87,
    phrases: ["missing", "not attached", "absent", "no supporting"],
  },
  {
    result: "sufficient",
    confidence: 0.91,
    phrases: ["complete", "attached", "supported", "all present"],
  },
];

function classify<T extends string>(
  note: string,
  rules: ReadonlyArray<Rule<T>>,
  fallback: T,
): ClassificationResult<T> {
  const text = note.toLowerCase();
  for (const rule of rules) {
    if (rule.phrases.some((phrase) => text.includes(phrase))) {
      return { result: rule.result, confidence: rule.confidence, source: "mock" };
    }
  }
  // Nothing recognised. Saying so routes the case to a person, which is the
  // correct answer; inventing a classification would not be.
  return { result: fallback, confidence: 0.4, source: "mock" };
}

export class MockJevProvider implements JudgmentProvider {
  readonly name = "mock";
  readonly isLive = false;

  async classifyError(note: string): Promise<ClassificationResult<ErrorClassification>> {
    return classify(note, ERROR_RULES, "uncertain");
  }

  async classifyComplexity(
    note: string,
  ): Promise<ClassificationResult<ComplexityClassification>> {
    return classify(note, COMPLEXITY_RULES, "uncertain");
  }

  async evaluateEvidenceState(
    note: string,
  ): Promise<ClassificationResult<EvidenceStateClassification>> {
    return classify(note, EVIDENCE_RULES, "unclear");
  }
}
