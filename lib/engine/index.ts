/**
 * The deterministic policy engine.
 *
 * Pure by construction: no React, no network, no storage, no model output. If
 * both provider layers were deleted, every outcome below would be identical.
 * That property is asserted by `tests/engine/purity.test.ts`.
 */

export {
  deriveContinuityOptions,
  deriveContinuityRecommendation,
  validatedScope,
  type ContinuityAction,
  type ContinuityOption,
  type ContinuityRecommendation,
} from "./continuityOptions";
export { evaluateCriteria, type CriteriaReport, type CriterionResult } from "./criteria";
export {
  evaluateEligibility,
  type CheckStatus,
  type EligibilityCheck,
  type EligibilityReport,
} from "./eligibility";
export {
  isAtCeiling,
  isStructurallyPermittedLevel,
  levelIndex,
  nextLevel,
  previousLevel,
  stageFor,
  targetLevel,
} from "./levels";
export {
  admissibleRuns,
  computeStageMetrics,
  confirmedCriticalRunIds,
  type MetricsInput,
  type StageMetrics,
} from "./metrics";
export {
  BLOCKING_CODES,
  permitsPromotion,
  REASON_CODE_LABELS,
  REASON_CODES,
  type ReasonCode,
} from "./reasonCodes";
export {
  evaluateFromEvidence,
  evaluateTask,
  type EvaluationInput,
  type EvaluationResult,
  type EvidenceInput,
  type Recommendation,
} from "./recommend";
export {
  computeScopeReport,
  extractSegmentStats,
  scopeFromSegments,
  scopeReportFromStats,
  type ScopeReport,
  type ScopeSegment,
  type ScopeSegmentStats,
  type ScopeVerdict,
} from "./scope";
