import type { ApprovedScope, AutonomyLevel, DecisionOutcome, Task } from "@/lib/domain/types";
import { isStructurallyPermittedLevel, previousLevel } from "./levels";
import { REASON_CODES } from "./reasonCodes";
import type { EvaluationResult } from "./recommend";

/**
 * What a human may decide, given what the engine found.
 *
 * The system recommends; a person decides. But disagreeing with a recommendation
 * is not the same as suspending the product's structural rules, so three things
 * are enforced here rather than left to the interface:
 *
 *  - a decision may move at most one level, in either direction;
 *  - a decision may never exceed the task's ceiling;
 *  - a failed eligibility gate removes promotion entirely, for everyone.
 *
 * The third is the important one. An override is a disagreement about the
 * recommendation, which is reached only after the evidence has been judged
 * trustworthy. It is not a way to approve a promotion on evidence the product
 * has already said it cannot trust.
 */

export type DecisionAction = "approve-next" | "keep" | "restrict-scope" | "lower";

export interface DecisionOption {
  action: DecisionAction;
  label: string;
  description: string;
  /** What the task's level becomes if this option is recorded. */
  resulting_level: AutonomyLevel;
  outcome: DecisionOutcome;
  /** True when this is what the engine recommends. */
  recommended: boolean;
  /** True when choosing it means departing from the recommendation. */
  is_override: boolean;
  /** Narrowed fence applied by this option, where one applies. */
  scope: ApprovedScope | null;
}

/**
 * Outcomes where the evidence itself cannot be trusted.
 *
 * A stale evaluator, an unrevalidated configuration or an open blocking issue
 * all mean the measurements are unreliable, not merely unfavourable. Narrowing
 * scope stays available to a person, because reducing exposure is conservative
 * whatever the evidence says. What must not happen is the product proposing
 * *which* segments to keep, since that proposal would be derived from the very
 * evaluation it has just declared untrustworthy.
 */
const EVIDENCE_UNTRUSTWORTHY = new Set<string>([
  REASON_CODES.PAUSED_RULE_VERSION_MISMATCH,
  REASON_CODES.SANDBOX_REVALIDATION_REQUIRED,
  REASON_CODES.BLOCKED_OPEN_INCIDENT,
]);

const BLOCKED_CODES = new Set<string>([
  REASON_CODES.PAUSED_RULE_VERSION_MISMATCH,
  REASON_CODES.SANDBOX_REVALIDATION_REQUIRED,
  REASON_CODES.BLOCKED_OPEN_INCIDENT,
  REASON_CODES.BLOCKED_CRITICAL_ERROR,
  REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE,
  REASON_CODES.HOLD_EVIDENCE_COVERAGE,
]);

export function deriveDecisionOptions(
  result: EvaluationResult,
  task: Task,
): DecisionOption[] {
  const code = result.recommendation.code;
  const current = task.current_level;
  const target = result.target_level;
  const lower = previousLevel(current);

  const options: DecisionOption[] = [];

  // Promotion is offered only when the engine reached a promotion verdict at all,
  // which requires eligibility to have passed. A human may still decline it.
  const promotionAllowed =
    target !== null &&
    result.eligibility.eligible &&
    !BLOCKED_CODES.has(code) &&
    isStructurallyPermittedLevel(current, target, task.autonomy_ceiling);

  if (promotionAllowed && target) {
    const recommended = code === REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL;
    options.push({
      action: "approve-next",
      label: `Approve ${labelFor(target)}`,
      description: recommended
        ? "Record the recommended promotion for the scope below."
        : "Record a promotion despite the recommendation to remain at the current level.",
      resulting_level: target,
      outcome: "approved",
      recommended,
      is_override: !recommended,
      scope: result.recommendation.recommended_scope ?? task.approved_scope,
    });
  }

  const keepIsRecommended =
    code !== REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL &&
    code !== REASON_CODES.RESTRICT_SCOPE &&
    code !== REASON_CODES.ROLLBACK_RECOMMENDED;

  // The reason for keeping the level depends on why progression stopped.
  // Blaming missing evidence on a task paused by a version mismatch is simply
  // the wrong explanation.
  const blockedNow = BLOCKED_CODES.has(code);
  options.push({
    action: "keep",
    label: `Keep ${labelFor(current)}`,
    description: !keepIsRecommended
      ? "Decline the recommendation and continue at the current level."
      : blockedNow
        ? "Continue at the current level until the condition blocking evaluation is resolved."
        : "Continue at the current level while more evidence is collected.",
    resulting_level: current,
    outcome: keepIsRecommended ? "kept-current-level" : "recommendation-declined",
    recommended: keepIsRecommended,
    is_override: !keepIsRecommended,
    scope: task.approved_scope,
  });

  // Narrowing the fence is always available: it reduces exposure, so it needs no
  // eligibility gate. It keeps the level and changes only where it applies.
  const untrustworthy = EVIDENCE_UNTRUSTWORTHY.has(code);
  const narrowedScope = untrustworthy
    ? task.approved_scope
    : code === REASON_CODES.RESTRICT_SCOPE
      ? result.recommendation.recommended_scope
      : scopeFromCleanSegments(result);

  if (narrowedScope || untrustworthy) {
    const recommended = code === REASON_CODES.RESTRICT_SCOPE;
    options.push({
      action: "restrict-scope",
      label: "Restrict scope",
      description: untrustworthy
        ? "Narrow where this level applies, to reduce exposure while the blocking condition is resolved. The current evaluation cannot be trusted, so no segments are proposed: the narrower scope is yours to choose."
        : recommended
          ? "Keep the current level but narrow where it applies, so the weaker segments fall outside it."
          : "Keep the current level and narrow where it applies, reducing exposure while the task is reassessed.",
      resulting_level: current,
      outcome: "scope-restricted",
      recommended,
      is_override: !recommended,
      scope: narrowedScope,
    });
  }

  if (lower && isStructurallyPermittedLevel(current, lower, task.autonomy_ceiling)) {
    const recommended = code === REASON_CODES.ROLLBACK_RECOMMENDED;
    options.push({
      action: "lower",
      label: `Lower to ${labelFor(lower)}`,
      description: recommended
        ? "Reduce the approved level, as the recent evidence indicates."
        : "Reduce the approved level while the task is reassessed.",
      resulting_level: lower,
      outcome: "autonomy-lowered",
      recommended,
      is_override: !recommended,
      scope: task.approved_scope,
    });
  }

  return options;
}

/** The fence implied by the segments that are performing, where some are not. */
function scopeFromCleanSegments(result: EvaluationResult): ApprovedScope | null {
  const clean = result.scope.clean;
  const rest = result.scope.segments.filter((segment) => segment.verdict !== "eligible");
  if (clean.length === 0 || rest.length === 0) return null;
  return {
    label: clean.map((segment) => segment.label).join(", "),
    included: clean.map((segment) => `${segment.label} cases`),
    excluded: rest.map((segment) => `${segment.label} cases`),
    jurisdictions: [...new Set(clean.map((segment) => segment.jurisdiction))],
    complexities: [...new Set(clean.map((segment) => segment.complexity))],
  };
}

function labelFor(level: AutonomyLevel): string {
  const labels: Record<AutonomyLevel, string> = {
    shadow: "L1 · Shadow",
    assisted: "L2 · Assisted",
    supervised: "L3 · Supervised",
    constrained: "L4 · Constrained",
  };
  return labels[level];
}

/**
 * Last line of defence. Whatever an interface offers, a recorded level must
 * still satisfy the structural rules.
 */
export function isRecordableDecision(
  task: Task,
  result: EvaluationResult,
  finalLevel: AutonomyLevel,
): boolean {
  if (!isStructurallyPermittedLevel(task.current_level, finalLevel, task.autonomy_ceiling)) {
    return false;
  }
  const isPromotion =
    ["shadow", "assisted", "supervised", "constrained"].indexOf(finalLevel) >
    ["shadow", "assisted", "supervised", "constrained"].indexOf(task.current_level);
  if (!isPromotion) return true;
  return result.eligibility.eligible && !BLOCKED_CODES.has(result.recommendation.code);
}
