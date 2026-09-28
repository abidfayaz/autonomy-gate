import type {
  AgentRun,
  ApprovedScope,
  Complexity,
  EvaluationCase,
  JevJudgment,
  Jurisdiction,
  StageCriteria,
} from "@/lib/domain/types";
import { confirmedCriticalRunIds } from "./metrics";

/**
 * Scope segmentation.
 *
 * An aggregate can look strong while one segment is unsafe, so performance is
 * broken down across the dimensions the prototype governs: jurisdiction and
 * complexity. This is what lets autonomy be approved for a narrower scope rather
 * than granted or withheld wholesale.
 */

export type ScopeVerdict = "eligible" | "remain" | "restrict";

export interface ScopeSegment {
  key: string;
  label: string;
  jurisdiction: Jurisdiction;
  complexity: Complexity;
  case_count: number;
  correct_count: number;
  accuracy: number;
  critical_errors: number;
  confident_wrong_count: number;
  confident_wrong_rate: number;
  boundary_violations: number;
  verdict: ScopeVerdict;
}

export interface ScopeReport {
  segments: ScopeSegment[];
  /** Segments with confirmed critical errors or boundary violations. */
  unsafe: ScopeSegment[];
  /** Segments meeting every per-segment threshold. */
  clean: ScopeSegment[];
}

const SEGMENTS: Array<{ jurisdiction: Jurisdiction; complexity: Complexity; label: string }> = [
  { jurisdiction: "NZ", complexity: "routine", label: "Routine NZ" },
  { jurisdiction: "AU", complexity: "routine", label: "Routine AU" },
  { jurisdiction: "NZ", complexity: "complex", label: "Complex NZ" },
  { jurisdiction: "AU", complexity: "complex", label: "Complex AU" },
];

/**
 * Per-segment counts, with nothing derived.
 *
 * Rates and verdicts depend on the active policy, so they are computed from
 * these rather than stored. That lets the same segments be judged against an
 * edited policy without the evidence leaving the server.
 */
export interface ScopeSegmentStats {
  key: string;
  label: string;
  jurisdiction: Jurisdiction;
  complexity: Complexity;
  case_count: number;
  correct_count: number;
  critical_errors: number;
  confident_wrong_count: number;
  boundary_violations: number;
}

export function extractSegmentStats(
  runs: readonly AgentRun[],
  cases: readonly EvaluationCase[],
  judgments: readonly JevJudgment[],
  highConfidenceThreshold: number,
): ScopeSegmentStats[] {
  const caseById = new Map(cases.map((item) => [item.case_id, item]));
  const criticalIds = confirmedCriticalRunIds(runs, judgments);
  const stats: ScopeSegmentStats[] = [];

  for (const definition of SEGMENTS) {
    const segmentRuns = runs.filter((run) => {
      const item = caseById.get(run.case_id);
      return (
        item?.jurisdiction === definition.jurisdiction &&
        item.complexity === definition.complexity
      );
    });
    if (segmentRuns.length === 0) continue;

    stats.push({
      key: `${definition.complexity}-${definition.jurisdiction.toLowerCase()}`,
      label: definition.label,
      jurisdiction: definition.jurisdiction,
      complexity: definition.complexity,
      case_count: segmentRuns.length,
      correct_count: segmentRuns.filter((run) => run.correct).length,
      critical_errors: segmentRuns.filter((run) => criticalIds.has(run.run_id)).length,
      confident_wrong_count: segmentRuns.filter(
        (run) => !run.correct && run.confidence >= highConfidenceThreshold,
      ).length,
      boundary_violations: segmentRuns.filter((run) => run.boundary_violation).length,
    });
  }

  return stats;
}

/** Judges precomputed segments against a policy stage. */
export function scopeReportFromStats(
  stats: readonly ScopeSegmentStats[],
  stage: StageCriteria | null,
): ScopeReport {
  const segments: ScopeSegment[] = stats.map((stat) => {
    const accuracy = stat.correct_count / stat.case_count;
    const confidentWrongRate = stat.confident_wrong_count / stat.case_count;

    let verdict: ScopeVerdict;
    if (stat.critical_errors > (stage?.max_critical_errors ?? 0) || stat.boundary_violations > 0) {
      // An unsafe segment is the case for narrowing the fence, not for holding
      // the whole task back.
      verdict = "restrict";
    } else if (stage === null) {
      verdict = "remain";
    } else {
      const accuracyOk =
        stage.min_accuracy === undefined ? true : accuracy >= stage.min_accuracy;
      const confidentWrongOk = confidentWrongRate <= stage.max_confident_wrong_rate;
      verdict = accuracyOk && confidentWrongOk ? "eligible" : "remain";
    }

    return {
      key: stat.key,
      label: stat.label,
      jurisdiction: stat.jurisdiction,
      complexity: stat.complexity,
      case_count: stat.case_count,
      correct_count: stat.correct_count,
      accuracy,
      critical_errors: stat.critical_errors,
      confident_wrong_count: stat.confident_wrong_count,
      confident_wrong_rate: confidentWrongRate,
      boundary_violations: stat.boundary_violations,
      verdict,
    };
  });

  return {
    segments,
    unsafe: segments.filter((segment) => segment.verdict === "restrict"),
    clean: segments.filter((segment) => segment.verdict === "eligible"),
  };
}

export function computeScopeReport(
  runs: readonly AgentRun[],
  cases: readonly EvaluationCase[],
  judgments: readonly JevJudgment[],
  stage: StageCriteria | null,
  highConfidenceThreshold: number,
): ScopeReport {
  return scopeReportFromStats(
    extractSegmentStats(runs, cases, judgments, highConfidenceThreshold),
    stage,
  );
}

/** Builds the narrowed fence implied by the segments that are not unsafe. */
export function scopeFromSegments(segments: ScopeSegment[], excluded: ScopeSegment[]): ApprovedScope {
  const jurisdictions = [...new Set(segments.map((segment) => segment.jurisdiction))];
  const complexities = [...new Set(segments.map((segment) => segment.complexity))];
  return {
    label: segments.map((segment) => segment.label).join(", "),
    included: segments.map((segment) => `${segment.label} cases`),
    excluded: excluded.map((segment) => `${segment.label} cases`),
    jurisdictions,
    complexities,
  };
}
