import type {
  ApprovedScope,
  AutonomyLevel,
  DecisionOutcome,
  ErrorClassification,
  MetricSnapshot,
  PolicyVersion,
  StageCriteria,
  StageKey,
} from "@/lib/domain/types";

/**
 * Visitor state.
 *
 * The seeded dataset is bundled and never written to. Only what a visitor does
 * is persisted, and only in their own browser: nobody sees anyone else's
 * decisions, and Reset demo is a single key removal rather than a rebuild.
 *
 * Every read and write is wrapped, because storage can be unavailable or throw
 * outright in a private window or with site data blocked. The product must work
 * in that case; it just will not remember anything.
 */

export const DEMO_STATE_KEY = "autonomy-gate.demo-state.v1";

export interface RecordedDecision {
  decision_id: string;
  task_id: string;
  /**
   * Continuity decisions are about whether a level already earned carries over
   * to a changed configuration, which is a different question from promotion.
   * Absent on decisions recorded before this existed.
   */
  kind?: "autonomy" | "continuity";
  /** Continuity only: whether this decision closed the outstanding revalidation. */
  resolves_revalidation?: boolean;
  decided_at: string;
  current_level: AutonomyLevel;
  recommended_level: AutonomyLevel | null;
  recommendation_code: string;
  final_level: AutonomyLevel;
  outcome: DecisionOutcome;
  was_override: boolean;
  scope: ApprovedScope | null;
  decided_by: string;
  reason: string;
  reason_category: string;
  policy_version: string;
  agent_version: string;
  rule_version: string;
  evaluator_rule_version: string;
  /** Frozen at the moment of the decision. Never recalculated afterwards. */
  snapshot: MetricSnapshot;
  confirmed_classifications: string[];
}

/**
 * A policy version this visitor created by editing thresholds.
 *
 * Editing never overwrites: it publishes a new version. Decisions already
 * recorded keep pointing at the version they were made under, which is the whole
 * reason versions exist.
 */
export interface RecordedPolicyVersion {
  policy_version_id: string;
  task_id: string;
  version: string;
  created_at: string;
  change_note: string;
  high_confidence_threshold: number;
  stages: Record<StageKey, StageCriteria>;
  /** The version this one was edited from. */
  based_on: string;
}

/**
 * A bounded classification this visitor resolved.
 *
 * `resolved: false` means they routed it for more review rather than settling
 * it. That is not a classification and must not count as evidence, which is why
 * the two are tracked separately instead of using a placeholder value.
 */
export interface RecordedClassification {
  judgment_id: string;
  task_id: string;
  run_id: string;
  result: ErrorClassification;
  resolved: boolean;
  confirmed_at: string;
  reviewer: string;
}

export interface DemoState {
  version: 1;
  decisions: RecordedDecision[];
  policies: RecordedPolicyVersion[];
  classifications: RecordedClassification[];
}

export const EMPTY_DEMO_STATE: DemoState = {
  version: 1,
  decisions: [],
  policies: [],
  classifications: [],
};

function isDemoState(value: unknown): value is DemoState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DemoState>;
  return candidate.version === 1 && Array.isArray(candidate.decisions);
}

/** Older stored state may predate policy editing; treat a missing list as empty. */
function normalise(state: DemoState): DemoState {
  return {
    ...state,
    policies: Array.isArray(state.policies) ? state.policies : [],
    classifications: Array.isArray(state.classifications) ? state.classifications : [],
  };
}

export function loadDemoState(): DemoState {
  try {
    const raw = globalThis.localStorage?.getItem(DEMO_STATE_KEY);
    if (!raw) return EMPTY_DEMO_STATE;
    const parsed: unknown = JSON.parse(raw);
    // Anything unrecognised is discarded rather than patched: a half-understood
    // state is worse than a clean one in a prototype nobody can support.
    return isDemoState(parsed) ? normalise(parsed) : EMPTY_DEMO_STATE;
  } catch {
    return EMPTY_DEMO_STATE;
  }
}

export function saveDemoState(state: DemoState): void {
  try {
    globalThis.localStorage?.setItem(DEMO_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable. The session keeps working in memory.
  }
}

export function clearDemoState(): void {
  try {
    globalThis.localStorage?.removeItem(DEMO_STATE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The level a task holds once this visitor's decisions are applied. */
export function effectiveLevel(
  state: DemoState,
  taskId: string,
  seededLevel: AutonomyLevel,
): AutonomyLevel {
  const latest = latestDecisionFor(state, taskId);
  return latest?.final_level ?? seededLevel;
}

/** The approved scope a task holds once this visitor's decisions are applied. */
export function effectiveScope(
  state: DemoState,
  taskId: string,
  seededScope: ApprovedScope | null,
): ApprovedScope | null {
  const latest = latestDecisionFor(state, taskId);
  return latest ? latest.scope : seededScope;
}

export function latestDecisionFor(
  state: DemoState,
  taskId: string,
): RecordedDecision | undefined {
  const forTask = state.decisions.filter((decision) => decision.task_id === taskId);
  return forTask[forTask.length - 1];
}

export function hasVisitorChanges(state: DemoState): boolean {
  return (
    state.decisions.length > 0 ||
    state.policies.length > 0 ||
    state.classifications.length > 0
  );
}

/** Sequential within a session, and prefixed so it never collides with seeded ids. */
export function nextDecisionId(state: DemoState): string {
  return `DEC-S${String(state.decisions.length + 1).padStart(3, "0")}`;
}

/** The policy governing a task once this visitor's edits are applied. */
export function effectivePolicy(state: DemoState, seeded: PolicyVersion): PolicyVersion {
  const own = state.policies.filter((policy) => policy.task_id === seeded.task_id);
  const latest = own[own.length - 1];
  if (!latest) return seeded;
  return {
    policy_version_id: latest.policy_version_id,
    task_id: latest.task_id,
    version: latest.version,
    active: true,
    created_at: latest.created_at,
    change_note: latest.change_note,
    high_confidence_threshold: latest.high_confidence_threshold,
    stages: latest.stages,
  };
}

export function policyEditsFor(state: DemoState, taskId: string): RecordedPolicyVersion[] {
  return state.policies.filter((policy) => policy.task_id === taskId);
}

/** v1.3 becomes v1.4. Minor versions only: the prototype never forks a policy. */
export function nextPolicyVersion(current: string): string {
  const parts = current.split(".");
  const major = parts[0] ?? "1";
  const minor = Number.parseInt(parts[1] ?? "0", 10);
  return `${major}.${Number.isNaN(minor) ? 1 : minor + 1}`;
}

export function hasVisitorPolicyChanges(state: DemoState): boolean {
  return state.policies.length > 0;
}

/** The latest continuity decision recorded for a task, if any. */
export function latestContinuityFor(
  state: DemoState,
  taskId: string,
): RecordedDecision | undefined {
  const forTask = state.decisions.filter(
    (decision) => decision.task_id === taskId && decision.kind === "continuity",
  );
  return forTask[forTask.length - 1];
}

/**
 * Whether a task still has a revalidation outstanding.
 *
 * Choosing to keep the candidate in Shadow leaves it outstanding on purpose:
 * that decision is a decision not to restore autonomy yet, not a resolution.
 */
export function effectiveMaterialChangePending(
  state: DemoState,
  taskId: string,
  seededPending: boolean,
): boolean {
  if (!seededPending) return false;
  const continuity = latestContinuityFor(state, taskId);
  if (!continuity) return true;
  return !continuity.resolves_revalidation;
}

export function classificationFor(
  state: DemoState,
  judgmentId: string,
): RecordedClassification | undefined {
  const forJudgment = state.classifications.filter(
    (item) => item.judgment_id === judgmentId,
  );
  return forJudgment[forJudgment.length - 1];
}

/**
 * Whether this visitor has confirmed a classification as critical.
 *
 * Only a confirmed critical error changes what the gate computes, so this is the
 * one distinction the browser needs in order to pick the right precomputed
 * evidence. An unresolved classification is not a confirmation.
 */
export function hasConfirmedCritical(state: DemoState, taskId: string): boolean {
  return state.classifications.some(
    (item) => item.task_id === taskId && item.resolved && item.result === "critical_error",
  );
}

export function classificationsForTask(
  state: DemoState,
  taskId: string,
): RecordedClassification[] {
  return state.classifications.filter((item) => item.task_id === taskId);
}
