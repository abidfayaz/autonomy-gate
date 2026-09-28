import type { StageCriteria, StageKey } from "@/lib/domain/types";
import type { StageMetrics } from "./metrics";

/**
 * Stage-specific autonomy criteria.
 *
 * Each stage gates on the evidence only that stage can produce, which is why the
 * criteria lists differ in kind rather than in strictness:
 *
 *  - Shadow to Assisted gates on correctness, because nobody is relying on the
 *    output yet and no acceptance or override evidence exists.
 *  - Assisted to Supervised gates on override and escalation behaviour, which
 *    only exist once a human is accepting or changing each recommendation.
 *  - Supervised to Constrained gates on what happens when nobody pre-approves:
 *    post-execution sampling, boundary violations, missed exceptions. Accuracy
 *    and override rate are informative here but are not criteria.
 */

export type Comparator = "gte" | "lte";
export type Format = "percent" | "count";

export interface CriterionResult {
  key: string;
  label: string;
  /** Null when the window contained no opportunity to measure this. */
  actual: number | null;
  requirement: number;
  comparator: Comparator;
  format: Format;
  /** Null means not applicable rather than passed or failed. */
  passed: boolean | null;
  not_applicable_reason?: string;
}

export interface CriteriaReport {
  stage: StageKey;
  criteria: CriterionResult[];
  /** Criteria that were measured and not met. */
  failed: CriterionResult[];
  /** True when nothing measurable was left unmet. */
  satisfied: boolean;
  /** Metrics worth showing that are deliberately not gating at this stage. */
  additional: CriterionResult[];
}

function check(
  key: string,
  label: string,
  actual: number | null,
  requirement: number | undefined,
  comparator: Comparator,
  format: Format,
  notApplicableReason?: string,
): CriterionResult | null {
  if (requirement === undefined) return null;
  if (actual === null) {
    return {
      key,
      label,
      actual: null,
      requirement,
      comparator,
      format,
      passed: null,
      not_applicable_reason: notApplicableReason ?? "Not measurable in this window",
    };
  }
  const passed = comparator === "gte" ? actual >= requirement : actual <= requirement;
  return { key, label, actual, requirement, comparator, format, passed };
}

function context(
  key: string,
  label: string,
  actual: number | null,
  format: Format,
): CriterionResult {
  return {
    key,
    label,
    actual,
    requirement: Number.NaN,
    comparator: "gte",
    format,
    passed: null,
    not_applicable_reason: "Shown for context. Not a criterion at this stage.",
  };
}

export function evaluateCriteria(
  stageKey: StageKey,
  stage: StageCriteria,
  metrics: StageMetrics,
): CriteriaReport {
  const criteria: CriterionResult[] = [];
  const additional: CriterionResult[] = [];

  const push = (result: CriterionResult | null) => {
    if (result) criteria.push(result);
  };

  push(
    check(
      "minimum-cases",
      stageKey === "supervised_to_constrained"
        ? "Minimum Supervised-mode cases"
        : stageKey === "assisted_to_supervised"
          ? "Minimum Assisted-mode cases"
          : "Minimum evaluated cases",
      metrics.valid_case_count,
      stage.minimum_cases,
      "gte",
      "count",
    ),
  );

  push(check("accuracy", "Accuracy", metrics.accuracy, stage.min_accuracy, "gte", "percent"));

  push(
    check(
      "sample-coverage",
      "Post-execution sample coverage",
      metrics.sample_coverage,
      stage.min_sample_coverage,
      "gte",
      "percent",
      "No completed cases were sampled in this window",
    ),
  );

  push(
    check(
      "sampled-error-rate",
      "Sampled post-execution error rate",
      metrics.sampled_error_rate,
      stage.max_sampled_error_rate,
      "lte",
      "percent",
      "No completed cases were sampled in this window",
    ),
  );

  push(
    check(
      "critical-errors",
      "Critical errors",
      metrics.critical_errors,
      stage.max_critical_errors,
      "lte",
      "count",
    ),
  );

  push(
    check(
      "boundary-violations",
      "Boundary violations",
      metrics.boundary_violations,
      stage.max_boundary_violations,
      "lte",
      "count",
    ),
  );

  push(
    check(
      "missed-critical-exceptions",
      "Missed critical exceptions",
      metrics.missed_critical_exceptions,
      stage.max_missed_critical_exceptions,
      "lte",
      "count",
    ),
  );

  push(
    check(
      "override-rate",
      "Human override rate",
      metrics.human_override_rate,
      stage.max_override_rate,
      "lte",
      "percent",
      "No reviewed cases in this window",
    ),
  );

  push(
    check(
      "correct-escalation",
      "Correct escalation handling",
      metrics.correct_escalation_rate,
      stage.min_correct_escalation_rate,
      "gte",
      "percent",
      "No escalation cases",
    ),
  );

  push(
    check(
      "confident-wrong",
      "Confident-but-wrong rate",
      metrics.confident_wrong_rate,
      stage.max_confident_wrong_rate,
      "lte",
      "percent",
    ),
  );

  push(
    check(
      "evidence-coverage",
      "Evidence coverage",
      metrics.evidence_coverage,
      stage.min_evidence_coverage,
      "gte",
      "percent",
    ),
  );

  // Context, never gating. Accuracy belongs here once a stage stops gating on it,
  // and acceptance is the complement of the override rate that does gate.
  if (stage.min_accuracy === undefined) {
    additional.push(context("accuracy-context", "Accuracy", metrics.accuracy, "percent"));
  }
  if (stage.max_override_rate === undefined && metrics.human_override_rate !== null) {
    additional.push(
      context("override-context", "Human override rate", metrics.human_override_rate, "percent"),
    );
  }
  if (metrics.human_acceptance_rate !== null) {
    additional.push(
      context(
        "acceptance-context",
        "Human acceptance rate",
        metrics.human_acceptance_rate,
        "percent",
      ),
    );
  }

  const failed = criteria.filter((criterion) => criterion.passed === false);

  return {
    stage: stageKey,
    criteria,
    failed,
    // A criterion with no opportunity to be measured is reported as not
    // applicable and does not block. It is shown as such rather than as a pass,
    // so an untested requirement never reads like a satisfied one.
    satisfied: failed.length === 0,
    additional,
  };
}
