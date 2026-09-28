/**
 * Expands `specs.ts` into the canonical dataset under `data/seed/`.
 *
 * Run with: npm run seed
 *
 * The generator is a pure function of the spec plus a fixed seed. It derives
 * nothing editorially: if a count is not in the spec, it is not in the data.
 * Every invariant it depends on is asserted as it builds, so an inconsistent
 * spec fails loudly here rather than producing a screen that quietly lies.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Agent,
  AgentRun,
  AgentVersion,
  AuditEvent,
  AutonomyDecision,
  EvaluationCase,
  HumanReview,
  Incident,
  JevJudgment,
  MetricSnapshot,
  PolicyVersion,
  RulePack,
  RuleVersion,
  SandboxValidation,
  SeedDataset,
  StageCriteria,
  StageKey,
  Task,
} from "../../lib/domain/types.js";
import { addDays, createRng, daysBetween, randomFloat, sequenceId } from "./rng.mts";
import {
  AGENT_SPECS,
  AGENT_VERSION_SPECS,
  DECISION_SPECS,
  DEFAULT_STAGES,
  HIGH_CONFIDENCE_THRESHOLD,
  JUDGMENT_SPECS,
  INCIDENT_SPECS,
  POLICY_VERSION_SPECS,
  REVIEWER,
  RULE_PACK_SPECS,
  SANDBOX_SPECS,
  SEED,
  TASK_SPECS,
  TODAY,
  type TaskSpec,
} from "./specs.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../seed");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`seed spec invalid: ${message}`);
}

/** Result labels per task. Kept minimal: enough to render, no more. */
const RESULT_LABELS: Record<string, [string, string]> = {
  "read-invoice-fields": ["fields-extracted", "fields-incomplete"],
  "classify-expense": ["category-software", "category-other"],
  "match-invoice-to-ledger": ["matched", "mismatched"],
  "detect-invoice-exceptions": ["exception-flagged", "exception-missed"],
  "routine-rule-application": ["treatment-b", "treatment-c"],
  "risk-detection": ["routine", "medium-risk"],
  "draft-tax-position": ["position-drafted", "position-revised"],
  "filing-readiness": ["ready", "not-ready"],
};

function resolveStages(
  overrides: Partial<Record<StageKey, Partial<StageCriteria>>> | undefined,
): Record<StageKey, StageCriteria> {
  const keys: StageKey[] = [
    "shadow_to_assisted",
    "assisted_to_supervised",
    "supervised_to_constrained",
  ];
  const out = {} as Record<StageKey, StageCriteria>;
  for (const key of keys) {
    out[key] = { ...DEFAULT_STAGES[key], ...(overrides?.[key] ?? {}) };
  }
  return out;
}

/** Builds every run and case for one task, honouring the declared counts exactly. */
function buildTaskRecords(
  spec: TaskSpec,
  rng: () => number,
  counters: { case: number; run: number; review: number },
): { cases: EvaluationCase[]; runs: AgentRun[]; reviews: HumanReview[] } {
  const labels = RESULT_LABELS[spec.task_id];
  assert(labels !== undefined, `${spec.task_id} has no result labels`);
  const [correctLabel, wrongLabel] = labels;

  const cases: EvaluationCase[] = [];
  const runs: AgentRun[] = [];

  const windowDays = Math.max(1, daysBetween(spec.evidence_window_start, TODAY) - 1);

  for (const b of spec.buckets) {
    assert(b.confident_wrong <= b.incorrect, `${spec.task_id}: confident_wrong exceeds incorrect`);
    assert(b.critical_errors <= b.incorrect, `${spec.task_id}: critical_errors exceeds incorrect`);
    assert(b.evidence_missing <= b.runs, `${spec.task_id}: evidence_missing exceeds runs`);
    assert(b.incorrect <= b.runs, `${spec.task_id}: incorrect exceeds runs`);

    for (let i = 0; i < b.runs; i += 1) {
      const isIncorrect = i < b.incorrect;
      const isConfidentWrong = i < b.confident_wrong;
      const isCritical = i < b.critical_errors;
      const evidencePresent = i >= b.evidence_missing;
      const isBoundaryViolation = i < b.boundary_violations;
      const isMissedException = i < b.missed_critical_exceptions;

      counters.case += 1;
      counters.run += 1;
      const caseId = sequenceId("CASE", counters.case);
      const runId = sequenceId("RUN", counters.run);

      // Confident-but-wrong is incorrect AND at or above the high-confidence
      // threshold, so an ordinary error must sit strictly below it.
      const confidence = isIncorrect
        ? isConfidentWrong
          ? randomFloat(rng, HIGH_CONFIDENCE_THRESHOLD, 0.985, 2)
          : randomFloat(rng, 0.55, HIGH_CONFIDENCE_THRESHOLD - 0.01, 2)
        : randomFloat(rng, 0.9, 0.995, 2);

      cases.push({
        case_id: caseId,
        task_id: spec.task_id,
        jurisdiction: b.jurisdiction,
        complexity: b.complexity,
        expected_result: correctLabel,
        critical_exception_expected: false,
        evidence_required: true,
      });

      runs.push({
        run_id: runId,
        case_id: caseId,
        task_id: spec.task_id,
        agent_version_id: spec.agent_version_id,
        autonomy_mode: spec.evidence_mode,
        agent_result: isIncorrect ? wrongLabel : correctLabel,
        confidence,
        correct: !isIncorrect,
        evidence_present: evidencePresent,
        agent_rule_version: spec.agent_rule_version,
        occurred_at: addDays(spec.evidence_window_start, Math.floor(rng() * windowDays)),
        critical_error: isCritical,
        post_execution_sampled: false,
        post_execution_error: false,
        boundary_violation: isBoundaryViolation,
        missed_critical_exception: isMissedException,
        escalation_expected: false,
      });
    }
  }

  // Post-execution sampling: spread across the window rather than clustered, so
  // the sample reads as a sample rather than as the first N cases.
  assert(spec.sampled <= runs.length, `${spec.task_id}: sampled exceeds runs`);
  assert(spec.sampled_errors <= spec.sampled, `${spec.task_id}: sampled_errors exceeds sampled`);
  const sampledIndexes: number[] = [];
  for (let i = 0; i < spec.sampled; i += 1) {
    sampledIndexes.push(Math.floor((i * runs.length) / Math.max(1, spec.sampled)));
  }
  sampledIndexes.forEach((runIndex, i) => {
    const run = runs[runIndex];
    if (!run) return;
    run.post_execution_sampled = true;
    if (i < spec.sampled_errors) run.post_execution_error = true;
  });

  // Cases that genuinely called for escalation sit at the end of the window.
  assert(
    spec.escalation_correct <= spec.escalation_expected,
    `${spec.task_id}: escalation_correct exceeds escalation_expected`,
  );
  const expectedEscalationIndexes: number[] = [];
  for (let i = 0; i < spec.escalation_expected; i += 1) {
    const runIndex = runs.length - 1 - i;
    if (runIndex < 0) break;
    expectedEscalationIndexes.push(runIndex);
    const run = runs[runIndex];
    const relatedCase = cases[runIndex];
    if (run) run.escalation_expected = true;
    if (relatedCase) relatedCase.critical_exception_expected = true;
  }

  // Reviews. Correct escalations land on cases that actually required escalation;
  // anything left over is an escalation of a case that did not need one.
  const totalReviews = spec.reviewed_accepted + spec.reviewed_overridden + spec.reviewed_escalated;
  assert(totalReviews <= runs.length, `${spec.task_id}: reviews exceed runs`);

  const reviews: HumanReview[] = [];
  const claimed = new Set<number>();

  const addReview = (
    runIndex: number,
    disposition: HumanReview["disposition"],
    note: string | null,
  ) => {
    const run = runs[runIndex];
    if (!run) return;
    counters.review += 1;
    reviews.push({
      review_id: sequenceId("REV", counters.review),
      run_id: run.run_id,
      task_id: spec.task_id,
      disposition,
      changed_result: disposition === "overridden",
      reviewer: REVIEWER,
      note,
    });
    claimed.add(runIndex);
  };

  let escalationsPlaced = 0;
  for (const runIndex of expectedEscalationIndexes) {
    if (escalationsPlaced >= spec.escalation_correct) break;
    addReview(runIndex, "escalated", "Routed for additional review.");
    escalationsPlaced += 1;
  }
  for (let runIndex = 0; escalationsPlaced < spec.reviewed_escalated; runIndex += 1) {
    if (runIndex >= runs.length) break;
    if (claimed.has(runIndex)) continue;
    addReview(runIndex, "escalated", "Routed for additional review.");
    escalationsPlaced += 1;
  }

  let overridesPlaced = 0;
  let acceptancesPlaced = 0;
  for (let runIndex = 0; runIndex < runs.length; runIndex += 1) {
    if (claimed.has(runIndex)) continue;
    if (overridesPlaced < spec.reviewed_overridden) {
      addReview(runIndex, "overridden", "Substantive result changed by the reviewer.");
      overridesPlaced += 1;
      continue;
    }
    if (acceptancesPlaced < spec.reviewed_accepted) {
      addReview(runIndex, "accepted", null);
      acceptancesPlaced += 1;
    }
    if (
      overridesPlaced >= spec.reviewed_overridden &&
      acceptancesPlaced >= spec.reviewed_accepted
    ) {
      break;
    }
  }

  assert(
    overridesPlaced === spec.reviewed_overridden && acceptancesPlaced === spec.reviewed_accepted,
    `${spec.task_id}: could not place all declared reviews`,
  );

  return { cases, runs, reviews };
}

function build(): SeedDataset {
  const rng = createRng(SEED);
  const counters = { case: 0, run: 0, review: 0 };

  const agents: Agent[] = AGENT_SPECS.map((a) => ({ ...a }));
  const agent_versions: AgentVersion[] = AGENT_VERSION_SPECS.map((v) => ({ ...v }));

  const rule_packs: RulePack[] = [];
  const rule_versions: RuleVersion[] = [];
  for (const pack of RULE_PACK_SPECS) {
    rule_packs.push({
      rule_pack_id: pack.rule_pack_id,
      task_id: pack.task_id,
      name: pack.name,
    });
    pack.versions.forEach((version, index) => {
      rule_versions.push({
        rule_version_id: `${pack.rule_pack_id}-${version.version}`,
        rule_pack_id: pack.rule_pack_id,
        version: version.version,
        effective_from: version.effective_from,
        current: index === pack.versions.length - 1,
      });
    });
  }

  const policy_versions: PolicyVersion[] = POLICY_VERSION_SPECS.map((p) => ({
    policy_version_id: `${p.task_id}-policy-${p.version}`,
    task_id: p.task_id,
    version: p.version,
    active: p.active,
    created_at: p.created_at,
    change_note: p.change_note,
    high_confidence_threshold: HIGH_CONFIDENCE_THRESHOLD,
    stages: resolveStages(p.overrides),
  }));

  const tasks: Task[] = [];
  const cases: EvaluationCase[] = [];
  const runs: AgentRun[] = [];
  const reviews: HumanReview[] = [];

  for (const spec of TASK_SPECS) {
    const policy = policy_versions.find(
      (p) => p.task_id === spec.task_id && p.version === spec.policy_version,
    );
    assert(policy !== undefined, `${spec.task_id}: no policy version ${spec.policy_version}`);
    assert(policy.active, `${spec.task_id}: policy ${spec.policy_version} is not the active one`);

    tasks.push({
      task_id: spec.task_id,
      agent_id: spec.agent_id,
      name: spec.name,
      description: spec.description,
      autonomy_ceiling: spec.autonomy_ceiling,
      current_level: spec.current_level,
      operational_state: spec.operational_state,
      approved_scope: spec.approved_scope,
      rule_pack_id: spec.rule_pack_id,
      agent_rule_version: spec.agent_rule_version,
      evaluator_rule_version: spec.evaluator_rule_version,
      agent_version_id: spec.agent_version_id,
      policy_version_id: policy.policy_version_id,
      material_change_pending: spec.material_change_pending,
      evidence_window_start: spec.evidence_window_start,
      state_note: spec.state_note,
    });

    const built = buildTaskRecords(spec, rng, counters);
    cases.push(...built.cases);
    runs.push(...built.runs);
    reviews.push(...built.reviews);
  }

  const judgments: JevJudgment[] = JUDGMENT_SPECS.map((spec) => {
    const taskRuns = runs.filter((r) => r.task_id === spec.task_id);
    const run = taskRuns[spec.run_index];
    assert(run !== undefined, `${spec.judgment_id}: run_index ${spec.run_index} is out of range`);
    return {
      judgment_id: spec.judgment_id,
      run_id: run.run_id,
      task_id: spec.task_id,
      question_id: spec.question_id,
      result: spec.result,
      confidence: spec.confidence,
      requires_human_confirmation: spec.requires_human_confirmation,
      human_confirmed_result: spec.human_confirmed_result,
      reviewer_note: spec.reviewer_note,
    };
  });

  const decisions: AutonomyDecision[] = DECISION_SPECS.map((spec) => {
    const snapshot: MetricSnapshot = {
      task_id: spec.task_id,
      autonomy_mode: spec.snapshot_mode,
      ...spec.snapshot,
    };
    return {
      decision_id: spec.decision_id,
      task_id: spec.task_id,
      decided_at: spec.decided_at,
      current_level: spec.current_level,
      recommended_level: spec.recommended_level,
      recommendation_code: spec.recommendation_code,
      final_level: spec.final_level,
      outcome: spec.outcome,
      was_override: spec.was_override,
      scope: spec.scope,
      decided_by: REVIEWER,
      reason: spec.reason,
      policy_version: spec.policy_version,
      agent_version: spec.agent_version,
      rule_version: spec.rule_version,
      evaluator_rule_version: spec.evaluator_rule_version,
      snapshot,
      confirmed_classifications: spec.confirmed_classifications,
    };
  });

  const sandbox_validations: SandboxValidation[] = SANDBOX_SPECS.map((spec) => ({
    ...spec,
    evaluated_case_count: TASK_SPECS.find((t) => t.task_id === spec.task_id)?.buckets.reduce(
      (sum, b) => sum + b.runs,
      0,
    ) as number,
    coverage_groups: spec.coverage_groups.map((g) => ({ ...g })),
  }));

  const incidents: Incident[] = INCIDENT_SPECS.map((i) => ({ ...i }));

  const audit_events: AuditEvent[] = [];
  const levelLabel = (level: string) =>
    ({ shadow: "L1 · Shadow", assisted: "L2 · Assisted", supervised: "L3 · Supervised", constrained: "L4 · Constrained" })[
      level
    ] ?? level;

  for (const decision of decisions) {
    const isSandbox = decision.recommendation_code === "CONTINUE_PREVIOUS_FOR_VALIDATED_SCOPE";
    audit_events.push({
      event_id: `EVT-${decision.decision_id}`,
      occurred_at: decision.decided_at,
      type: isSandbox ? "sandbox-revalidation" : "autonomy-decision",
      task_id: decision.task_id,
      summary: isSandbox ? "Sandbox revalidation" : "Autonomy decision",
      change_from: levelLabel(decision.current_level),
      change_to:
        decision.outcome === "recommendation-declined"
          ? `Retained ${levelLabel(decision.final_level)}`
          : levelLabel(decision.final_level),
      actor: decision.decided_by,
      status:
        decision.outcome === "recommendation-declined"
          ? "Recommendation declined"
          : decision.outcome === "approved"
            ? "Approved"
            : "Recorded",
      decision_id: decision.decision_id,
      policy_version: decision.policy_version,
    });
  }

  // Policy changes: every version after a task's first one is a recorded change.
  const byTask = new Map<string, PolicyVersion[]>();
  for (const policy of policy_versions) {
    const list = byTask.get(policy.task_id) ?? [];
    list.push(policy);
    byTask.set(policy.task_id, list);
  }
  for (const [taskId, list] of byTask) {
    const ordered = [...list].sort((a, b) => a.version.localeCompare(b.version));
    ordered.forEach((policy, index) => {
      if (index === 0) return;
      const previous = ordered[index - 1];
      if (!previous) return;
      audit_events.push({
        event_id: `EVT-POL-${taskId}-${policy.version}`,
        occurred_at: policy.created_at,
        type: "policy-change",
        task_id: taskId,
        summary: "Policy change",
        change_from: `Policy v${previous.version}`,
        change_to: `Policy v${policy.version}`,
        actor: REVIEWER,
        status: policy.active ? "Active" : "Superseded",
        decision_id: null,
        policy_version: policy.version,
      });
    });
  }

  for (const incident of incidents) {
    audit_events.push({
      event_id: `EVT-${incident.incident_id}`,
      occurred_at: incident.opened_at,
      type: "version-issue",
      task_id: incident.task_id,
      summary: "Version issue",
      change_from: "Evaluation active",
      change_to: "Evaluation paused",
      actor: "System",
      status: "Needs attention",
      decision_id: null,
      policy_version:
        tasks.find((t) => t.task_id === incident.task_id)?.policy_version_id.split("-policy-")[1] ??
        "",
    });
  }

  for (const sandbox of sandbox_validations) {
    audit_events.push({
      event_id: `EVT-${sandbox.sandbox_id}`,
      occurred_at: sandbox.opened_at,
      type: "sandbox-revalidation",
      task_id: sandbox.task_id,
      summary: "Sandbox revalidation opened",
      change_from: levelLabel(sandbox.previous_level),
      change_to: `${levelLabel(sandbox.sandbox_level)} validation`,
      actor: "System",
      status: "Pending decision",
      decision_id: null,
      policy_version:
        tasks.find((t) => t.task_id === sandbox.task_id)?.policy_version_id.split("-policy-")[1] ??
        "",
    });
  }

  audit_events.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return {
    generated_at: TODAY,
    seed: SEED,
    agents,
    tasks,
    agent_versions,
    rule_packs,
    rule_versions,
    policy_versions,
    cases,
    runs,
    reviews,
    judgments,
    decisions,
    sandbox_validations,
    incidents,
    audit_events,
  };
}

function main(): void {
  const dataset = build();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, "dataset.json"), `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

  const byTask = new Map<string, number>();
  for (const run of dataset.runs) {
    byTask.set(run.task_id, (byTask.get(run.task_id) ?? 0) + 1);
  }
  console.log(`seed ${dataset.seed} -> data/seed/dataset.json`);
  console.log(
    `  ${dataset.tasks.length} tasks, ${dataset.cases.length} cases, ${dataset.runs.length} runs, ` +
      `${dataset.reviews.length} reviews, ${dataset.decisions.length} decisions, ` +
      `${dataset.audit_events.length} audit events`,
  );
  for (const [taskId, count] of byTask) {
    console.log(`  ${taskId.padEnd(28)} ${String(count).padStart(4)} runs`);
  }
}

main();
