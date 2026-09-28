/**
 * Every recommendation the engine can produce.
 *
 * A reason code is the engine's whole output. It carries no prose: the wording a
 * person reads is derived from the code downstream, so an explanation can never
 * change an outcome, and a missing explanation can never hide one.
 */
export const REASON_CODES = {
  /** The stage criteria are met and the next level may be recommended. */
  ELIGIBLE_FOR_NEXT_LEVEL: "ELIGIBLE_FOR_NEXT_LEVEL",
  /** Criteria evaluated, at least one unmet, nothing unsafe. */
  REMAIN_AT_CURRENT_LEVEL: "REMAIN_AT_CURRENT_LEVEL",
  /** Named separately because it is the most common single reason to hold. */
  HOLD_CONFIDENT_WRONG_RATE: "HOLD_CONFIDENT_WRONG_RATE",
  /** Not enough evidence from the current stage to assess progression at all. */
  HOLD_INSUFFICIENT_STAGE_EVIDENCE: "HOLD_INSUFFICIENT_STAGE_EVIDENCE",
  /** Required supporting evidence is missing too often to judge the task fairly. */
  HOLD_EVIDENCE_COVERAGE: "HOLD_EVIDENCE_COVERAGE",
  /** Confirmed critical errors across every segment. */
  BLOCKED_CRITICAL_ERROR: "BLOCKED_CRITICAL_ERROR",
  /** Confirmed critical errors confined to some segments, with others clean. */
  RESTRICT_SCOPE: "RESTRICT_SCOPE",
  /** Evidence indicates the level already held is no longer appropriate. */
  ROLLBACK_RECOMMENDED: "ROLLBACK_RECOMMENDED",
  /** Agent, evaluator and current rule versions disagree. */
  PAUSED_RULE_VERSION_MISMATCH: "PAUSED_RULE_VERSION_MISMATCH",
  /** A material change has not yet been revalidated in sandbox. */
  SANDBOX_REVALIDATION_REQUIRED: "SANDBOX_REVALIDATION_REQUIRED",
  /** An open blocking issue stops the assessment before criteria are considered. */
  BLOCKED_OPEN_INCIDENT: "BLOCKED_OPEN_INCIDENT",
  /** The task already holds the highest level it is permitted to reach. */
  AT_AUTONOMY_CEILING: "AT_AUTONOMY_CEILING",
} as const;

export type ReasonCode = (typeof REASON_CODES)[keyof typeof REASON_CODES];

/**
 * The short recommendation phrase for each code, from the approved vocabulary.
 * These are the only words the product uses to name an outcome.
 */
export const REASON_CODE_LABELS: Record<ReasonCode, string> = {
  ELIGIBLE_FOR_NEXT_LEVEL: "Eligible for promotion",
  REMAIN_AT_CURRENT_LEVEL: "Remain at current level",
  HOLD_CONFIDENT_WRONG_RATE: "Remain at current level",
  HOLD_INSUFFICIENT_STAGE_EVIDENCE: "Remain at current level",
  HOLD_EVIDENCE_COVERAGE: "Remain at current level",
  BLOCKED_CRITICAL_ERROR: "Remain at current level",
  RESTRICT_SCOPE: "Restrict scope",
  ROLLBACK_RECOMMENDED: "Rollback recommended",
  PAUSED_RULE_VERSION_MISMATCH: "Evaluation paused",
  SANDBOX_REVALIDATION_REQUIRED: "Evaluation paused",
  BLOCKED_OPEN_INCIDENT: "Evaluation paused",
  AT_AUTONOMY_CEILING: "Remain at current level",
};

/** Codes that stop a promotion assessment before criteria are considered. */
export const BLOCKING_CODES: readonly ReasonCode[] = [
  REASON_CODES.SANDBOX_REVALIDATION_REQUIRED,
  REASON_CODES.PAUSED_RULE_VERSION_MISMATCH,
  REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE,
  REASON_CODES.BLOCKED_OPEN_INCIDENT,
  REASON_CODES.BLOCKED_CRITICAL_ERROR,
  REASON_CODES.HOLD_EVIDENCE_COVERAGE,
  REASON_CODES.RESTRICT_SCOPE,
];

/** Whether this outcome permits a human to approve the next level at all. */
export function permitsPromotion(code: ReasonCode): boolean {
  return code === REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL;
}
