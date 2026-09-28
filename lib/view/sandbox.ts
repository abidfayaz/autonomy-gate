import { buildEvaluationInput } from "@/lib/data/evaluation";
import {
  activePolicyForTask,
  getAgent,
  getTask,
  sandboxValidations,
} from "@/lib/data/seed";
import type { AutonomyLevel, SandboxCoverageGroup } from "@/lib/domain/types";
import { AUTONOMY_LABELS } from "@/lib/domain/vocabulary";
import {
  computeScopeReport,
  deriveContinuityOptions,
  deriveContinuityRecommendation,
  type ContinuityOption,
  type ContinuityRecommendation,
} from "@/lib/engine";
import { admissibleRuns } from "@/lib/engine/metrics";

/**
 * View model for Sandbox Revalidation.
 *
 * The screen has one job: show that a level a task already earned does not
 * carry over to a configuration that has changed, and put the decision about
 * whether it should in front of a person.
 */

export interface SandboxScopeRow {
  key: string;
  label: string;
  case_count: number;
  accuracy_display: string;
  confident_wrong_display: string;
  critical_errors: number;
  verdict_label: string;
  unsafe: boolean;
}

export interface SandboxView {
  sandbox_id: string;
  task_id: string;
  task_name: string;
  agent_name: string;

  opened_at: string;
  trigger: string;
  change_summary: string;
  change_impact: string;

  /** Recorded history. Never an entitlement. */
  previous_level: AutonomyLevel;
  previous_level_label: string;
  candidate_level: AutonomyLevel;
  candidate_level_label: string;
  candidate_rule_version: string;
  previous_rule_version: string;

  planned_case_count: number;
  evaluated_case_count: number;
  progress_percent: number;
  coverage_groups: SandboxCoverageGroup[];

  scope_rows: SandboxScopeRow[];
  recommendation: ContinuityRecommendation;
  recommendation_label: string;
  recommendation_detail: string;
  options: ContinuityOption[];

  policy_version: string;
  agent_version: string;
}

const RECOMMENDATION_LABELS: Record<ContinuityRecommendation, string> = {
  "continue-previous-for-validated-scope": "Continue previous autonomy",
  "continue-testing-in-shadow": "Continue testing in Shadow",
  "restrict-scope": "Restrict scope",
  "lower-autonomy": "Lower autonomy",
};

const formatPercent = (value: number): string => {
  const places = Math.abs(value) < 0.01 && value !== 0 ? 2 : 1;
  return `${(value * 100).toFixed(places)}%`;
};

export function buildSandboxView(): SandboxView | null {
  const record = sandboxValidations[0];
  if (!record) return null;

  const task = getTask(record.task_id);
  const policy = activePolicyForTask(record.task_id);
  const input = buildEvaluationInput(record.task_id);
  if (!task || !policy || !input) return null;

  const agent = getAgent(task.agent_id);

  // The candidate is judged against the stage it is actually in, which is the
  // stage a changed configuration always restarts from.
  const stageCriteria = policy.stages.shadow_to_assisted;
  const windowRuns = admissibleRuns(
    input.runs,
    record.sandbox_level,
    task.evidence_window_start,
  );
  const scope = computeScopeReport(
    windowRuns,
    input.cases,
    input.judgments,
    stageCriteria,
    policy.high_confidence_threshold,
  );

  const recommendation = deriveContinuityRecommendation(
    scope,
    record.evaluated_case_count,
    record.planned_case_count,
  );

  const options = deriveContinuityOptions(
    record.previous_level,
    record.sandbox_level,
    scope,
    recommendation,
  );

  const unsafeLabels = scope.unsafe.map((segment) => segment.label).join(", ");
  const retainedLabels = scope.segments
    .filter((segment) => segment.verdict !== "restrict")
    .map((segment) => segment.label)
    .join(", ");

  const detail =
    recommendation === "restrict-scope"
      ? `The changed configuration held up across ${retainedLabels}, but ${unsafeLabels} produced a confirmed critical error. Restoring the previous level only for the validated scope is recommended.`
      : recommendation === "continue-testing-in-shadow"
        ? "Validation is not complete and nothing yet argues for restoring previous autonomy. Continue evaluating the changed configuration."
        : recommendation === "lower-autonomy"
          ? "Every segment produced a confirmed critical error under the changed configuration. A lower level is recommended."
          : "The changed configuration has been validated across every segment, so the previously approved level may continue.";

  return {
    sandbox_id: record.sandbox_id,
    task_id: record.task_id,
    task_name: task.name,
    agent_name: agent?.name ?? "",

    opened_at: record.opened_at,
    trigger: record.trigger,
    change_summary: record.change_summary,
    change_impact: record.change_impact,

    previous_level: record.previous_level,
    previous_level_label: AUTONOMY_LABELS[record.previous_level].label,
    candidate_level: record.sandbox_level,
    candidate_level_label: AUTONOMY_LABELS[record.sandbox_level].label,
    candidate_rule_version: record.candidate_rule_version,
    previous_rule_version: record.previous_rule_version,

    planned_case_count: record.planned_case_count,
    evaluated_case_count: record.evaluated_case_count,
    progress_percent: Math.round(
      (record.evaluated_case_count / record.planned_case_count) * 100,
    ),
    coverage_groups: record.coverage_groups,

    scope_rows: scope.segments.map((segment) => ({
      key: segment.key,
      label: segment.label,
      case_count: segment.case_count,
      accuracy_display: formatPercent(segment.accuracy),
      confident_wrong_display: formatPercent(segment.confident_wrong_rate),
      critical_errors: segment.critical_errors,
      verdict_label:
        segment.verdict === "restrict"
          ? "Restrict"
          : segment.verdict === "eligible"
            ? "Stable"
            : "Review",
      unsafe: segment.verdict === "restrict",
    })),

    recommendation,
    recommendation_label: RECOMMENDATION_LABELS[recommendation],
    recommendation_detail: detail,
    options,

    policy_version: policy.version,
    agent_version: task.agent_version_id,
  };
}
