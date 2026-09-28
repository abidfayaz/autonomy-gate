import {
  agents,
  auditEvents,
  decisions as seededDecisions,
  incidents,
  sandboxValidations,
  tasks,
} from "@/lib/data/seed";
import type {
  AuditEventType,
  AutonomyLevel,
  MetricSnapshot,
} from "@/lib/domain/types";
import { AUTONOMY_LABELS } from "@/lib/domain/vocabulary";
import type { RecordedDecision, RecordedPolicyVersion } from "@/lib/state/demoState";

/**
 * View model for the Audit Log.
 *
 * The record is built from two places that must never be confused: the seeded
 * history, which is fixed, and this visitor's own decisions, which are theirs
 * alone. Both are shown; each row says which it is.
 *
 * Nothing here recalculates anything. A decision's evidence is read from the
 * snapshot frozen when it was recorded, not from what the numbers say today.
 */

export interface SnapshotRow {
  label: string;
  value: string;
}

export interface AuditDetail {
  decision_id: string;
  agent_name: string;
  task_name: string;
  decided_by: string;
  decided_at: string;
  previous_level_label: string;
  recommended_label: string;
  final_level_label: string;
  outcome_label: string;
  was_override: boolean;
  reason: string;
  reason_category: string | null;
  scope_included: string[];
  scope_excluded: string[];
  policy_version: string;
  agent_version: string;
  rule_version: string;
  evaluator_rule_version: string;
  snapshot_rows: SnapshotRow[];
  confirmed_classifications: string[];
  /** Whether this row came from the seeded history or from this visitor. */
  source: "seeded" | "this-session";
}

export interface AuditRow {
  event_id: string;
  occurred_at: string;
  type: AuditEventType;
  type_label: string;
  agent_name: string;
  task_name: string;
  task_id: string;
  summary: string;
  change_from: string;
  change_to: string;
  actor: string;
  status: string;
  detail: AuditDetail | null;
  source: "seeded" | "this-session";
}

export interface AuditLookups {
  agent_names: Record<string, string>;
  task_names: Record<string, string>;
  task_agents: Record<string, string>;
  agents: Array<{ id: string; name: string }>;
  tasks: Array<{ id: string; name: string; agent_id: string }>;
}

export interface AuditView {
  rows: AuditRow[];
  lookups: AuditLookups;
  /** Counts derived from the rows, never written down. */
  counts: {
    autonomy_decisions: number;
    policy_changes: number;
    revalidations: number;
    needs_attention: number;
  };
  needs_attention_task: string | null;
}

export const EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  "autonomy-decision": "Autonomy decision",
  "policy-change": "Policy change",
  "sandbox-revalidation": "Sandbox revalidation",
  "version-issue": "Version issue",
};

const OUTCOME_LABELS: Record<string, string> = {
  approved: "Approved",
  "kept-current-level": "Level retained",
  "scope-restricted": "Scope restricted",
  "autonomy-lowered": "Autonomy lowered",
  "recommendation-declined": "Recommendation declined",
};

const percent = (value: number | null): string =>
  value === null ? "—" : `${(value * 100).toFixed(Math.abs(value) < 0.01 && value !== 0 ? 2 : 1)}%`;

const count = (value: number | null): string => (value === null ? "—" : String(value));

/** Reads the frozen snapshot as it stands, with nothing recomputed. */
export function snapshotRows(snapshot: MetricSnapshot): SnapshotRow[] {
  return [
    { label: "Evidence mode", value: AUTONOMY_LABELS[snapshot.autonomy_mode].name },
    { label: "Valid cases", value: count(snapshot.valid_case_count) },
    { label: "Accuracy", value: percent(snapshot.accuracy) },
    { label: "Critical errors", value: count(snapshot.critical_errors) },
    { label: "Confident-but-wrong", value: percent(snapshot.confident_wrong_rate) },
    { label: "Evidence coverage", value: percent(snapshot.evidence_coverage) },
    { label: "Human acceptance", value: percent(snapshot.human_acceptance_rate) },
    { label: "Human override", value: percent(snapshot.human_override_rate) },
    { label: "Correct escalation", value: percent(snapshot.correct_escalation_rate) },
    { label: "Sample coverage", value: percent(snapshot.sample_coverage) },
    { label: "Sampled error rate", value: percent(snapshot.sampled_error_rate) },
    { label: "Boundary violations", value: count(snapshot.boundary_violations) },
    { label: "Missed critical exceptions", value: count(snapshot.missed_critical_exceptions) },
  ];
}


/**
 * How to describe a change that did not change the level.
 *
 * A revalidation that confirms a level, or a decision to hold, would otherwise
 * render as "L3 · Supervised to L3 · Supervised", which says nothing. What
 * happened matters more than the arrow.
 */
function describeChange(
  from: string,
  to: string,
  outcome: string | null,
  type: AuditEventType,
): string {
  if (from !== to) return to;
  if (outcome === "scope-restricted") return `${to}, scope narrowed`;
  if (type === "sandbox-revalidation") return `Continued ${to}`;
  return `Retained ${to}`;
}

const levelLabel = (level: AutonomyLevel | null): string =>
  level ? AUTONOMY_LABELS[level].label : "No recommendation";

export function buildAuditView(): AuditView {
  const agentNames = Object.fromEntries(agents.map((agent) => [agent.agent_id, agent.name]));
  const taskNames = Object.fromEntries(tasks.map((task) => [task.task_id, task.name]));
  const taskAgents = Object.fromEntries(tasks.map((task) => [task.task_id, task.agent_id]));

  const detailByDecision = new Map<string, AuditDetail>();
  for (const decision of seededDecisions) {
    detailByDecision.set(decision.decision_id, {
      decision_id: decision.decision_id,
      agent_name: agentNames[taskAgents[decision.task_id] ?? ""] ?? "",
      task_name: taskNames[decision.task_id] ?? decision.task_id,
      decided_by: decision.decided_by,
      decided_at: decision.decided_at,
      previous_level_label: levelLabel(decision.current_level),
      recommended_label: levelLabel(decision.recommended_level),
      final_level_label: levelLabel(decision.final_level),
      outcome_label: OUTCOME_LABELS[decision.outcome] ?? decision.outcome,
      was_override: decision.was_override,
      reason: decision.reason,
      reason_category: null,
      scope_included: decision.scope?.included ?? [],
      scope_excluded: decision.scope?.excluded ?? [],
      policy_version: `v${decision.policy_version}`,
      agent_version: decision.agent_version,
      rule_version: `v${decision.rule_version}`,
      evaluator_rule_version: `v${decision.evaluator_rule_version}`,
      snapshot_rows: snapshotRows(decision.snapshot),
      confirmed_classifications: decision.confirmed_classifications,
      source: "seeded",
    });
  }

  const outcomeByDecision = new Map(
    seededDecisions.map((decision) => [decision.decision_id, decision.outcome as string]),
  );

  const rows: AuditRow[] = auditEvents.map((event) => ({
    event_id: event.event_id,
    occurred_at: event.occurred_at,
    type: event.type,
    type_label: EVENT_TYPE_LABELS[event.type],
    agent_name: agentNames[taskAgents[event.task_id] ?? ""] ?? "",
    task_name: taskNames[event.task_id] ?? event.task_id,
    task_id: event.task_id,
    summary: event.summary,
    change_from: event.change_from,
    change_to: describeChange(
      event.change_from,
      event.change_to,
      event.decision_id ? (outcomeByDecision.get(event.decision_id) ?? null) : null,
      event.type,
    ),
    actor: event.actor,
    status: event.status,
    detail: event.decision_id ? (detailByDecision.get(event.decision_id) ?? null) : null,
    source: "seeded",
  }));

  const unresolved = incidents.find((incident) => incident.status === "open");
  const pendingSandbox = sandboxValidations.find(
    (sandbox) => sandbox.human_decision === "pending",
  );

  return {
    rows,
    lookups: {
      agent_names: agentNames,
      task_names: taskNames,
      task_agents: taskAgents,
      agents: agents.map((agent) => ({ id: agent.agent_id, name: agent.name })),
      tasks: tasks.map((task) => ({
        id: task.task_id,
        name: task.name,
        agent_id: task.agent_id,
      })),
    },
    counts: countRows(rows),
    needs_attention_task: unresolved
      ? (taskNames[unresolved.task_id] ?? null)
      : pendingSandbox
        ? (taskNames[pendingSandbox.task_id] ?? null)
        : null,
  };
}

export function countRows(rows: AuditRow[]): AuditView["counts"] {
  return {
    autonomy_decisions: rows.filter((row) => row.type === "autonomy-decision").length,
    policy_changes: rows.filter((row) => row.type === "policy-change").length,
    revalidations: rows.filter((row) => row.type === "sandbox-revalidation").length,
    needs_attention: rows.filter((row) => row.status === "Needs attention").length,
  };
}

/**
 * Turns one of this visitor's decisions into a row.
 *
 * Marked as belonging to this session so it is never mistaken for seeded
 * history, and carrying the same frozen snapshot the decision was recorded with.
 */
export function rowFromRecordedDecision(
  decision: RecordedDecision,
  lookups: AuditLookups,
): AuditRow {
  const agentName = lookups.agent_names[lookups.task_agents[decision.task_id] ?? ""] ?? "";
  const taskName = lookups.task_names[decision.task_id] ?? decision.task_id;
  const declined = decision.outcome === "recommendation-declined";
  // A continuity decision answers whether an earned level carries over to a
  // changed configuration, so it belongs with revalidation rather than promotion.
  const type: AuditEventType =
    decision.kind === "continuity" ? "sandbox-revalidation" : "autonomy-decision";

  return {
    event_id: `EVT-${decision.decision_id}`,
    occurred_at: decision.decided_at,
    type,
    type_label: EVENT_TYPE_LABELS[type],
    agent_name: agentName,
    task_name: taskName,
    task_id: decision.task_id,
    summary: type === "sandbox-revalidation" ? "Sandbox revalidation" : "Autonomy decision",
    change_from: levelLabel(decision.current_level),
    change_to: describeChange(
      levelLabel(decision.current_level),
      levelLabel(decision.final_level),
      decision.outcome,
      type,
    ),
    actor: decision.decided_by,
    status: declined
      ? "Recommendation declined"
      : (OUTCOME_LABELS[decision.outcome] ?? "Recorded"),
    source: "this-session",
    detail: {
      decision_id: decision.decision_id,
      agent_name: agentName,
      task_name: taskName,
      decided_by: decision.decided_by,
      decided_at: decision.decided_at,
      previous_level_label: levelLabel(decision.current_level),
      recommended_label: levelLabel(decision.recommended_level),
      final_level_label: levelLabel(decision.final_level),
      outcome_label: OUTCOME_LABELS[decision.outcome] ?? decision.outcome,
      was_override: decision.was_override,
      reason: decision.reason,
      reason_category: decision.reason_category,
      scope_included: decision.scope?.included ?? [],
      scope_excluded: decision.scope?.excluded ?? [],
      policy_version: `v${decision.policy_version}`,
      agent_version: decision.agent_version,
      rule_version: `v${decision.rule_version}`,
      evaluator_rule_version: `v${decision.evaluator_rule_version}`,
      snapshot_rows: snapshotRows(decision.snapshot),
      confirmed_classifications: decision.confirmed_classifications,
      source: "this-session",
    },
  };
}

/**
 * A policy version this visitor published becomes a record like any other.
 *
 * It changes what future evaluations are judged against and nothing else: no
 * existing entry is touched, which is the point of versioning it rather than
 * editing in place.
 */
export function rowFromRecordedPolicy(
  policy: RecordedPolicyVersion,
  lookups: AuditLookups,
): AuditRow {
  const agentName = lookups.agent_names[lookups.task_agents[policy.task_id] ?? ""] ?? "";
  const taskName = lookups.task_names[policy.task_id] ?? policy.task_id;

  return {
    event_id: `EVT-POL-${policy.policy_version_id}`,
    occurred_at: policy.created_at,
    type: "policy-change",
    type_label: EVENT_TYPE_LABELS["policy-change"],
    agent_name: agentName,
    task_name: taskName,
    task_id: policy.task_id,
    summary: "Policy change",
    change_from: `Policy v${policy.based_on}`,
    change_to: `Policy v${policy.version}`,
    actor: "Maya",
    status: "Active",
    detail: null,
    source: "this-session",
  };
}
