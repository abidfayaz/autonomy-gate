import type {
  AgentRun,
  ApprovedScope,
  AutonomyLevel,
  EvaluationCase,
  HumanReview,
  Incident,
  JevJudgment,
  PolicyVersion,
  StageCriteria,
  StageKey,
  Task,
} from "@/lib/domain/types";
import { type CriteriaReport, evaluateCriteria } from "./criteria";
import { type EligibilityReport, evaluateEligibility } from "./eligibility";
import { isAtCeiling, stageFor, targetLevel } from "./levels";
import { admissibleRuns, computeStageMetrics, type StageMetrics } from "./metrics";
import { REASON_CODE_LABELS, REASON_CODES, type ReasonCode } from "./reasonCodes";
import {
  extractSegmentStats,
  scopeFromSegments,
  scopeReportFromStats,
  type ScopeReport,
  type ScopeSegmentStats,
} from "./scope";

/**
 * The deterministic gate.
 *
 * This function owns every autonomy outcome in the product. It is pure: same
 * inputs, same reason code, every time. It takes no model output, makes no
 * network call and reads no storage, so a provider outage cannot change what it
 * decides and a provider response cannot influence it.
 *
 * The branch order is the PRD's gate pseudocode. Order matters: a changed
 * configuration is questioned before stale versions, stale versions before thin
 * evidence, and thin evidence before anything measured from it.
 */

export interface Recommendation {
  code: ReasonCode;
  label: string;
  /** The level the engine recommends. Never more than one step, never past the ceiling. */
  recommended_level: AutonomyLevel | null;
  /** Present when the recommendation is to narrow the fence. */
  recommended_scope: ApprovedScope | null;
  /** Whether a human may record a promotion from this outcome at all. */
  promotion_available: boolean;
  /** Structured facts for the explanation layer. Never prose. */
  detail: Record<string, string | number | null>;
}

export interface EvaluationResult {
  task_id: string;
  current_level: AutonomyLevel;
  target_level: AutonomyLevel | null;
  stage: StageKey | null;
  at_ceiling: boolean;
  metrics: StageMetrics;
  eligibility: EligibilityReport;
  /** Null when eligibility blocked the assessment before criteria were reached. */
  criteria: CriteriaReport | null;
  scope: ScopeReport;
  recommendation: Recommendation;
}

export interface EvaluationInput {
  task: Task;
  policy: PolicyVersion;
  /** Version currently in force for this task's own rule pack. */
  currentRuleVersion: string;
  runs: readonly AgentRun[];
  reviews: readonly HumanReview[];
  cases: readonly EvaluationCase[];
  judgments: readonly JevJudgment[];
  openIncidents: readonly Incident[];
}

/**
 * Evidence already reduced to counts.
 *
 * The gate needs nothing more than this, which is what lets a policy change be
 * judged in a browser: the run records stay on the server, the same engine runs
 * in both places, and the outcome is identical either way.
 */
export interface EvidenceInput {
  task: Task;
  policy: PolicyVersion;
  currentRuleVersion: string;
  metrics: StageMetrics;
  segmentStats: readonly ScopeSegmentStats[];
  openIncidents: readonly Incident[];
}

export function evaluateTask(input: EvaluationInput): EvaluationResult {
  const { task, policy } = input;

  const metrics = computeStageMetrics({
    mode: task.current_level,
    evidenceWindowStart: task.evidence_window_start,
    highConfidenceThreshold: policy.high_confidence_threshold,
    runs: input.runs,
    reviews: input.reviews,
    cases: input.cases,
    judgments: input.judgments,
  });

  const windowRuns = admissibleRuns(input.runs, task.current_level, task.evidence_window_start);
  const segmentStats = extractSegmentStats(
    windowRuns,
    input.cases,
    input.judgments,
    policy.high_confidence_threshold,
  );

  return evaluateFromEvidence({
    task,
    policy,
    currentRuleVersion: input.currentRuleVersion,
    metrics,
    segmentStats,
    openIncidents: input.openIncidents,
  });
}

export function evaluateFromEvidence(input: EvidenceInput): EvaluationResult {
  const { task, policy, metrics, segmentStats } = input;

  const atCeiling = isAtCeiling(task.current_level, task.autonomy_ceiling);
  const stageKey = atCeiling ? null : stageFor(task.current_level);
  const stage: StageCriteria | null = stageKey ? policy.stages[stageKey] : null;
  const target = targetLevel(task.current_level, task.autonomy_ceiling);

  const scope = scopeReportFromStats(segmentStats, stage);

  const eligibility = evaluateEligibility({
    task,
    stage,
    metrics,
    currentRuleVersion: input.currentRuleVersion,
    openIncidents: input.openIncidents,
    atCeiling,
  });

  const recommendation = recommend({
    task,
    stageKey,
    stage,
    target,
    atCeiling,
    metrics,
    eligibility,
    scope,
  });

  // Criteria are evaluated only once the evidence is trustworthy enough to grade.
  const criteria =
    eligibility.eligible && stageKey && stage
      ? evaluateCriteria(stageKey, stage, metrics)
      : null;

  return {
    task_id: task.task_id,
    current_level: task.current_level,
    target_level: target,
    stage: stageKey,
    at_ceiling: atCeiling,
    metrics,
    eligibility,
    criteria,
    scope,
    recommendation,
  };
}

interface RecommendArgs {
  task: Task;
  stageKey: StageKey | null;
  stage: StageCriteria | null;
  target: AutonomyLevel | null;
  atCeiling: boolean;
  metrics: StageMetrics;
  eligibility: EligibilityReport;
  scope: ScopeReport;
}

function recommend(args: RecommendArgs): Recommendation {
  const { task, stageKey, stage, target, atCeiling, metrics, eligibility, scope } = args;

  const build = (
    code: ReasonCode,
    level: AutonomyLevel | null,
    detail: Record<string, string | number | null>,
    recommendedScope: ApprovedScope | null = null,
  ): Recommendation => ({
    code,
    label: REASON_CODE_LABELS[code],
    recommended_level: level,
    recommended_scope: recommendedScope,
    promotion_available: code === REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL,
    detail: {
      current_level: task.current_level,
      target_level: target,
      ...detail,
    },
  });

  // A confirmed critical error confined to some segments argues for a narrower
  // fence; spread across all of them it argues for stopping, and above Shadow it
  // puts the level already held in question.
  const criticalBlocking =
    eligibility.blocking?.code === REASON_CODES.BLOCKED_CRITICAL_ERROR &&
    eligibility.blocking.key === "no-blocking-issue";

  if (criticalBlocking && scope.unsafe.length > 0 && scope.unsafe.length < scope.segments.length) {
    const retained = scope.segments.filter((segment) => segment.verdict !== "restrict");
    return build(
      REASON_CODES.RESTRICT_SCOPE,
      task.current_level,
      {
        critical_errors: metrics.critical_errors,
        unsafe_segments: scope.unsafe.map((segment) => segment.label).join(", "),
        retained_segments: retained.map((segment) => segment.label).join(", "),
      },
      scopeFromSegments(retained, scope.unsafe),
    );
  }

  if (
    criticalBlocking &&
    scope.segments.length > 0 &&
    scope.unsafe.length === scope.segments.length &&
    task.current_level !== "shadow"
  ) {
    return build(REASON_CODES.ROLLBACK_RECOMMENDED, previousOf(task.current_level), {
      critical_errors: metrics.critical_errors,
      unsafe_segments: scope.unsafe.map((segment) => segment.label).join(", "),
    });
  }

  if (eligibility.blocking) {
    return build(eligibility.blocking.code ?? REASON_CODES.REMAIN_AT_CURRENT_LEVEL, null, {
      blocking_check: eligibility.blocking.key,
      blocking_detail: eligibility.blocking.detail,
      valid_case_count: metrics.valid_case_count,
      minimum_cases: stage?.minimum_cases ?? null,
    });
  }

  if (atCeiling || stageKey === null || stage === null || target === null) {
    return build(REASON_CODES.AT_AUTONOMY_CEILING, task.current_level, {
      ceiling: task.autonomy_ceiling,
    });
  }

  const criteria = evaluateCriteria(stageKey, stage, metrics);

  if (criteria.satisfied) {
    // Constrained is never granted without an explicit fence.
    const requiresScope = target === "constrained";
    const fence =
      requiresScope && scope.clean.length > 0 && scope.clean.length < scope.segments.length
        ? scopeFromSegments(
            scope.clean,
            scope.segments.filter((segment) => segment.verdict !== "eligible"),
          )
        : (task.approved_scope ?? null);

    return build(
      REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL,
      target,
      {
        satisfied_criteria: criteria.criteria.length,
        valid_case_count: metrics.valid_case_count,
      },
      fence,
    );
  }

  const confidentWrongFailed = criteria.failed.find(
    (criterion) => criterion.key === "confident-wrong",
  );

  if (confidentWrongFailed && criteria.failed.length === 1) {
    return build(REASON_CODES.HOLD_CONFIDENT_WRONG_RATE, task.current_level, {
      actual: confidentWrongFailed.actual,
      required_max: confidentWrongFailed.requirement,
      unmet_criteria: 1,
    });
  }

  return build(REASON_CODES.REMAIN_AT_CURRENT_LEVEL, task.current_level, {
    unmet_criteria: criteria.failed.length,
    first_unmet: criteria.failed[0]?.label ?? null,
  });
}

function previousOf(level: AutonomyLevel): AutonomyLevel | null {
  const order: AutonomyLevel[] = ["shadow", "assisted", "supervised", "constrained"];
  const index = order.indexOf(level);
  return index <= 0 ? null : (order[index - 1] ?? null);
}
