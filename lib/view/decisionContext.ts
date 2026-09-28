import { evaluateSeededTask, reachableLevels } from "@/lib/data/evaluation";
import {
  activePolicyForTask,
  decisions as seededDecisions,
  getAgent,
  getTask,
  judgmentsForTask,
  tasksForAgent,
} from "@/lib/data/seed";
import type { ApprovedScope, AutonomyLevel, MetricSnapshot } from "@/lib/domain/types";
import { AUTONOMY_DESCRIPTIONS, AUTONOMY_LABELS } from "@/lib/domain/vocabulary";
import { deriveDecisionOptions, type DecisionOption } from "@/lib/engine/decisionOptions";
import { buildScorecardView } from "@/lib/view/taskScorecard";

/**
 * Everything the decision screen needs, precomputed per level.
 *
 * Like the scorecard, this is computed on the server for every level the task
 * could hold, so a visitor who records a decision sees the next one framed
 * correctly without the evidence ever reaching their browser.
 */

export interface DecisionBasisRow {
  label: string;
  value: string;
  passed: boolean | null;
}

export interface DecisionContext {
  level: AutonomyLevel;
  current_level_label: string;
  current_level_description: string;

  recommendation_headline: string;
  recommendation_summary: string;
  recommendation_code: string;
  recommended_level: AutonomyLevel | null;
  target_level_label: string | null;
  promotion_available: boolean;
  blocked: boolean;
  /** Why promotion is unavailable, where it is. */
  blocked_reason: string | null;

  options: DecisionOption[];

  scope: {
    label: string;
    included: string[];
    excluded: string[];
  };

  eligibility_rows: DecisionBasisRow[];
  criteria_rows: DecisionBasisRow[];

  /** Frozen with the decision if one is recorded from this context. */
  snapshot: MetricSnapshot;
  policy_version: string;
  agent_version: string;
  rule_version: string;
  evaluator_rule_version: string;
  confirmed_classifications: string[];
}

export interface DecisionPageData {
  task_id: string;
  task_name: string;
  task_description: string;
  agent_name: string;
  autonomy_ceiling_label: string;
  /** Other tasks of the same agent, to make the decision's boundary explicit. */
  sibling_task_names: string[];
  previous_decision: {
    decided_at: string;
    from_label: string;
    to_label: string;
    reason: string;
    decided_by: string;
  } | null;
  contexts: Partial<Record<AutonomyLevel, DecisionContext>>;
  seeded_level: AutonomyLevel;
  /** Same sentence the scorecard shows, so the two screens agree. */
  level_provenance: string;
}

const formatPercent = (value: number): string => {
  const places = Math.abs(value) < 0.01 && value !== 0 ? 2 : 1;
  return `${(value * 100).toFixed(places)}%`;
};

function buildContext(taskId: string, level: AutonomyLevel): DecisionContext | null {
  const seeded = getTask(taskId);
  const policy = activePolicyForTask(taskId);
  if (!seeded || !policy) return null;

  const task = { ...seeded, current_level: level };
  const result = evaluateSeededTask(taskId, { current_level: level });
  if (!result) return null;

  const options = deriveDecisionOptions(result, task);

  const scope: ApprovedScope | null =
    result.recommendation.recommended_scope ?? seeded.approved_scope;

  const confirmed = judgmentsForTask(taskId)
    .filter((judgment) => judgment.human_confirmed_result !== null)
    .map(
      (judgment) =>
        `Reviewer note classified as ${String(judgment.human_confirmed_result).replace("_", " ")}, confirmed by Maya`,
    );

  const blockedReason = result.eligibility.blocking
    ? result.eligibility.blocking.detail
    : null;

  return {
    level,
    current_level_label: AUTONOMY_LABELS[level].label,
    current_level_description: AUTONOMY_DESCRIPTIONS[level],

    recommendation_headline: result.recommendation.label,
    recommendation_summary: summaryFor(result.recommendation.code),
    recommendation_code: result.recommendation.code,
    recommended_level: result.recommendation.recommended_level,
    target_level_label: result.target_level
      ? AUTONOMY_LABELS[result.target_level].label
      : null,
    promotion_available: result.recommendation.promotion_available,
    blocked: !result.eligibility.eligible,
    blocked_reason: blockedReason,

    options,

    scope: {
      label: scope?.label ?? "This task only",
      included: scope?.included ?? ["All cases currently handled by this task"],
      excluded: scope?.excluded ?? [],
    },

    eligibility_rows: result.eligibility.checks.map((check) => ({
      label: check.label,
      value: check.status === "none" ? "None" : check.status === "pass" ? "Pass" : "Not met",
      passed: check.status === "fail" ? false : check.status === "not-applicable" ? null : true,
    })),

    // The result word is carried in the text, not only in the colour. Colour
    // alone left the one failing criterion reading exactly like the seven that
    // passed, which is the question this panel exists to answer.
    criteria_rows: (result.criteria?.criteria ?? []).map((criterion) => {
      const comparison =
        criterion.actual === null
          ? "Not applicable"
          : criterion.format === "percent"
            ? `${formatPercent(criterion.actual)} vs ${
                criterion.comparator === "gte" ? "≥" : "≤"
              } ${formatPercent(criterion.requirement)}`
            : `${criterion.actual} vs ${criterion.comparator === "gte" ? "≥" : "≤"} ${criterion.requirement}`;
      const verdict =
        criterion.passed === null ? "" : criterion.passed ? " · Pass" : " · Not met";
      return { label: criterion.label, value: `${comparison}${verdict}`, passed: criterion.passed };
    }),

    snapshot: {
      task_id: taskId,
      autonomy_mode: level,
      valid_case_count: result.metrics.valid_case_count,
      accuracy: result.metrics.accuracy,
      critical_errors: result.metrics.critical_errors,
      confident_wrong_rate: result.metrics.confident_wrong_rate,
      evidence_coverage: result.metrics.evidence_coverage,
      human_acceptance_rate: result.metrics.human_acceptance_rate,
      human_override_rate: result.metrics.human_override_rate,
      correct_escalation_rate: result.metrics.correct_escalation_rate,
      sample_coverage: result.metrics.sample_coverage,
      sampled_error_rate: result.metrics.sampled_error_rate,
      boundary_violations: result.metrics.boundary_violations,
      missed_critical_exceptions: result.metrics.missed_critical_exceptions,
    },
    policy_version: policy.version,
    agent_version: seeded.agent_version_id,
    rule_version: seeded.agent_rule_version,
    evaluator_rule_version: seeded.evaluator_rule_version,
    confirmed_classifications: confirmed,
  };
}

function summaryFor(code: string): string {
  switch (code) {
    case "ELIGIBLE_FOR_NEXT_LEVEL":
      return "Eligibility checks passed and every criterion for the next level has been met.";
    case "HOLD_CONFIDENT_WRONG_RATE":
      return "Eligibility checks passed, but the rate of high-confidence wrong answers is still above the requirement for the next level.";
    case "REMAIN_AT_CURRENT_LEVEL":
      return "Eligibility checks passed, but not every criterion for the next level has been met.";
    case "HOLD_INSUFFICIENT_STAGE_EVIDENCE":
      return "There is not yet enough evidence from the current stage to assess progression.";
    case "PAUSED_RULE_VERSION_MISMATCH":
      return "Evaluation is paused because the task, the evaluator and the current rule set are not on the same version.";
    case "SANDBOX_REVALIDATION_REQUIRED":
      return "This configuration changed materially and must be revalidated before previous autonomy can continue.";
    case "RESTRICT_SCOPE":
      return "Confirmed critical errors are confined to part of the scope, so narrowing the fence is recommended.";
    case "ROLLBACK_RECOMMENDED":
      return "Recent evidence indicates the level currently held is no longer appropriate.";
    case "AT_AUTONOMY_CEILING":
      return "This task already holds the highest autonomy level it is permitted to reach.";
    default:
      return "Review the evidence below before recording a decision.";
  }
}

export function buildDecisionPageData(taskId: string): DecisionPageData | null {
  const task = getTask(taskId);
  if (!task) return null;
  const agent = getAgent(task.agent_id);

  const contexts: Partial<Record<AutonomyLevel, DecisionContext>> = {};
  for (const level of reachableLevels(taskId)) {
    const context = buildContext(taskId, level);
    if (context) contexts[level] = context;
  }

  const priorForTask = seededDecisions.filter((decision) => decision.task_id === taskId);
  const previous = priorForTask[priorForTask.length - 1];

  return {
    task_id: task.task_id,
    task_name: task.name,
    task_description: task.description,
    agent_name: agent?.name ?? "",
    autonomy_ceiling_label: AUTONOMY_LABELS[task.autonomy_ceiling].label,
    // Named explicitly so the boundary of the decision is visible: approving
    // here changes nothing about the agent's other tasks.
    sibling_task_names: tasksForAgent(task.agent_id)
      .filter((sibling) => sibling.task_id !== task.task_id)
      .map((sibling) => sibling.name),
    previous_decision: previous
      ? {
          decided_at: previous.decided_at,
          from_label: AUTONOMY_LABELS[previous.current_level].label,
          to_label: AUTONOMY_LABELS[previous.final_level].label,
          reason: previous.reason,
          decided_by: previous.decided_by,
        }
      : null,
    contexts,
    seeded_level: task.current_level,
    level_provenance:
      buildScorecardView(taskId)?.level_provenance ??
      "Starting level. No promotion has been recorded for this task.",
  };
}
