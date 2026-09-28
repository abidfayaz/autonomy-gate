import { REASON_CODES, type ReasonCode } from "@/lib/engine";

/**
 * Plain-language wording for a decision that has already been made.
 *
 * These templates are the product's actual explanation. The live layer added on
 * top only rephrases them: it receives the finished result and never the
 * evidence, so it cannot reach a different conclusion, and if it is unavailable
 * the screen reads exactly the same.
 *
 * Every reason code has an entry. A missing one would leave a decision
 * unexplained, which is worse than a plain one.
 */

export interface ExplanationInput {
  code: ReasonCode;
  /** The level under discussion, already formatted. */
  target_level_label: string | null;
  detail: Record<string, string | number | null>;
}

const formatPercent = (value: unknown): string => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  const places = Math.abs(numeric) < 0.01 && numeric !== 0 ? 2 : 1;
  return `${(numeric * 100).toFixed(places)}%`;
};

export function standardSummary(input: ExplanationInput): string {
  const { code, detail } = input;
  const target = input.target_level_label ?? "the next level";

  switch (code) {
    case REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL:
      return `Eligibility checks passed and every criterion for ${target} has been met on evidence from the current stage.`;

    case REASON_CODES.HOLD_CONFIDENT_WRONG_RATE:
      return `Eligibility checks have passed. However, the rate of high-confidence wrong answers (${formatPercent(
        detail.actual,
      )}) is still above the current requirement of ${formatPercent(
        detail.required_max,
      )} for ${target}.`;

    case REASON_CODES.REMAIN_AT_CURRENT_LEVEL:
      return `Eligibility checks have passed, but ${detail.unmet_criteria} criteria for ${target} have not yet been met.`;

    case REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE:
      return `There is not yet enough evidence from the current stage to assess progression. ${detail.valid_case_count} cases have been evaluated, and ${detail.minimum_cases} are required at this stage.`;

    case REASON_CODES.HOLD_EVIDENCE_COVERAGE:
      return "Required supporting evidence is missing too often for the task to be assessed fairly.";

    case REASON_CODES.PAUSED_RULE_VERSION_MISMATCH:
      return "Evaluation is paused because the task, the evaluator and the current rule set are not on the same version. Results cannot be trusted until they align.";

    case REASON_CODES.SANDBOX_REVALIDATION_REQUIRED:
      return "This configuration changed materially and has not been revalidated. Previous autonomy stays on the record but does not carry over until revalidation is complete.";

    case REASON_CODES.BLOCKED_OPEN_INCIDENT:
      return "An open blocking issue stops this task being assessed for progression.";

    case REASON_CODES.BLOCKED_CRITICAL_ERROR:
      return `Progression is blocked by ${detail.critical_errors} confirmed critical ${
        Number(detail.critical_errors) === 1 ? "error" : "errors"
      }.`;

    case REASON_CODES.RESTRICT_SCOPE:
      return `Confirmed critical errors are confined to ${detail.unsafe_segments}, while ${detail.retained_segments} remain clean. Narrowing the approved scope is recommended rather than holding the whole task back.`;

    case REASON_CODES.ROLLBACK_RECOMMENDED:
      return "Recent evidence indicates the level currently held is no longer appropriate across any segment.";

    case REASON_CODES.AT_AUTONOMY_CEILING:
      return "This task already holds the highest autonomy level it is permitted to reach, so there is no further progression to assess.";

    default:
      return "";
  }
}

/** Every code the templates must cover. Asserted by test. */
export const EXPLAINED_CODES: readonly ReasonCode[] = Object.values(REASON_CODES);
