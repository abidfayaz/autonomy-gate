import type {
  AgentRun,
  AutonomyMode,
  EvaluationCase,
  HumanReview,
  JevJudgment,
} from "@/lib/domain/types";

/**
 * Stage-scoped metric computation.
 *
 * The important property here is the filter, not the arithmetic. Evidence is
 * admissible only when it was produced in the mode the task is currently
 * operating in, and inside the current evidence window. That is what makes
 * "re-running the Shadow benchmark does not earn Supervised" a structural fact
 * rather than a rule someone has to remember to enforce.
 */

export interface StageMetrics {
  mode: AutonomyMode;
  valid_case_count: number;

  correct_count: number;
  accuracy: number;

  critical_errors: number;

  confident_wrong_count: number;
  confident_wrong_rate: number;

  evidence_required_count: number;
  evidence_present_count: number;
  evidence_coverage: number;

  reviewed_count: number;
  accepted_count: number;
  overridden_count: number;
  escalated_count: number;
  /** Null when nobody was relying on the output, as in Shadow. */
  human_acceptance_rate: number | null;
  human_override_rate: number | null;

  escalation_expected_count: number;
  correct_escalation_count: number;
  /** Null when no case in the window called for escalation. */
  correct_escalation_rate: number | null;

  sampled_count: number;
  /** Null outside modes where completed cases are sampled after execution. */
  sample_coverage: number | null;
  sampled_error_count: number;
  sampled_error_rate: number | null;

  boundary_violations: number;
  missed_critical_exceptions: number;

  /**
   * Share of consequential classifications still awaiting a human.
   * Surfaced for evaluator-maturity review. It does not gate autonomy: the PRD
   * is explicit that the guardrail changes nothing unless a policy encodes it,
   * and the prototype policies deliberately do not.
   */
  unresolved_classification_rate: number | null;
}

export interface MetricsInput {
  mode: AutonomyMode;
  evidenceWindowStart: string;
  highConfidenceThreshold: number;
  runs: readonly AgentRun[];
  reviews: readonly HumanReview[];
  cases: readonly EvaluationCase[];
  judgments: readonly JevJudgment[];
}

const rate = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : numerator / denominator;

/**
 * Admissible runs: produced in the stage's own mode, inside the current window.
 * A material change opens a new window, so pre-change evidence falls away here
 * rather than being filtered out by whoever happens to call this.
 */
export function admissibleRuns(
  runs: readonly AgentRun[],
  mode: AutonomyMode,
  evidenceWindowStart: string,
): AgentRun[] {
  return runs.filter(
    (run) => run.autonomy_mode === mode && run.occurred_at >= evidenceWindowStart,
  );
}

/**
 * A critical error counts when it is confirmed. A bounded classification only
 * contributes once a human has confirmed it as critical; an unconfirmed or
 * uncertain classification is not evidence and never silently becomes one.
 */
export function confirmedCriticalRunIds(
  runs: readonly AgentRun[],
  judgments: readonly JevJudgment[],
): Set<string> {
  const ids = new Set<string>();
  for (const run of runs) {
    if (run.critical_error) ids.add(run.run_id);
  }
  for (const judgment of judgments) {
    if (judgment.human_confirmed_result === "critical_error") ids.add(judgment.run_id);
  }
  return ids;
}

export function computeStageMetrics(input: MetricsInput): StageMetrics {
  const runs = admissibleRuns(input.runs, input.mode, input.evidenceWindowStart);
  const runIds = new Set(runs.map((run) => run.run_id));

  const caseById = new Map(input.cases.map((item) => [item.case_id, item]));
  const reviews = input.reviews.filter((review) => runIds.has(review.run_id));
  const judgments = input.judgments.filter((judgment) => runIds.has(judgment.run_id));

  const validCaseCount = runs.length;
  const correctCount = runs.filter((run) => run.correct).length;

  const criticalIds = confirmedCriticalRunIds(runs, judgments);

  const confidentWrongCount = runs.filter(
    (run) => !run.correct && run.confidence >= input.highConfidenceThreshold,
  ).length;

  const evidenceRequiredRuns = runs.filter(
    (run) => caseById.get(run.case_id)?.evidence_required ?? false,
  );
  const evidencePresentCount = evidenceRequiredRuns.filter((run) => run.evidence_present).length;

  const accepted = reviews.filter((review) => review.disposition === "accepted").length;
  const overridden = reviews.filter((review) => review.disposition === "overridden").length;
  const escalated = reviews.filter((review) => review.disposition === "escalated").length;
  const reviewedCount = reviews.length;

  const escalatedRunIds = new Set(
    reviews.filter((review) => review.disposition === "escalated").map((review) => review.run_id),
  );
  const escalationExpected = runs.filter((run) => run.escalation_expected);
  const correctEscalations = escalationExpected.filter((run) =>
    escalatedRunIds.has(run.run_id),
  ).length;

  const sampled = runs.filter((run) => run.post_execution_sampled);
  const sampledErrors = sampled.filter((run) => run.post_execution_error).length;

  const consequentialJudgments = judgments.filter(
    (judgment) => judgment.requires_human_confirmation,
  );
  const unresolvedJudgments = consequentialJudgments.filter(
    (judgment) => judgment.human_confirmed_result === null,
  ).length;

  return {
    mode: input.mode,
    valid_case_count: validCaseCount,

    correct_count: correctCount,
    accuracy: rate(correctCount, validCaseCount),

    critical_errors: criticalIds.size,

    confident_wrong_count: confidentWrongCount,
    confident_wrong_rate: rate(confidentWrongCount, validCaseCount),

    evidence_required_count: evidenceRequiredRuns.length,
    evidence_present_count: evidencePresentCount,
    evidence_coverage: rate(evidencePresentCount, evidenceRequiredRuns.length),

    reviewed_count: reviewedCount,
    accepted_count: accepted,
    overridden_count: overridden,
    escalated_count: escalated,
    // Acceptance and override are shares of reviewed cases. Escalation is a third
    // disposition, so the three sum to the reviewed total and a correct escalation
    // is never counted as an override.
    human_acceptance_rate: reviewedCount === 0 ? null : rate(accepted, reviewedCount),
    human_override_rate: reviewedCount === 0 ? null : rate(overridden, reviewedCount),

    escalation_expected_count: escalationExpected.length,
    correct_escalation_count: correctEscalations,
    correct_escalation_rate:
      escalationExpected.length === 0 ? null : rate(correctEscalations, escalationExpected.length),

    sampled_count: sampled.length,
    sample_coverage: sampled.length === 0 ? null : rate(sampled.length, validCaseCount),
    sampled_error_count: sampledErrors,
    sampled_error_rate: sampled.length === 0 ? null : rate(sampledErrors, sampled.length),

    boundary_violations: runs.filter((run) => run.boundary_violation).length,
    missed_critical_exceptions: runs.filter((run) => run.missed_critical_exception).length,

    unresolved_classification_rate:
      consequentialJudgments.length === 0
        ? null
        : rate(unresolvedJudgments, consequentialJudgments.length),
  };
}
