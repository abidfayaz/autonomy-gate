/**
 * Domain model for Autonomy Gate.
 *
 * Two structural commitments from the PRD are encoded here rather than left to
 * convention, because the product's central claim depends on them:
 *
 *  - Autonomy belongs to a `Task`. No entity carries an agent-level autonomy level.
 *  - A `RulePack` is task-scoped, so different tasks of the same agent can sit on
 *    different rule families and versions, and a rule change only forces
 *    revalidation for the tasks that consume that pack.
 */

/* ---------------------------------------------------------------- vocabulary */

/** L1-L4. Operating modes, not scores: each one is proved by different evidence. */
export type AutonomyLevel = "shadow" | "assisted" | "supervised" | "constrained";

export const AUTONOMY_ORDER: readonly AutonomyLevel[] = [
  "shadow",
  "assisted",
  "supervised",
  "constrained",
];

/**
 * How the task is doing operationally. Deliberately separate from whether a
 * promotion is available: "eligible for promotion" is a recommendation, not a state.
 */
export type OperationalState = "healthy" | "needs-review" | "sandbox" | "paused";

/** The mode a run was executed under. Evidence from one mode never counts for another. */
export type AutonomyMode = AutonomyLevel;

export type Jurisdiction = "AU" | "NZ";
export type Complexity = "routine" | "complex";

/**
 * Three dispositions, not two. A correct escalation is not an override, so it must
 * not be counted as one.
 */
export type ReviewDisposition = "accepted" | "overridden" | "escalated";

/** Closed vocabulary for bounded error classification. */
export type ErrorClassification =
  | "no_error"
  | "minor_error"
  | "material_error"
  | "critical_error"
  | "uncertain";

/** Closed vocabulary for bounded complexity classification. */
export type ComplexityClassification = "routine" | "complex" | "uncertain";

/** Closed vocabulary for bounded evidence-state classification. */
export type EvidenceStateClassification =
  | "sufficient"
  | "incomplete"
  | "contradictory"
  | "unclear";

/** Named stage transitions. Progression is one level at a time. */
export type StageKey =
  | "shadow_to_assisted"
  | "assisted_to_supervised"
  | "supervised_to_constrained";

/* ------------------------------------------------------------------ entities */

export interface Agent {
  agent_id: string;
  name: string;
  description: string;
  icon: string;
}

/**
 * Scope is the operational boundary that is actually relevant to this task, which
 * is not the same set of dimensions for every task. Invoice extraction is fenced by
 * document legibility; tax treatment is fenced by jurisdiction and complexity.
 */
export interface ApprovedScope {
  label: string;
  included: string[];
  excluded: string[];
  jurisdictions?: Jurisdiction[];
  complexities?: Complexity[];
}

export interface Task {
  task_id: string;
  agent_id: string;
  name: string;
  description: string;
  /** The highest level this task may ever reach, regardless of evidence. */
  autonomy_ceiling: AutonomyLevel;
  current_level: AutonomyLevel;
  operational_state: OperationalState;
  /** Present once a level has been approved for a bounded scope. */
  approved_scope: ApprovedScope | null;
  rule_pack_id: string;
  /** Rule version the task itself is running against. */
  agent_rule_version: string;
  /** Rule version the evaluator is judging against. A mismatch pauses evaluation. */
  evaluator_rule_version: string;
  agent_version_id: string;
  policy_version_id: string;
  /** Set when a material change has not yet been revalidated in sandbox. */
  material_change_pending: boolean;
  /** Start of the current evidence window. Pre-change evidence is never mixed in. */
  evidence_window_start: string;
  /** Short operational note surfaced on Screen 1 where one applies. */
  state_note: string | null;
}

export interface AgentVersion {
  agent_version_id: string;
  agent_id: string;
  model_version: string;
  released_at: string;
}

export interface RulePack {
  rule_pack_id: string;
  task_id: string;
  name: string;
}

export interface RuleVersion {
  rule_version_id: string;
  rule_pack_id: string;
  version: string;
  effective_from: string;
  current: boolean;
}

export interface EvaluationCase {
  case_id: string;
  task_id: string;
  jurisdiction: Jurisdiction;
  complexity: Complexity;
  expected_result: string;
  /** Whether a miss on this case would be a critical exception. */
  critical_exception_expected: boolean;
  evidence_required: boolean;
}

export interface AgentRun {
  run_id: string;
  case_id: string;
  task_id: string;
  agent_version_id: string;
  autonomy_mode: AutonomyMode;
  agent_result: string;
  confidence: number;
  correct: boolean;
  evidence_present: boolean;
  agent_rule_version: string;
  occurred_at: string;
  /** Confirmed critical error, as classified and confirmed rather than assumed. */
  critical_error: boolean;
  /** Supervised mode only: this completed case was pulled into the review sample. */
  post_execution_sampled: boolean;
  /** Supervised mode only: the sampled review found an error. */
  post_execution_error: boolean;
  /** Acted outside the approved scope instead of escalating. */
  boundary_violation: boolean;
  /** An exception that should have been routed but was not. */
  missed_critical_exception: boolean;
  /** Whether this case in fact called for escalation. */
  escalation_expected: boolean;
}

export interface HumanReview {
  review_id: string;
  run_id: string;
  task_id: string;
  disposition: ReviewDisposition;
  /** True only when the substantive result changed. Cosmetic edits are acceptances. */
  changed_result: boolean;
  reviewer: string;
  note: string | null;
}

export interface JevJudgment {
  judgment_id: string;
  run_id: string;
  task_id: string;
  question_id: string;
  result: ErrorClassification;
  confidence: number;
  requires_human_confirmation: boolean;
  /** Null until a human resolves it. An unresolved judgment is not usable evidence. */
  human_confirmed_result: ErrorClassification | null;
  reviewer_note: string;
}

/** Thresholds for one stage transition. Every value is a configurable assumption. */
export interface StageCriteria {
  minimum_cases: number;
  max_critical_errors: number;
  max_confident_wrong_rate: number;
  min_evidence_coverage: number;
  min_accuracy?: number;
  max_override_rate?: number;
  min_correct_escalation_rate?: number;
  min_sample_coverage?: number;
  max_sampled_error_rate?: number;
  max_boundary_violations?: number;
  max_missed_critical_exceptions?: number;
}

export interface PolicyVersion {
  policy_version_id: string;
  task_id: string;
  version: string;
  active: boolean;
  created_at: string;
  /** What changed relative to the previous version, for policy history. */
  change_note: string;
  /** Output at or above this confidence counts as confident for confident-but-wrong. */
  high_confidence_threshold: number;
  stages: Record<StageKey, StageCriteria>;
}

/** Evidence frozen at the moment a decision was recorded. Never recalculated. */
export interface MetricSnapshot {
  task_id: string;
  autonomy_mode: AutonomyMode;
  valid_case_count: number;
  accuracy: number;
  critical_errors: number;
  confident_wrong_rate: number;
  evidence_coverage: number;
  human_acceptance_rate: number | null;
  human_override_rate: number | null;
  correct_escalation_rate: number | null;
  sample_coverage: number | null;
  sampled_error_rate: number | null;
  boundary_violations: number | null;
  missed_critical_exceptions: number | null;
}

export type DecisionOutcome =
  | "approved"
  | "kept-current-level"
  | "scope-restricted"
  | "autonomy-lowered"
  | "recommendation-declined";

export interface AutonomyDecision {
  decision_id: string;
  task_id: string;
  decided_at: string;
  current_level: AutonomyLevel;
  recommended_level: AutonomyLevel | null;
  /** Reason code the engine produced at the time. */
  recommendation_code: string;
  final_level: AutonomyLevel;
  outcome: DecisionOutcome;
  /** True when the human chose something other than the recommendation. */
  was_override: boolean;
  scope: ApprovedScope | null;
  decided_by: string;
  reason: string;
  policy_version: string;
  agent_version: string;
  rule_version: string;
  evaluator_rule_version: string;
  snapshot: MetricSnapshot;
  /** Bounded classifications confirmed by a human that supported this decision. */
  confirmed_classifications: string[];
}

/** One declared coverage group in a revalidation. Groups overlap by design. */
export interface SandboxCoverageGroup {
  label: string;
  case_count: number;
  status: string;
}

export type SandboxRecommendation =
  | "continue-previous-for-validated-scope"
  | "continue-testing-in-shadow"
  | "restrict-scope"
  | "lower-autonomy";

export interface SandboxValidation {
  sandbox_id: string;
  task_id: string;
  opened_at: string;
  trigger: string;
  change_summary: string;
  change_impact: string;
  candidate_agent_version_id: string;
  candidate_rule_version: string;
  previous_rule_version: string;
  /** Historical state of the previously validated configuration. Not an entitlement. */
  previous_level: AutonomyLevel;
  /** A changed configuration always restarts here. */
  sandbox_level: AutonomyLevel;
  planned_case_count: number;
  evaluated_case_count: number;
  coverage_groups: SandboxCoverageGroup[];
  recommendation: SandboxRecommendation;
  human_decision: "pending" | "recorded";
}

export interface Incident {
  incident_id: string;
  task_id: string;
  type: string;
  status: "open" | "resolved";
  opened_at: string;
  summary: string;
  affected_case_count: number;
  /** Whether this incident blocks promotion assessment for the task. */
  blocking: boolean;
}

export type AuditEventType =
  | "autonomy-decision"
  | "policy-change"
  | "sandbox-revalidation"
  | "version-issue";

export interface AuditEvent {
  event_id: string;
  occurred_at: string;
  type: AuditEventType;
  task_id: string;
  summary: string;
  change_from: string;
  change_to: string;
  actor: string;
  status: string;
  decision_id: string | null;
  policy_version: string;
}

/** Everything the application reads. One canonical source for every screen. */
export interface SeedDataset {
  generated_at: string;
  seed: number;
  agents: Agent[];
  tasks: Task[];
  agent_versions: AgentVersion[];
  rule_packs: RulePack[];
  rule_versions: RuleVersion[];
  policy_versions: PolicyVersion[];
  cases: EvaluationCase[];
  runs: AgentRun[];
  reviews: HumanReview[];
  judgments: JevJudgment[];
  decisions: AutonomyDecision[];
  sandbox_validations: SandboxValidation[];
  incidents: Incident[];
  audit_events: AuditEvent[];
}
