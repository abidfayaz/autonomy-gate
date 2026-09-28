import { buildEvaluationInput, reachableLevels } from "@/lib/data/evaluation";
import {
  activePolicyForTask,
  currentRuleVersionForTask,
  getAgent,
  policyHistoryForTask,
  rulePacks,
  tasks,
} from "@/lib/data/seed";
import type { AutonomyLevel, PolicyVersion, StageKey } from "@/lib/domain/types";
import { AUTONOMY_LABELS } from "@/lib/domain/vocabulary";
import {
  computeStageMetrics,
  extractSegmentStats,
  type ScopeSegmentStats,
  type StageMetrics,
} from "@/lib/engine";
import { admissibleRuns } from "@/lib/engine/metrics";

/**
 * View model for Policies & Versions.
 *
 * Policy configuration only. How a task is currently performing belongs on the
 * scorecard; mixing the two is what made the reference screens read as though a
 * threshold and a result were the same kind of thing.
 */

export interface TaskEvidence {
  metrics: StageMetrics;
  segmentStats: ScopeSegmentStats[];
}

export interface PolicyTaskRow {
  task_id: string;
  task_name: string;
  agent_name: string;
  level_label: string;
  policy_version: string;
  rule_status: "current" | "mismatch";
  rule_status_label: string;
  needs_attention: boolean;
}

export interface PolicyHistoryEntry {
  version: string;
  created_at: string;
  change_note: string;
  active: boolean;
}

export interface RuleVersionPanel {
  task_id: string;
  task_name: string;
  rule_pack_name: string;
  agent_rule_version: string;
  evaluator_rule_version: string;
  current_rule_version: string;
  aligned: boolean;
}

export interface PoliciesView {
  rows: PolicyTaskRow[];
  counts: {
    policies: number;
    aligned: number;
    needs_attention: number;
  };
  /** Seeded policy for each task, before any edit this visitor has made. */
  seeded_policies: Record<string, PolicyVersion>;
  history: Record<string, PolicyHistoryEntry[]>;
  rule_panels: Record<string, RuleVersionPanel>;
  /** Precomputed evidence per task and level, so a policy edit can be judged. */
  evidence: Record<string, Partial<Record<AutonomyLevel, TaskEvidence>>>;
  /** The same, as it stands if the outstanding classification is confirmed critical. */
  evidence_if_critical: Record<string, Partial<Record<AutonomyLevel, TaskEvidence>>>;
  task_levels: Record<string, AutonomyLevel>;
  task_names: Record<string, string>;
  default_task_id: string;
}

export const STAGE_LABELS: Record<StageKey, string> = {
  shadow_to_assisted: "Shadow to Assisted",
  assisted_to_supervised: "Assisted to Supervised",
  supervised_to_constrained: "Supervised to Constrained",
};

export const STAGE_ORDER: StageKey[] = [
  "shadow_to_assisted",
  "assisted_to_supervised",
  "supervised_to_constrained",
];

/**
 * Evidence reduced to counts, for one task at one level.
 *
 * Shipped to the browser in place of the run records so an edited policy can be
 * judged there by the same engine, without the evidence leaving the server.
 */
function buildEvidence(
  taskId: string,
  level: AutonomyLevel,
  confirmPendingAsCritical = false,
): TaskEvidence | null {
  const base = buildEvaluationInput(taskId, { current_level: level });
  if (!base) return null;

  // Only a confirmed critical classification changes what the gate computes, so
  // that is the single variant the browser needs in order to reflect a person
  // resolving one without the run records ever reaching it.
  const input = confirmPendingAsCritical
    ? {
        ...base,
        judgments: base.judgments.map((judgment) =>
          judgment.requires_human_confirmation && judgment.human_confirmed_result === null
            ? { ...judgment, human_confirmed_result: "critical_error" as const }
            : judgment,
        ),
      }
    : base;

  const metrics = computeStageMetrics({
    mode: level,
    evidenceWindowStart: input.task.evidence_window_start,
    highConfidenceThreshold: input.policy.high_confidence_threshold,
    runs: input.runs,
    reviews: input.reviews,
    cases: input.cases,
    judgments: input.judgments,
  });

  const windowRuns = admissibleRuns(input.runs, level, input.task.evidence_window_start);
  const segmentStats = extractSegmentStats(
    windowRuns,
    input.cases,
    input.judgments,
    input.policy.high_confidence_threshold,
  );

  return { metrics, segmentStats };
}

export function buildPoliciesView(): PoliciesView {
  const rows: PolicyTaskRow[] = [];
  const seededPolicies: Record<string, PolicyVersion> = {};
  const history: Record<string, PolicyHistoryEntry[]> = {};
  const rulePanels: Record<string, RuleVersionPanel> = {};
  const evidence: Record<string, Partial<Record<AutonomyLevel, TaskEvidence>>> = {};
  const evidenceIfCritical: Record<string, Partial<Record<AutonomyLevel, TaskEvidence>>> = {};
  const taskLevels: Record<string, AutonomyLevel> = {};
  const taskNames: Record<string, string> = {};

  for (const task of tasks) {
    const policy = activePolicyForTask(task.task_id);
    if (!policy) continue;

    const currentRule = currentRuleVersionForTask(task.task_id)?.version ?? "";
    const aligned =
      task.agent_rule_version === currentRule && task.evaluator_rule_version === currentRule;
    const pack = rulePacks.find((item) => item.task_id === task.task_id);

    seededPolicies[task.task_id] = policy;
    taskLevels[task.task_id] = task.current_level;
    taskNames[task.task_id] = task.name;

    rows.push({
      task_id: task.task_id,
      task_name: task.name,
      agent_name: getAgent(task.agent_id)?.name ?? "",
      level_label: AUTONOMY_LABELS[task.current_level].label,
      policy_version: `v${policy.version}`,
      rule_status: aligned ? "current" : "mismatch",
      rule_status_label: aligned ? "Current" : "Version mismatch",
      needs_attention: !aligned,
    });

    history[task.task_id] = policyHistoryForTask(task.task_id).map((item) => ({
      version: item.version,
      created_at: item.created_at,
      change_note: item.change_note,
      active: item.active,
    }));

    rulePanels[task.task_id] = {
      task_id: task.task_id,
      task_name: task.name,
      rule_pack_name: pack?.name ?? "",
      agent_rule_version: `v${task.agent_rule_version}`,
      evaluator_rule_version: `v${task.evaluator_rule_version}`,
      current_rule_version: `v${currentRule}`,
      aligned,
    };

    const byLevel: Partial<Record<AutonomyLevel, TaskEvidence>> = {};
    const byLevelIfCritical: Partial<Record<AutonomyLevel, TaskEvidence>> = {};
    for (const level of reachableLevels(task.task_id)) {
      const built = buildEvidence(task.task_id, level);
      if (built) byLevel[level] = built;
      const escalated = buildEvidence(task.task_id, level, true);
      if (escalated) byLevelIfCritical[level] = escalated;
    }
    evidence[task.task_id] = byLevel;
    evidenceIfCritical[task.task_id] = byLevelIfCritical;
  }

  return {
    rows,
    counts: {
      policies: rows.length,
      aligned: rows.filter((row) => row.rule_status === "current").length,
      needs_attention: rows.filter((row) => row.needs_attention).length,
    },
    seeded_policies: seededPolicies,
    history,
    rule_panels: rulePanels,
    evidence,
    evidence_if_critical: evidenceIfCritical,
    task_levels: taskLevels,
    task_names: taskNames,
    // Opens on the one task with real policy history, so the screen has
    // something true to show about versioning straight away.
    default_task_id: "routine-rule-application",
  };
}

/** Threshold fields a person may edit, in the order they are shown. */
export interface EditableField {
  key: string;
  label: string;
  stage: StageKey | "all";
  path: string;
  format: "percent" | "count";
  help: string;
}

export const EDITABLE_FIELDS: EditableField[] = [
  {
    key: "min-shadow",
    label: "Shadow to Assisted minimum cases",
    stage: "shadow_to_assisted",
    path: "minimum_cases",
    format: "count",
    help: "Evaluated cases required before Assisted can be considered.",
  },
  {
    key: "min-assisted",
    label: "Assisted to Supervised minimum cases",
    stage: "assisted_to_supervised",
    path: "minimum_cases",
    format: "count",
    help: "Assisted-mode cases required before Supervised can be considered.",
  },
  {
    key: "min-supervised",
    label: "Supervised to Constrained minimum cases",
    stage: "supervised_to_constrained",
    path: "minimum_cases",
    format: "count",
    help: "Supervised-mode cases required before Constrained can be considered.",
  },
  {
    key: "accuracy",
    label: "Accuracy requirement",
    stage: "shadow_to_assisted",
    path: "min_accuracy",
    format: "percent",
    help: "Applies while the task is proving correctness in Shadow.",
  },
  {
    key: "override",
    label: "Human override limit",
    stage: "assisted_to_supervised",
    path: "max_override_rate",
    format: "percent",
    help: "Applies once humans are reviewing each recommendation.",
  },
  {
    key: "confident-wrong",
    label: "Confident-but-wrong limit for Constrained",
    stage: "supervised_to_constrained",
    path: "max_confident_wrong_rate",
    format: "percent",
    help: "The strictest limit in the policy, because Constrained runs unsupervised.",
  },
  {
    key: "coverage",
    label: "Evidence coverage",
    stage: "all",
    path: "min_evidence_coverage",
    format: "percent",
    help: "Applies at every stage.",
  },
  {
    key: "critical",
    label: "Critical errors allowed",
    stage: "all",
    path: "max_critical_errors",
    format: "count",
    help: "Applies at every stage.",
  },
];
