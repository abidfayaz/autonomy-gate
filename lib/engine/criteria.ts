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

/**
 * A criterion that cannot be measured.
 *
 * There are two quite different reasons for that, and conflating them would let
 * a mandatory requirement quietly stop blocking:
 *
 *  - The window genuinely contained no opportunity to observe the thing. No case
 *    called for escalation, so escalation quality cannot be judged. Reported as
 *    not applicable, and does not block.
 *  - The requirement was mandatory and the evidence is simply absent. A policy
 *    demanding 10% of completed cases be sampled is not satisfied by sampling
 *    none of them. That is a failure, and it blocks.
 */
type Measurability = "mandatory" | "observation-dependent";

function check(
  key: string,
  label: string,
  actual: number | null,
  requirement: number | undefined,
  comparator: Comparator,
  format: Format,
  unmeasurableReason?: string,
  measurability: Measurability = "mandatory",
): CriterionResult | null {
  if (requirement === undefined) return null;
  if (actual === null) {
    const optional = measurability === "observation-dependent";
    return {
      key,
      label,
      actual: null,
      requirement,
      comparator,
      format,
      passed: optional ? null : false,
      not_applicable_reason: optional
        ? (unmeasurableReason ?? "No opportunity to observe this in the current window")
        : (unmeasurableReason ?? "Required evidence for this criterion is absent"),
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
      "No completed cases were sampled, so the required sampling has not happened",
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
      "No completed cases were sampled, so no post-execution review has taken place",
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
      "No cases were reviewed, so reliance on the recommendation is unproven",
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
      // The only genuine no-opportunity case: nothing in the window required
      // escalating, so escalation quality could not be observed either way.
      "observation-dependent",
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
    // Only a criterion the window gave no opportunity to observe is excluded
    // from `failed`. A mandatory requirement with absent evidence is a failure.
    satisfied: failed.length === 0,
    additional,
  };
}
