/**
 * Seeded intent for the synthetic dataset.
 *
 * Everything editorial lives here; `generate.ts` only expands it into records.
 * Counts are stated as integers, never as percentages: every percentage the UI
 * shows is computed from real records, so no displayed figure can drift from the
 * data behind it.
 *
 * The dataset exists to validate the governance system, not to simulate an
 * accounting business. Case detail is kept to what a screen actually renders.
 */

import type {
  ApprovedScope,
  AutonomyLevel,
  AutonomyMode,
  Complexity,
  Jurisdiction,
  OperationalState,
  StageCriteria,
  StageKey,
} from "../../lib/domain/types.js";

/** Anchor for the whole timeline. Every seeded record predates this. */
export const TODAY = "2026-09-27";
export const SEED = 20260927;
export const REVIEWER = "Maya";

/* -------------------------------------------------------- policy defaults */

/**
 * PRD prototype defaults. Configurable product assumptions, not standards.
 * Accuracy and override rate are absent from `supervised_to_constrained` on
 * purpose: at that stage they are context, not gating criteria.
 */
export const DEFAULT_STAGES: Record<StageKey, StageCriteria> = {
  shadow_to_assisted: {
    minimum_cases: 200,
    min_accuracy: 0.98,
    max_critical_errors: 0,
    max_confident_wrong_rate: 0.005,
    min_evidence_coverage: 0.98,
  },
  assisted_to_supervised: {
    minimum_cases: 200,
    max_critical_errors: 0,
    max_confident_wrong_rate: 0.005,
    min_evidence_coverage: 0.98,
    max_override_rate: 0.05,
    min_correct_escalation_rate: 0.95,
  },
  supervised_to_constrained: {
    minimum_cases: 300,
    max_critical_errors: 0,
    max_confident_wrong_rate: 0.0025,
    min_evidence_coverage: 0.98,
    min_sample_coverage: 0.1,
    max_sampled_error_rate: 0.01,
    max_boundary_violations: 0,
    max_missed_critical_exceptions: 0,
  },
};

export const HIGH_CONFIDENCE_THRESHOLD = 0.9;

/* ---------------------------------------------------------------- agents */

export const AGENT_SPECS = [
  {
    agent_id: "invoice-helper",
    name: "Invoice Helper",
    description:
      "Reads invoices, organizes them, matches transactions, and flags exceptions.",
    icon: "receipt_long",
  },
  {
    agent_id: "tax-helper",
    name: "Tax Helper",
    description:
      "Applies routine tax rules, identifies risk, drafts treatments, and checks filing readiness.",
    icon: "calculate",
  },
] as const;

export const AGENT_VERSION_SPECS = [
  {
    agent_version_id: "invoice-helper-v2",
    agent_id: "invoice-helper",
    model_version: "model-v2",
    released_at: "2026-04-28",
  },
  {
    agent_version_id: "tax-helper-v2",
    agent_id: "tax-helper",
    model_version: "model-v2",
    released_at: "2026-05-06",
  },
] as const;

/* ------------------------------------------------------------ rule packs */

/** Task-scoped. A version bump only affects the tasks consuming that pack. */
export const RULE_PACK_SPECS = [
  {
    rule_pack_id: "invoice-extraction-rules",
    task_id: "read-invoice-fields",
    name: "Invoice extraction rules",
    versions: [
      { version: "1.7", effective_from: "2026-02-10" },
      { version: "1.8", effective_from: "2026-05-11" },
    ],
  },
  {
    rule_pack_id: "expense-classification-rules",
    task_id: "classify-expense",
    name: "Expense classification rules",
    versions: [
      { version: "2.0", effective_from: "2026-01-19" },
      { version: "2.1", effective_from: "2026-06-01" },
    ],
  },
  {
    rule_pack_id: "ledger-match-rules",
    task_id: "match-invoice-to-ledger",
    name: "Ledger matching rules",
    versions: [
      { version: "1.3", effective_from: "2026-02-23" },
      { version: "1.4", effective_from: "2026-05-25" },
    ],
  },
  {
    rule_pack_id: "exception-detection-rules",
    task_id: "detect-invoice-exceptions",
    name: "Exception detection rules",
    versions: [
      { version: "1.9", effective_from: "2026-03-02" },
      { version: "2.0", effective_from: "2026-06-22" },
    ],
  },
  {
    rule_pack_id: "tax-routine-rules",
    task_id: "routine-rule-application",
    name: "Routine tax rules",
    versions: [
      { version: "3.0", effective_from: "2026-01-12" },
      { version: "3.1", effective_from: "2026-04-06" },
      { version: "3.2", effective_from: "2026-07-13" },
    ],
  },
  {
    rule_pack_id: "risk-detection-rules",
    task_id: "risk-detection",
    name: "Tax risk detection rules",
    versions: [
      { version: "1.1", effective_from: "2026-04-20" },
      { version: "1.2", effective_from: "2026-08-03" },
    ],
  },
  {
    rule_pack_id: "tax-position-rules",
    task_id: "draft-tax-position",
    name: "Tax position rules",
    versions: [
      { version: "2.3", effective_from: "2026-02-09" },
      { version: "2.4", effective_from: "2026-09-08" },
    ],
  },
  {
    rule_pack_id: "filing-readiness-rules",
    task_id: "filing-readiness",
    name: "Filing readiness rules",
    versions: [
      { version: "3.1", effective_from: "2026-03-16" },
      { version: "3.2", effective_from: "2026-09-15" },
    ],
  },
] as const;

/* --------------------------------------------------------------- scopes */

const TAX_ROUTINE_SCOPE: ApprovedScope = {
  label: "Routine AU and NZ cases",
  included: ["Routine NZ cases", "Routine AU cases"],
  excluded: ["Complex cases", "Cross-border cases"],
  jurisdictions: ["AU", "NZ"],
  complexities: ["routine"],
};

const INVOICE_LEGIBLE_SCOPE: ApprovedScope = {
  label: "Supported AU/NZ invoices with legible required fields",
  included: ["Supported document formats", "All required sections present and legible"],
  excluded: ["Unreadable scans", "Unsupported document formats", "Missing required sections"],
};

/* ----------------------------------------------------------- task specs */

/**
 * One bucket of runs sharing a jurisdiction and complexity. Per-scope counts are
 * declared rather than derived so the scope breakdown on Screen 2 is exactly
 * controllable, and the task totals fall out of them.
 */
export interface ScopeBucketSpec {
  jurisdiction: Jurisdiction;
  complexity: Complexity;
  runs: number;
  incorrect: number;
  /** Incorrect runs whose confidence sits at or above the high-confidence threshold. */
  confident_wrong: number;
  critical_errors: number;
  evidence_missing: number;
  boundary_violations: number;
  missed_critical_exceptions: number;
}

export interface TaskSpec {
  task_id: string;
  agent_id: string;
  name: string;
  description: string;
  autonomy_ceiling: AutonomyLevel;
  current_level: AutonomyLevel;
  operational_state: OperationalState;
  state_note: string | null;
  approved_scope: ApprovedScope | null;
  rule_pack_id: string;
  agent_rule_version: string;
  evaluator_rule_version: string;
  agent_version_id: string;
  policy_version: string;
  material_change_pending: boolean;
  evidence_window_start: string;
  /** The mode the current evidence window was generated under. */
  evidence_mode: AutonomyMode;
  buckets: ScopeBucketSpec[];
  /** Supervised mode: completed cases pulled into post-execution review. */
  sampled: number;
  sampled_errors: number;
  /** Runs carrying a human review. In Assisted every output is reviewed. */
  reviewed_accepted: number;
  reviewed_overridden: number;
  reviewed_escalated: number;
  /** Cases that genuinely called for escalation, and how many were escalated correctly. */
  escalation_expected: number;
  escalation_correct: number;
  /** What this task is seeded to demonstrate. Asserted by tests. */
  demonstrates: string;
}

export const TASK_SPECS: TaskSpec[] = [
  {
    task_id: "read-invoice-fields",
    agent_id: "invoice-helper",
    name: "Read invoice fields",
    description: "Reads vendor, date, invoice number and amounts.",
    autonomy_ceiling: "constrained",
    current_level: "constrained",
    operational_state: "healthy",
    state_note: null,
    approved_scope: INVOICE_LEGIBLE_SCOPE,
    rule_pack_id: "invoice-extraction-rules",
    agent_rule_version: "1.8",
    evaluator_rule_version: "1.8",
    agent_version_id: "invoice-helper-v2",
    policy_version: "1.2",
    material_change_pending: false,
    evidence_window_start: "2026-06-05",
    evidence_mode: "constrained",
    buckets: [
      bucket("NZ", "routine", 26, 0),
      bucket("AU", "routine", 30, 0),
      bucket("NZ", "complex", 8, 0),
      bucket("AU", "complex", 8, 1, { evidence_missing: 1 }),
    ],
    sampled: 9,
    sampled_errors: 0,
    reviewed_accepted: 14,
    reviewed_overridden: 1,
    reviewed_escalated: 3,
    escalation_expected: 3,
    escalation_correct: 3,
    demonstrates: "A mature task already at its ceiling, operating inside an explicit fence.",
  },
  {
    task_id: "classify-expense",
    agent_id: "invoice-helper",
    name: "Classify expense",
    description: "Suggests the appropriate expense category.",
    autonomy_ceiling: "constrained",
    current_level: "supervised",
    operational_state: "healthy",
    state_note: null,
    approved_scope: TAX_ROUTINE_SCOPE,
    rule_pack_id: "expense-classification-rules",
    agent_rule_version: "2.1",
    evaluator_rule_version: "2.1",
    agent_version_id: "invoice-helper-v2",
    policy_version: "1.1",
    material_change_pending: false,
    evidence_window_start: "2026-06-01",
    evidence_mode: "supervised",
    buckets: [
      bucket("NZ", "routine", 24, 0),
      bucket("AU", "routine", 28, 1),
      bucket("NZ", "complex", 14, 1, { confident_wrong: 1 }),
      bucket("AU", "complex", 12, 1, { evidence_missing: 1 }),
    ],
    sampled: 10,
    sampled_errors: 0,
    reviewed_accepted: 16,
    reviewed_overridden: 1,
    reviewed_escalated: 1,
    escalation_expected: 1,
    escalation_correct: 1,
    demonstrates:
      "Not enough Supervised-mode evidence yet, so progression is held rather than assessed.",
  },
  {
    task_id: "match-invoice-to-ledger",
    agent_id: "invoice-helper",
    name: "Match invoice to ledger",
    description: "Finds the corresponding recorded transaction.",
    autonomy_ceiling: "constrained",
    current_level: "supervised",
    operational_state: "healthy",
    state_note: null,
    approved_scope: TAX_ROUTINE_SCOPE,
    rule_pack_id: "ledger-match-rules",
    agent_rule_version: "1.4",
    evaluator_rule_version: "1.4",
    agent_version_id: "invoice-helper-v2",
    policy_version: "1.2",
    material_change_pending: false,
    evidence_window_start: "2026-05-25",
    evidence_mode: "supervised",
    buckets: [
      bucket("NZ", "routine", 96, 1),
      bucket("AU", "routine", 112, 1, { evidence_missing: 1 }),
      bucket("NZ", "complex", 54, 1),
      bucket("AU", "complex", 46, 1, { evidence_missing: 1 }),
    ],
    sampled: 40,
    sampled_errors: 0,
    reviewed_accepted: 56,
    reviewed_overridden: 2,
    reviewed_escalated: 2,
    escalation_expected: 2,
    escalation_correct: 2,
    demonstrates: "Supervised to Constrained: every stage criterion met.",
  },
  {
    task_id: "detect-invoice-exceptions",
    agent_id: "invoice-helper",
    name: "Detect invoice exceptions",
    description: "Flags duplicates, mismatches and unusual invoices.",
    autonomy_ceiling: "constrained",
    current_level: "assisted",
    operational_state: "healthy",
    state_note: null,
    approved_scope: null,
    rule_pack_id: "exception-detection-rules",
    agent_rule_version: "2.0",
    evaluator_rule_version: "2.0",
    agent_version_id: "invoice-helper-v2",
    policy_version: "1.1",
    material_change_pending: false,
    evidence_window_start: "2026-06-22",
    evidence_mode: "assisted",
    buckets: [
      bucket("NZ", "routine", 68, 1),
      bucket("AU", "routine", 76, 1, { evidence_missing: 1 }),
      bucket("NZ", "complex", 38, 2, { confident_wrong: 1, evidence_missing: 1 }),
      bucket("AU", "complex", 34, 2, { evidence_missing: 1 }),
    ],
    sampled: 0,
    sampled_errors: 0,
    reviewed_accepted: 204,
    reviewed_overridden: 7,
    reviewed_escalated: 5,
    escalation_expected: 5,
    escalation_correct: 5,
    demonstrates: "Assisted to Supervised, using evidence only Assisted-mode operation produces.",
  },
  {
    task_id: "routine-rule-application",
    agent_id: "tax-helper",
    name: "Routine rule application",
    description: "Applies routine rules using the current approved rule set.",
    autonomy_ceiling: "constrained",
    current_level: "supervised",
    operational_state: "healthy",
    state_note: null,
    approved_scope: TAX_ROUTINE_SCOPE,
    rule_pack_id: "tax-routine-rules",
    agent_rule_version: "3.2",
    evaluator_rule_version: "3.2",
    agent_version_id: "tax-helper-v2",
    policy_version: "1.3",
    material_change_pending: false,
    evidence_window_start: "2026-07-24",
    evidence_mode: "supervised",
    buckets: [
      bucket("NZ", "routine", 104, 1),
      bucket("AU", "routine", 122, 1, { evidence_missing: 1 }),
      bucket("NZ", "complex", 62, 1, { confident_wrong: 1, evidence_missing: 1 }),
      bucket("AU", "complex", 54, 2, { confident_wrong: 2, evidence_missing: 1 }),
    ],
    sampled: 41,
    sampled_errors: 0,
    reviewed_accepted: 94,
    reviewed_overridden: 3,
    reviewed_escalated: 3,
    escalation_expected: 3,
    escalation_correct: 3,
    demonstrates:
      "Eligibility passes and exactly one autonomy criterion fails: confident-but-wrong.",
  },
  {
    task_id: "risk-detection",
    agent_id: "tax-helper",
    name: "Risk detection",
    description: "Identifies routine, medium-risk and high-risk cases.",
    autonomy_ceiling: "constrained",
    current_level: "shadow",
    operational_state: "healthy",
    state_note: null,
    approved_scope: null,
    rule_pack_id: "risk-detection-rules",
    agent_rule_version: "1.2",
    evaluator_rule_version: "1.2",
    agent_version_id: "tax-helper-v2",
    policy_version: "1.0",
    material_change_pending: false,
    evidence_window_start: "2026-08-03",
    evidence_mode: "shadow",
    buckets: [
      bucket("NZ", "routine", 70, 0),
      bucket("AU", "routine", 78, 1, { evidence_missing: 1 }),
      bucket("NZ", "complex", 40, 1),
      bucket("AU", "complex", 36, 2, { confident_wrong: 1, evidence_missing: 2 }),
    ],
    sampled: 0,
    sampled_errors: 0,
    // Shadow produces no acceptance or override evidence: nobody is relying on the
    // output yet. That absence is the point, so it is seeded as a genuine absence.
    reviewed_accepted: 0,
    reviewed_overridden: 0,
    reviewed_escalated: 0,
    escalation_expected: 0,
    escalation_correct: 0,
    demonstrates: "Shadow to Assisted on correctness evidence alone.",
  },
  {
    task_id: "draft-tax-position",
    agent_id: "tax-helper",
    name: "Draft tax position",
    description: "Proposes a treatment with supporting reasoning and open questions.",
    autonomy_ceiling: "supervised",
    current_level: "assisted",
    operational_state: "paused",
    state_note: "Rule-version mismatch detected. Evaluation for this task is paused.",
    approved_scope: null,
    rule_pack_id: "tax-position-rules",
    agent_rule_version: "2.4",
    // The evaluator is still judging against the superseded version. Agent and
    // current rule agree; the evaluator does not, so evaluation pauses.
    evaluator_rule_version: "2.3",
    agent_version_id: "tax-helper-v2",
    policy_version: "1.2",
    material_change_pending: false,
    evidence_window_start: "2026-09-08",
    evidence_mode: "assisted",
    buckets: [
      bucket("NZ", "routine", 20, 1),
      bucket("AU", "routine", 22, 1, { evidence_missing: 1 }),
      bucket("NZ", "complex", 10, 1, { confident_wrong: 1 }),
      bucket("AU", "complex", 10, 1, { evidence_missing: 1 }),
    ],
    sampled: 0,
    sampled_errors: 0,
    reviewed_accepted: 54,
    reviewed_overridden: 6,
    reviewed_escalated: 2,
    escalation_expected: 3,
    escalation_correct: 2,
    demonstrates: "A rule-version mismatch pauses evaluation without lowering the recorded level.",
  },
  {
    task_id: "filing-readiness",
    agent_id: "tax-helper",
    name: "Filing readiness",
    description: "Checks whether required evidence and review steps are complete.",
    autonomy_ceiling: "constrained",
    // The candidate configuration starts again at Shadow. The previously approved
    // L4 lives on the sandbox record as history, never as an entitlement.
    current_level: "shadow",
    operational_state: "sandbox",
    state_note: "Candidate configuration under validation",
    approved_scope: null,
    rule_pack_id: "filing-readiness-rules",
    agent_rule_version: "3.2",
    evaluator_rule_version: "3.2",
    agent_version_id: "tax-helper-v2",
    policy_version: "1.1",
    material_change_pending: true,
    evidence_window_start: "2026-09-16",
    evidence_mode: "shadow",
    buckets: [
      bucket("NZ", "routine", 55, 0),
      bucket("AU", "routine", 45, 0),
      bucket("NZ", "complex", 22, 1),
      bucket("AU", "complex", 20, 2, {
        confident_wrong: 1,
        critical_errors: 1,
        evidence_missing: 1,
      }),
    ],
    sampled: 0,
    sampled_errors: 0,
    reviewed_accepted: 0,
    reviewed_overridden: 0,
    reviewed_escalated: 0,
    escalation_expected: 0,
    escalation_correct: 0,
    demonstrates:
      "A material change sends a previously Constrained task back through Shadow revalidation.",
  },
];

function bucket(
  jurisdiction: Jurisdiction,
  complexity: Complexity,
  runs: number,
  incorrect: number,
  extra: Partial<
    Pick<
      ScopeBucketSpec,
      | "confident_wrong"
      | "critical_errors"
      | "evidence_missing"
      | "boundary_violations"
      | "missed_critical_exceptions"
    >
  > = {},
): ScopeBucketSpec {
  return {
    jurisdiction,
    complexity,
    runs,
    incorrect,
    confident_wrong: extra.confident_wrong ?? 0,
    critical_errors: extra.critical_errors ?? 0,
    evidence_missing: extra.evidence_missing ?? 0,
    boundary_violations: extra.boundary_violations ?? 0,
    missed_critical_exceptions: extra.missed_critical_exceptions ?? 0,
  };
}

/* ------------------------------------------------------ policy histories */

export interface PolicyVersionSpec {
  task_id: string;
  version: string;
  created_at: string;
  active: boolean;
  change_note: string;
  /** Overrides applied on top of DEFAULT_STAGES. */
  overrides?: Partial<Record<StageKey, Partial<StageCriteria>>>;
}

export const POLICY_VERSION_SPECS: PolicyVersionSpec[] = [
  { task_id: "read-invoice-fields", version: "1.2", created_at: "2026-02-10", active: true, change_note: "Initial prototype policy." },
  { task_id: "classify-expense", version: "1.1", created_at: "2026-01-19", active: true, change_note: "Initial prototype policy." },
  { task_id: "match-invoice-to-ledger", version: "1.2", created_at: "2026-05-25", active: true, change_note: "Initial prototype policy." },
  { task_id: "detect-invoice-exceptions", version: "1.1", created_at: "2026-03-02", active: true, change_note: "Initial prototype policy." },
  { task_id: "risk-detection", version: "1.0", created_at: "2026-04-20", active: true, change_note: "Initial prototype policy." },
  { task_id: "draft-tax-position", version: "1.2", created_at: "2026-02-09", active: true, change_note: "Initial prototype policy." },
  { task_id: "filing-readiness", version: "1.1", created_at: "2026-03-16", active: true, change_note: "Initial prototype policy." },
  // The one task with real policy history, so Screen 5 and the Audit Log have
  // something true to show about versioning.
  {
    task_id: "routine-rule-application",
    version: "1.1",
    created_at: "2026-01-20",
    active: false,
    change_note: "Initial prototype policy.",
    overrides: { supervised_to_constrained: { max_confident_wrong_rate: 0.005 } },
  },
  {
    task_id: "routine-rule-application",
    version: "1.2",
    created_at: "2026-04-14",
    active: false,
    change_note: "Raised the minimum post-execution sample coverage from 5% to 10%.",
    overrides: {
      supervised_to_constrained: { max_confident_wrong_rate: 0.005, min_sample_coverage: 0.1 },
    },
  },
  {
    task_id: "routine-rule-application",
    version: "1.3",
    created_at: "2026-08-11",
    active: true,
    change_note:
      "Tightened the confident-but-wrong limit for Constrained autonomy from 0.5% to 0.25%.",
  },
];

/* ------------------------------------------------------------- incidents */

export const INCIDENT_SPECS = [
  {
    incident_id: "INC-001",
    task_id: "draft-tax-position",
    type: "rule-version-mismatch",
    status: "open" as const,
    opened_at: "2026-09-10",
    summary:
      "The evaluator is still using rule version 2.3 while the task and the current rule set are on 2.4.",
    affected_case_count: 17,
    blocking: true,
  },
];

/* --------------------------------------------------------------- sandbox */

export const SANDBOX_SPECS = [
  {
    sandbox_id: "SBX-001",
    task_id: "filing-readiness",
    opened_at: "2026-09-16",
    trigger: "Rule update: v3.1 to v3.2",
    change_summary: "The rule set used by this task changed from v3.1 to v3.2.",
    change_impact: "The change may alter task behaviour, error patterns, or case complexity.",
    candidate_agent_version_id: "tax-helper-v2",
    candidate_rule_version: "3.2",
    previous_rule_version: "3.1",
    previous_level: "constrained" as AutonomyLevel,
    sandbox_level: "shadow" as AutonomyLevel,
    planned_case_count: 200,
    // Coverage groups describe the types of case included in revalidation.
    // They overlap and are not independent totals.
    coverage_groups: [
      { label: "Previously successful cases", case_count: 60, status: "Pass" },
      { label: "Affected by rule change", case_count: 50, status: "Under test" },
      { label: "Routine cases", case_count: 70, status: "Stable" },
      { label: "Complex cases", case_count: 30, status: "Needs review" },
      { label: "Known past failures", case_count: 20, status: "Covered" },
    ],
    recommendation: "restrict-scope" as const,
    human_decision: "pending" as const,
  },
];

/* ------------------------------------------------- seeded decision history */

export interface DecisionSpec {
  decision_id: string;
  task_id: string;
  decided_at: string;
  current_level: AutonomyLevel;
  recommended_level: AutonomyLevel | null;
  recommendation_code: string;
  final_level: AutonomyLevel;
  outcome:
    | "approved"
    | "kept-current-level"
    | "scope-restricted"
    | "autonomy-lowered"
    | "recommendation-declined";
  was_override: boolean;
  scope: ApprovedScope | null;
  reason: string;
  policy_version: string;
  rule_version: string;
  evaluator_rule_version: string;
  agent_version: string;
  /** Mode the evidence behind this decision came from. */
  snapshot_mode: AutonomyMode;
  /**
   * Evidence frozen at the moment the decision was made. These are historical
   * figures from windows that have since closed, so they are declared rather than
   * recomputed. Recomputing them from today's data is exactly what the product
   * forbids.
   */
  snapshot: {
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
  };
  confirmed_classifications: string[];
}

export const DECISION_SPECS: DecisionSpec[] = [
  {
    decision_id: "DEC-001",
    task_id: "routine-rule-application",
    decided_at: "2026-05-18",
    current_level: "assisted",
    recommended_level: "supervised",
    recommendation_code: "ELIGIBLE_FOR_NEXT_LEVEL",
    final_level: "supervised",
    outcome: "approved",
    was_override: false,
    scope: TAX_ROUTINE_SCOPE,
    reason: "Required eligibility checks and autonomy criteria were met for the approved scope.",
    policy_version: "1.2",
    rule_version: "3.1",
    evaluator_rule_version: "3.1",
    agent_version: "tax-helper-v2",
    snapshot_mode: "assisted",
        snapshot: {
      valid_case_count: 240,
      accuracy: 0.987,
      critical_errors: 0,
      confident_wrong_rate: 0.003,
      evidence_coverage: 0.995,
      human_acceptance_rate: 0.96,
      human_override_rate: 0.04,
      correct_escalation_rate: 1,
      sample_coverage: null,
      sampled_error_rate: null,
      boundary_violations: null,
      missed_critical_exceptions: null,
    },
    confirmed_classifications: ["Reviewer note classified as minor error, confirmed by Maya"],
  },
  {
    decision_id: "DEC-002",
    task_id: "read-invoice-fields",
    decided_at: "2026-06-05",
    current_level: "supervised",
    recommended_level: "constrained",
    recommendation_code: "ELIGIBLE_FOR_NEXT_LEVEL",
    final_level: "constrained",
    outcome: "approved",
    was_override: false,
    scope: INVOICE_LEGIBLE_SCOPE,
    reason:
      "Supervised-mode evidence met every criterion. Approved within a scope that excludes unreadable and unsupported documents.",
    policy_version: "1.2",
    rule_version: "1.8",
    evaluator_rule_version: "1.8",
    agent_version: "invoice-helper-v2",
    snapshot_mode: "supervised",
        snapshot: {
      valid_case_count: 326,
      accuracy: 0.994,
      critical_errors: 0,
      confident_wrong_rate: 0,
      evidence_coverage: 0.994,
      human_acceptance_rate: 0.97,
      human_override_rate: 0.03,
      correct_escalation_rate: 1,
      sample_coverage: 0.11,
      sampled_error_rate: 0,
      boundary_violations: 0,
      missed_critical_exceptions: 0,
    },
    confirmed_classifications: [],
  },
  {
    decision_id: "DEC-003",
    task_id: "routine-rule-application",
    decided_at: "2026-07-24",
    current_level: "supervised",
    recommended_level: "supervised",
    recommendation_code: "CONTINUE_PREVIOUS_FOR_VALIDATED_SCOPE",
    final_level: "supervised",
    outcome: "approved",
    was_override: false,
    scope: TAX_ROUTINE_SCOPE,
    reason:
      "Revalidation after the rule update to v3.2 passed for the approved scope, so the previous level continues within that scope.",
    policy_version: "1.2",
    rule_version: "3.2",
    evaluator_rule_version: "3.2",
    agent_version: "tax-helper-v2",
    snapshot_mode: "shadow",
        snapshot: {
      valid_case_count: 200,
      accuracy: 0.99,
      critical_errors: 0,
      confident_wrong_rate: 0,
      evidence_coverage: 0.99,
      human_acceptance_rate: null,
      human_override_rate: null,
      correct_escalation_rate: null,
      sample_coverage: null,
      sampled_error_rate: null,
      boundary_violations: null,
      missed_critical_exceptions: null,
    },
    confirmed_classifications: [],
  },
  {
    decision_id: "DEC-004",
    task_id: "detect-invoice-exceptions",
    decided_at: "2026-08-19",
    current_level: "assisted",
    recommended_level: "shadow",
    recommendation_code: "ROLLBACK_RECOMMENDED",
    final_level: "assisted",
    outcome: "recommendation-declined",
    was_override: true,
    scope: null,
    reason:
      "The cluster of overrides came from a single vendor format that has since been corrected. Retaining Assisted while the next evidence window is collected.",
    policy_version: "1.1",
    rule_version: "2.0",
    evaluator_rule_version: "2.0",
    agent_version: "invoice-helper-v2",
    snapshot_mode: "assisted",
        snapshot: {
      valid_case_count: 212,
      accuracy: 0.962,
      critical_errors: 0,
      confident_wrong_rate: 0.009,
      evidence_coverage: 0.981,
      human_acceptance_rate: 0.92,
      human_override_rate: 0.075,
      correct_escalation_rate: 0.96,
      sample_coverage: null,
      sampled_error_rate: null,
      boundary_violations: null,
      missed_critical_exceptions: null,
    },
    confirmed_classifications: ["Reviewer note classified as material error, confirmed by Maya"],
  },
];

/* ------------------------------------------- bounded classification seeds */

export interface JudgmentSpec {
  judgment_id: string;
  task_id: string;
  /** Index into the task's run list, so the judgment attaches to a real run. */
  run_index: number;
  question_id: string;
  result: "no_error" | "minor_error" | "material_error" | "critical_error" | "uncertain";
  confidence: number;
  requires_human_confirmation: boolean;
  human_confirmed_result:
    | "no_error"
    | "minor_error"
    | "material_error"
    | "critical_error"
    | "uncertain"
    | null;
  reviewer_note: string;
}

export const JUDGMENT_SPECS: JudgmentSpec[] = [
  {
    // Left unresolved on purpose. Phase 9 turns this into the live demonstration
    // of bounded judgment -> human confirmation -> deterministic consequence.
    judgment_id: "JDG-001",
    task_id: "routine-rule-application",
    // A material error means the substantive result was wrong, so this must sit
    // on an incorrect run. Complex AU, which is outside the approved routine fence.
    run_index: 289,
    question_id: "review-error-severity-v1",
    result: "material_error",
    confidence: 0.91,
    requires_human_confirmation: true,
    human_confirmed_result: null,
    reviewer_note:
      "Treatment was broadly correct but missed an important cross-border condition.",
  },
  {
    judgment_id: "JDG-002",
    task_id: "routine-rule-application",
    // Deliberately on a correct run: a minor error can be a presentation issue on
    // a substantively right answer, which is also why it needs no confirmation.
    run_index: 118,
    question_id: "review-error-severity-v1",
    result: "minor_error",
    confidence: 0.88,
    requires_human_confirmation: false,
    human_confirmed_result: "minor_error",
    reviewer_note: "Wording differed from house style but the treatment itself was right.",
  },
  {
    judgment_id: "JDG-003",
    task_id: "detect-invoice-exceptions",
    run_index: 145,
    question_id: "review-error-severity-v1",
    result: "material_error",
    confidence: 0.84,
    requires_human_confirmation: true,
    human_confirmed_result: "material_error",
    reviewer_note: "A duplicate pair was flagged, but the earlier of the two was the wrong one.",
  },
  {
    judgment_id: "JDG-004",
    task_id: "filing-readiness",
    // Must point at the run that already carries the critical-error flag. A
    // confirmed classification and the flag describe the same error; pointing
    // them at different runs would assert two unrelated critical errors.
    run_index: 122,
    question_id: "review-error-severity-v1",
    result: "critical_error",
    confidence: 0.93,
    requires_human_confirmation: true,
    human_confirmed_result: "critical_error",
    reviewer_note:
      "Marked ready for the next step while a required supporting document was still missing.",
  },
];
