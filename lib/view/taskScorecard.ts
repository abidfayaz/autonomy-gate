import { evaluateSeededTask } from "@/lib/data/evaluation";
import {
  activePolicyForTask,
  decisions as seededDecisions,
  currentRuleVersionForTask,
  getAgent,
  getTask,
  judgmentsForTask,
  rulePacks,
} from "@/lib/data/seed";
import type { ApprovedScope, AutonomyLevel, ErrorClassification } from "@/lib/domain/types";
import { AUTONOMY_DESCRIPTIONS, AUTONOMY_LABELS } from "@/lib/domain/vocabulary";
import type {
  CheckStatus,
  CriterionResult,
  EvaluationResult,
  ScopeVerdict,
} from "@/lib/engine";
import { REASON_CODES, type ReasonCode } from "@/lib/engine";
import { standardSummary } from "@/lib/explain/templates";

/**
 * View model for the Task Scorecard.
 *
 * Presentation only. Every figure comes from the engine result; this layer
 * decides how to say it, never what it says.
 */

export interface CheckRow {
  key: string;
  label: string;
  status: CheckStatus;
  status_label: string;
  detail: string;
}

export interface CriterionRow {
  key: string;
  label: string;
  actual_display: string;
  requirement_display: string;
  result: "pass" | "fail" | "not-applicable";
  result_label: string;
  note?: string;
}

export interface ScopeRow {
  key: string;
  label: string;
  case_count: number;
  accuracy_display: string;
  /** Shown because it drives the verdict; without it a row cannot be explained. */
  confident_wrong_display: string;
  critical_errors: number;
  verdict: ScopeVerdict | null;
  verdict_label: string;
}

export interface ClassificationView {
  reviewer_note: string;
  result_label: string;
  confidence_display: string;
  requires_confirmation: boolean;
  confirmed: boolean;
  status_label: string;
  status_detail: string;
}

export interface ScorecardView {
  task_id: string;
  task_name: string;
  task_description: string;
  agent_name: string;
  agent_icon: string;

  current_level: AutonomyLevel;
  current_level_label: string;
  current_level_description: string;
  /**
   * How the task reached this level. Without it a reader can see where a task is
   * and where it could go, but not how it got there.
   */
  level_provenance: string;

  recommendation: {
    code: ReasonCode;
    label: string;
    headline: string;
    /** One deterministic sentence derived from the reason code. */
    summary: string;
    target_level_label: string | null;
    promotion_available: boolean;
    blocked: boolean;
    unmet_count: number;
    /** The figures the wording refers to. Never evidence, only what is quoted. */
    detail: Record<string, string | number | null>;
  };

  eligibility: {
    eligible: boolean;
    checks: CheckRow[];
    result_line: string;
  };

  /** Null when eligibility stopped the assessment before criteria were reached. */
  criteria: {
    stage_label: string;
    evidence_label: string;
    rows: CriterionRow[];
    additional: CriterionRow[];
    result_line: string;
  } | null;

  /** Present when criteria were not assessed, explaining why. */
  criteria_blocked: { headline: string; detail: string } | null;

  scope_rows: ScopeRow[];
  classification: ClassificationView | null;

  configuration: {
    agent_version: string;
    policy_version: string;
    rule_pack_name: string;
    agent_rule_version: string;
    evaluator_rule_version: string;
    current_rule_version: string;
    aligned: boolean;
    status_label: string;
  };

  evidence_window_start: string;
  at_ceiling: boolean;
}

/**
 * Rates below one percent are shown to two decimals. At one decimal a limit of
 * 0.25% would display as 0.3%, which is a different number from the one the
 * policy actually holds.
 */
function formatPercent(value: number): string {
  const places = Math.abs(value) < 0.01 && value !== 0 ? 2 : 1;
  return `${(value * 100).toFixed(places)}%`;
}

function formatCriterionValue(value: number | null, format: "percent" | "count"): string {
  if (value === null) return "—";
  return format === "percent" ? formatPercent(value) : String(value);
}

function toCriterionRow(criterion: CriterionResult): CriterionRow {
  const comparator = criterion.comparator === "gte" ? "≥" : "≤";
  const result =
    criterion.passed === null ? "not-applicable" : criterion.passed ? "pass" : "fail";
  return {
    key: criterion.key,
    label: criterion.label,
    actual_display: formatCriterionValue(criterion.actual, criterion.format),
    requirement_display: Number.isNaN(criterion.requirement)
      ? "—"
      : `${comparator} ${formatCriterionValue(criterion.requirement, criterion.format)}`,
    result,
    result_label:
      result === "pass" ? "Pass" : result === "fail" ? "Needs improvement" : "Not applicable",
    ...(criterion.not_applicable_reason ? { note: criterion.not_applicable_reason } : {}),
  };
}

const CHECK_STATUS_LABELS: Record<CheckStatus, string> = {
  pass: "Pass",
  fail: "Not met",
  "not-applicable": "Not applicable",
  none: "None",
};

/**
 * Why a check blocked, phrased to complete "evaluation blocked because ...".
 * A check's own label states the condition that should hold, so appending it to
 * a failure reads as though it does.
 */
const BLOCKING_PHRASES: Record<string, string> = {
  "sandbox-revalidation": "the changed configuration has not been revalidated.",
  "rules-current": "the task, the evaluator and the current rule set are not on the same version.",
  "enough-cases": "there is not yet enough evidence at this stage.",
  "no-blocking-issue": "a blocking issue is open.",
  "evidence-available": "required supporting evidence is missing too often.",
  "no-safety-issue": "an unresolved safety issue is open.",
};

const STAGE_LABELS: Record<string, string> = {
  shadow_to_assisted: "Shadow to Assisted",
  assisted_to_supervised: "Assisted to Supervised",
  supervised_to_constrained: "Supervised to Constrained",
};

const EVIDENCE_LABELS: Record<AutonomyLevel, string> = {
  shadow: "Shadow-mode evidence",
  assisted: "Assisted-mode evidence",
  supervised: "Supervised-mode evidence",
  constrained: "Constrained-mode evidence",
};

const CLASSIFICATION_LABELS: Record<ErrorClassification, string> = {
  no_error: "No error",
  minor_error: "Minor error",
  material_error: "Material error",
  critical_error: "Critical error",
  uncertain: "Uncertain",
};

const VERDICT_LABELS: Record<ScopeVerdict, string> = {
  eligible: "Eligible for promotion",
  remain: "Remain at current level",
  restrict: "Restrict scope",
};

/**
 * One deterministic sentence per outcome.
 *
 * Phase 10 adds a live plain-language layer on top of this; the text below stays
 * as the fallback, so the screen reads the same whether or not that layer is
 * available and the outcome never depends on it.
 */
function headlineFor(code: ReasonCode, currentLevel: AutonomyLevel): string {
  switch (code) {
    case REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL:
      return "Eligible for promotion";
    case REASON_CODES.RESTRICT_SCOPE:
      return "Restrict scope";
    case REASON_CODES.ROLLBACK_RECOMMENDED:
      return "Rollback recommended";
    case REASON_CODES.PAUSED_RULE_VERSION_MISMATCH:
    case REASON_CODES.SANDBOX_REVALIDATION_REQUIRED:
    case REASON_CODES.BLOCKED_OPEN_INCIDENT:
      return "Evaluation paused";
    default:
      return `Remain ${AUTONOMY_LABELS[currentLevel].name}`;
  }
}

/**
 * The parts of a scorecard that do not depend on the policy.
 *
 * Gathered once on the server so the presentation below can be re-run in a
 * browser after a policy edit, against a result the engine recomputed there.
 */
export interface ScorecardMeta {
  task_id: string;
  task_name: string;
  task_description: string;
  agent_name: string;
  agent_icon: string;
  rule_pack_name: string;
  current_rule_version: string;
  agent_version_id: string;
  agent_rule_version: string;
  evaluator_rule_version: string;
  evidence_window_start: string;
  level_provenance: Partial<Record<AutonomyLevel, string>>;
  classification: ClassificationView | null;
  /** The judgment the classification panel acts on, when one is outstanding. */
  judgment_id: string | null;
  judgment_run_id: string | null;
}

export function buildScorecardMeta(taskId: string): ScorecardMeta | null {
  const task = getTask(taskId);
  if (!task) return null;

  const agent = getAgent(task.agent_id);
  const rulePack = rulePacks.find((pack) => pack.task_id === taskId);
  const currentRule = currentRuleVersionForTask(taskId)?.version ?? "";

  const priorDecisions = seededDecisions.filter((decision) => decision.task_id === taskId);

  /**
   * How the task reached a level.
   *
   * The most recent decision is not always the one that established it: a
   * revalidation can confirm a level without changing it, and rendering that as
   * "approved L3 to L3" says nothing. So the decision that actually moved the
   * task here is found first, and any later confirmation is added after it.
   */
  const provenanceFor = (level: AutonomyLevel): string => {
    const establishing = [...priorDecisions]
      .reverse()
      .find(
        (decision) =>
          decision.final_level === level && decision.current_level !== decision.final_level,
      );
    const latest = priorDecisions[priorDecisions.length - 1];
    const confirmation =
      latest && latest !== establishing && latest.final_level === level ? latest : undefined;

    if (establishing) {
      let text = `Approved on ${establishing.decided_at} by ${establishing.decided_by}, moving from ${
        AUTONOMY_LABELS[establishing.current_level].label
      } to ${AUTONOMY_LABELS[establishing.final_level].label}.`;
      if (confirmation) {
        text += ` Confirmed again on ${confirmation.decided_at}: ${confirmation.reason}`;
      }
      return text;
    }
    if (confirmation) {
      return `Confirmed on ${confirmation.decided_at} by ${confirmation.decided_by}. ${confirmation.reason}`;
    }
    return "Starting level. No promotion has been recorded for this task.";
  };

  const levels: AutonomyLevel[] = ["shadow", "assisted", "supervised", "constrained"];
  const levelProvenance: Partial<Record<AutonomyLevel, string>> = {};
  for (const level of levels) {
    levelProvenance[level] = provenanceFor(level);
  }

  // The most consequential classification a person still has to resolve, or the
  // most recently resolved one when nothing is outstanding.
  const taskJudgments = judgmentsForTask(taskId);
  const pending = taskJudgments.find(
    (judgment) => judgment.requires_human_confirmation && judgment.human_confirmed_result === null,
  );
  const judgment = pending ?? taskJudgments[taskJudgments.length - 1];

  const classification: ClassificationView | null = judgment
    ? {
        reviewer_note: judgment.reviewer_note,
        result_label: CLASSIFICATION_LABELS[judgment.human_confirmed_result ?? judgment.result],
        confidence_display: judgment.confidence.toFixed(2),
        requires_confirmation: judgment.requires_human_confirmation,
        confirmed: judgment.human_confirmed_result !== null,
        status_label:
          judgment.human_confirmed_result !== null ? "Confirmed" : "Awaiting confirmation",
        status_detail:
          judgment.human_confirmed_result !== null
            ? "Classification recorded for evaluation."
            : "This classification needs a person to confirm it before it counts as evidence.",
      }
    : null;

  return {
    task_id: task.task_id,
    task_name: task.name,
    task_description: task.description,
    agent_name: agent?.name ?? "",
    agent_icon: agent?.icon ?? "smart_toy",
    rule_pack_name: rulePack?.name ?? "",
    current_rule_version: currentRule,
    agent_version_id: task.agent_version_id,
    agent_rule_version: task.agent_rule_version,
    evaluator_rule_version: task.evaluator_rule_version,
    evidence_window_start: task.evidence_window_start,
    level_provenance: levelProvenance,
    classification,
    judgment_id: judgment?.judgment_id ?? null,
    judgment_run_id: judgment?.run_id ?? null,
  };
}

/**
 * Pure mapping from an engine result to what the screen shows.
 *
 * Takes no data of its own, so the server and the browser produce identical
 * output from identical input.
 */
export function scorecardFromResult(
  result: EvaluationResult,
  meta: ScorecardMeta,
  policyVersion: string,
): ScorecardView {
  const targetLabel = result.target_level ? AUTONOMY_LABELS[result.target_level].label : null;
  const code = result.recommendation.code;

  const checks: CheckRow[] = result.eligibility.checks.map((check) => ({
    key: check.key,
    label: check.label,
    status: check.status,
    status_label: CHECK_STATUS_LABELS[check.status],
    detail: check.detail,
  }));

  const criteria = result.criteria
    ? {
        stage_label: STAGE_LABELS[result.criteria.stage] ?? result.criteria.stage,
        evidence_label: EVIDENCE_LABELS[result.current_level],
        rows: result.criteria.criteria.map(toCriterionRow),
        additional: result.criteria.additional.map(toCriterionRow),
        result_line: result.criteria.satisfied
          ? "Every criterion for the next autonomy level has been met."
          : `${result.criteria.failed.length} ${
              result.criteria.failed.length === 1 ? "criterion is" : "criteria are"
            } not yet met.`,
      }
    : null;

  const blockingCheck = result.eligibility.blocking;
  const criteriaBlocked =
    criteria === null
      ? {
          headline: result.at_ceiling
            ? "No progression to assess"
            : "Autonomy criteria were not assessed",
          detail: result.at_ceiling
            ? "This task already holds the highest autonomy level it is permitted to reach."
            : `Eligibility did not pass, so the criteria below are not evaluated as a promotion assessment. ${
                blockingCheck?.detail ?? ""
              }`.trim(),
        }
      : null;

  const aligned =
    meta.agent_rule_version === meta.current_rule_version &&
    meta.evaluator_rule_version === meta.current_rule_version;

  return {
    task_id: meta.task_id,
    task_name: meta.task_name,
    task_description: meta.task_description,
    agent_name: meta.agent_name,
    agent_icon: meta.agent_icon,

    current_level: result.current_level,
    current_level_label: AUTONOMY_LABELS[result.current_level].label,
    current_level_description: AUTONOMY_DESCRIPTIONS[result.current_level],
    level_provenance:
      meta.level_provenance[result.current_level] ??
      "Starting level. No promotion has been recorded for this task.",

    recommendation: {
      code,
      label: result.recommendation.label,
      headline: headlineFor(code, result.current_level),
      summary: standardSummary({ code, detail: result.recommendation.detail, target_level_label: targetLabel }),
      target_level_label: targetLabel,
      promotion_available: result.recommendation.promotion_available,
      blocked: !result.eligibility.eligible,
      unmet_count: result.criteria?.failed.length ?? 0,
      detail: result.recommendation.detail,
    },

    eligibility: {
      eligible: result.eligibility.eligible,
      checks,
      result_line: result.eligibility.eligible
        ? "Result: eligible for autonomy evaluation."
        : `Result: evaluation blocked because ${
            BLOCKING_PHRASES[blockingCheck?.key ?? ""] ?? "an eligibility check did not pass."
          }`,
    },

    criteria,
    criteria_blocked: criteriaBlocked,

    /**
     * While eligibility is failing, promotional verdicts are withheld: a segment
     * cannot be eligible for promotion on a task that is not being assessed.
     *
     * An unsafe segment is different. A confirmed critical error is a fact about
     * safety rather than a judgement about promotion readiness, so it stays
     * visible however the evaluation is blocked.
     */
    scope_rows: result.scope.segments.map((segment) => {
      const showVerdict = result.eligibility.eligible || segment.verdict === "restrict";
      return {
        key: segment.key,
        label: segment.label,
        case_count: segment.case_count,
        accuracy_display: formatPercent(segment.accuracy),
        confident_wrong_display: formatPercent(segment.confident_wrong_rate),
        critical_errors: segment.critical_errors,
        verdict: showVerdict ? segment.verdict : null,
        verdict_label: showVerdict ? VERDICT_LABELS[segment.verdict] : "Not assessed",
      };
    }),

    classification: meta.classification,

    configuration: {
      agent_version: meta.agent_version_id,
      policy_version: `v${policyVersion}`,
      rule_pack_name: meta.rule_pack_name,
      agent_rule_version: `v${meta.agent_rule_version}`,
      evaluator_rule_version: `v${meta.evaluator_rule_version}`,
      current_rule_version: `v${meta.current_rule_version}`,
      aligned,
      status_label: aligned ? "Versions aligned" : "Version mismatch",
    },

    evidence_window_start: meta.evidence_window_start,
    at_ceiling: result.at_ceiling,
  };
}

export function buildScorecardView(
  taskId: string,
  levelOverride?: AutonomyLevel,
  scopeOverride?: ApprovedScope | null,
): ScorecardView | null {
  const seeded = getTask(taskId);
  const policy = activePolicyForTask(taskId);
  const meta = buildScorecardMeta(taskId);
  if (!seeded || !policy || !meta) return null;

  const result = evaluateSeededTask(taskId, {
    current_level: levelOverride ?? seeded.current_level,
    approved_scope: scopeOverride === undefined ? seeded.approved_scope : scopeOverride,
  });
  if (!result) return null;

  return scorecardFromResult(result, meta, policy.version);
}
