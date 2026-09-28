import type { ApprovedScope, AutonomyLevel } from "@/lib/domain/types";
import { previousLevel } from "./levels";
import type { ScopeReport, ScopeSegment } from "./scope";

/**
 * What a human may decide about a changed configuration.
 *
 * Continuity is not promotion, and the difference matters. Promotion moves one
 * level at a time on evidence the task has just produced. Continuity asks
 * whether a level the task *already earned* may carry over to a configuration
 * that has changed underneath it. So a continuity decision can restore a
 * previously approved level directly from Shadow, which a promotion never could.
 *
 * What it cannot do is happen by itself. Previous autonomy stays on the record
 * throughout and is never reinstated without someone deciding to reinstate it.
 */

export type ContinuityAction =
  | "continue-for-validated-scope"
  | "keep-in-shadow"
  | "lower-autonomy";

export type ContinuityRecommendation =
  | "continue-previous-for-validated-scope"
  | "continue-testing-in-shadow"
  | "restrict-scope"
  | "lower-autonomy";

export interface ContinuityOption {
  action: ContinuityAction;
  label: string;
  description: string;
  resulting_level: AutonomyLevel;
  scope: ApprovedScope | null;
  /** Whether recording this resolves the outstanding revalidation. */
  resolves_revalidation: boolean;
  recommended: boolean;
  is_override: boolean;
}

const LEVEL_LABELS: Record<AutonomyLevel, string> = {
  shadow: "L1 · Shadow",
  assisted: "L2 · Assisted",
  supervised: "L3 · Supervised",
  constrained: "L4 · Constrained",
};

/**
 * What the evidence so far supports.
 *
 * An unsafe segment takes precedence over incomplete coverage: a confirmed
 * critical error is a finding that can be acted on now, and waiting for the rest
 * of the suite would not make it go away. How far through validation is remains
 * visible alongside, so the decision is made knowing both.
 */
export function deriveContinuityRecommendation(
  scope: ScopeReport,
  evaluatedCount: number,
  plannedCount: number,
): ContinuityRecommendation {
  if (scope.segments.length === 0) return "continue-testing-in-shadow";
  if (scope.unsafe.length > 0) {
    return scope.unsafe.length === scope.segments.length ? "lower-autonomy" : "restrict-scope";
  }
  if (evaluatedCount < plannedCount) return "continue-testing-in-shadow";
  return "continue-previous-for-validated-scope";
}

/** The fence implied by the segments that came through the change cleanly. */
export function validatedScope(scope: ScopeReport): ApprovedScope | null {
  const retained = scope.segments.filter((segment) => segment.verdict !== "restrict");
  const excluded = scope.segments.filter((segment) => segment.verdict === "restrict");
  if (retained.length === 0) return null;
  return {
    label: retained.map((segment: ScopeSegment) => segment.label).join(", "),
    included: retained.map((segment) => `${segment.label} cases`),
    excluded: excluded.map((segment) => `${segment.label} cases`),
    jurisdictions: [...new Set(retained.map((segment) => segment.jurisdiction))],
    complexities: [...new Set(retained.map((segment) => segment.complexity))],
  };
}

export function deriveContinuityOptions(
  previousApprovedLevel: AutonomyLevel,
  candidateLevel: AutonomyLevel,
  scope: ScopeReport,
  recommendation: ContinuityRecommendation,
): ContinuityOption[] {
  const fence = validatedScope(scope);
  const narrowed = scope.unsafe.length > 0;
  const lower = previousLevel(previousApprovedLevel);

  const options: ContinuityOption[] = [
    {
      action: "continue-for-validated-scope",
      label: narrowed
        ? `Continue ${LEVEL_LABELS[previousApprovedLevel]} for the validated scope`
        : `Continue ${LEVEL_LABELS[previousApprovedLevel]}`,
      description: narrowed
        ? "Restore the previously approved level, but only where the changed configuration held up. The weaker segments fall outside it and route to a person."
        : "Restore the previously approved level, now that the changed configuration has been validated against it.",
      resulting_level: previousApprovedLevel,
      scope: fence,
      resolves_revalidation: true,
      recommended:
        recommendation === "restrict-scope" ||
        recommendation === "continue-previous-for-validated-scope",
      is_override: !(
        recommendation === "restrict-scope" ||
        recommendation === "continue-previous-for-validated-scope"
      ),
    },
    {
      action: "keep-in-shadow",
      label: `Keep the candidate at ${LEVEL_LABELS[candidateLevel]}`,
      description:
        "Do not restore previous autonomy yet. The changed configuration keeps running for evaluation while more evidence is collected across the full scope.",
      resulting_level: candidateLevel,
      scope: null,
      // The revalidation stays open, which is the point of choosing this.
      resolves_revalidation: false,
      recommended: recommendation === "continue-testing-in-shadow",
      is_override: recommendation !== "continue-testing-in-shadow",
    },
  ];

  if (lower && lower !== candidateLevel) {
    options.push({
      action: "lower-autonomy",
      label: `Continue at ${LEVEL_LABELS[lower]}`,
      description:
        "Restore a lower level than the one previously approved, and reassess from there.",
      resulting_level: lower,
      scope: fence,
      resolves_revalidation: true,
      recommended: recommendation === "lower-autonomy",
      is_override: recommendation !== "lower-autonomy",
    });
  }

  return options;
}
