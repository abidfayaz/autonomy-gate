import dataset from "@/data/seed/dataset.json";
import type {
  Agent,
  AgentRun,
  AuditEvent,
  AutonomyDecision,
  EvaluationCase,
  HumanReview,
  Incident,
  JevJudgment,
  PolicyVersion,
  RulePack,
  RuleVersion,
  SandboxValidation,
  SeedDataset,
  Task,
} from "@/lib/domain/types";

/**
 * The canonical seeded dataset.
 *
 * Bundled and immutable. Visitor changes are held separately (Phase 5) and layered
 * on top, so `Reset demo` is a matter of dropping those changes rather than
 * rebuilding anything. Nothing writes here at runtime.
 *
 * Read this on the server and pass derived view models to the client: the raw run
 * list is roughly 1.4 MB and has no business crossing into a browser bundle.
 */
export const SEED_DATASET = dataset as unknown as SeedDataset;

export const agents: readonly Agent[] = SEED_DATASET.agents;
export const tasks: readonly Task[] = SEED_DATASET.tasks;
export const rulePacks: readonly RulePack[] = SEED_DATASET.rule_packs;
export const ruleVersions: readonly RuleVersion[] = SEED_DATASET.rule_versions;
export const policyVersions: readonly PolicyVersion[] = SEED_DATASET.policy_versions;
export const cases: readonly EvaluationCase[] = SEED_DATASET.cases;
export const runs: readonly AgentRun[] = SEED_DATASET.runs;
export const reviews: readonly HumanReview[] = SEED_DATASET.reviews;
export const judgments: readonly JevJudgment[] = SEED_DATASET.judgments;
export const decisions: readonly AutonomyDecision[] = SEED_DATASET.decisions;
export const sandboxValidations: readonly SandboxValidation[] = SEED_DATASET.sandbox_validations;
export const incidents: readonly Incident[] = SEED_DATASET.incidents;
export const auditEvents: readonly AuditEvent[] = SEED_DATASET.audit_events;

export function getTask(taskId: string): Task | undefined {
  return tasks.find((task) => task.task_id === taskId);
}

export function getAgent(agentId: string): Agent | undefined {
  return agents.find((agent) => agent.agent_id === agentId);
}

export function tasksForAgent(agentId: string): Task[] {
  return tasks.filter((task) => task.agent_id === agentId);
}

/** The active policy for a task. Historical versions are reached by version string. */
export function activePolicyForTask(taskId: string): PolicyVersion | undefined {
  return policyVersions.find((policy) => policy.task_id === taskId && policy.active);
}

export function policyHistoryForTask(taskId: string): PolicyVersion[] {
  return policyVersions
    .filter((policy) => policy.task_id === taskId)
    .sort((a, b) => b.version.localeCompare(a.version));
}

/** The rule version currently in force for a task's own rule pack. */
export function currentRuleVersionForTask(taskId: string): RuleVersion | undefined {
  const pack = rulePacks.find((rulePack) => rulePack.task_id === taskId);
  if (!pack) return undefined;
  return ruleVersions.find(
    (version) => version.rule_pack_id === pack.rule_pack_id && version.current,
  );
}

export function runsForTask(taskId: string): AgentRun[] {
  return runs.filter((run) => run.task_id === taskId);
}

export function reviewsForTask(taskId: string): HumanReview[] {
  return reviews.filter((review) => review.task_id === taskId);
}

export function casesForTask(taskId: string): EvaluationCase[] {
  return cases.filter((evaluationCase) => evaluationCase.task_id === taskId);
}

export function judgmentsForTask(taskId: string): JevJudgment[] {
  return judgments.filter((judgment) => judgment.task_id === taskId);
}

export function openIncidentsForTask(taskId: string): Incident[] {
  return incidents.filter(
    (incident) => incident.task_id === taskId && incident.status === "open",
  );
}

export function sandboxForTask(taskId: string): SandboxValidation | undefined {
  return sandboxValidations.find((sandbox) => sandbox.task_id === taskId);
}
