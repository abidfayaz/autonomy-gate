import { evaluateSeededTask, reachableLevels } from "@/lib/data/evaluation";
import {
  agents,
  incidents,
  sandboxValidations,
  tasks,
  tasksForAgent,
} from "@/lib/data/seed";
import type { AutonomyLevel, OperationalState } from "@/lib/domain/types";
import { AUTONOMY_LABELS, OPERATIONAL_STATE_LABELS } from "@/lib/domain/vocabulary";
import { REASON_CODES, type ReasonCode } from "@/lib/engine";

/**
 * View model for Agents & Tasks.
 *
 * Built on the server so the raw run list never reaches the browser, and derived
 * entirely from task state plus engine output: no count on this screen is typed
 * in by hand, which is what went wrong in the reference mockups.
 */

export type SignalTone = "positive" | "neutral" | "warning" | "critical";

export interface TaskRowView {
  task_id: string;
  name: string;
  description: string;
  level: AutonomyLevel;
  level_label: string;
  state: OperationalState;
  state_label: string;
  /** Short note explaining an unusual operational state. */
  state_note: string | null;
  /**
   * The recommendation, shown separately from operational state. Being ready for
   * promotion is something the system suggests, not a state the task is in.
   */
  signal: string | null;
  signal_tone: SignalTone;
}

export interface AgentView {
  agent_id: string;
  name: string;
  description: string;
  icon: string;
  tasks: TaskRowView[];
  /** e.g. "4 tasks · 2 healthy · 1 paused · 1 in sandbox" */
  summary: string;
}

export interface SandboxTeaserView {
  task_id: string;
  task_name: string;
  agent_name: string;
  previous_level_label: string;
  candidate_level_label: string;
  evaluated: number;
  planned: number;
  percent: number;
}

export interface AlertView {
  task_id: string;
  task_name: string;
  agent_name: string;
  headline: string;
  detail: string;
}

export interface Screen1View {
  summary: {
    agent_count: number;
    task_count: number;
    needs_attention: number;
    sandbox_count: number;
  };
  agents: AgentView[];
  alerts: AlertView[];
  sandbox: SandboxTeaserView | null;
  filter: TaskFilter;
  filter_counts: Record<TaskFilter, number>;
}

export type TaskFilter = "all" | "attention" | "sandbox";

export const TASK_FILTERS: Array<{ key: TaskFilter; label: string }> = [
  { key: "all", label: "All tasks" },
  { key: "attention", label: "Needs attention" },
  { key: "sandbox", label: "Sandbox" },
];

/**
 * Needs Attention counts Paused and Needs Review. Sandbox has its own indicator,
 * so counting it here as well would double-count the same task.
 */
function isNeedsAttention(state: OperationalState): boolean {
  return state === "paused" || state === "needs-review";
}

function signalFor(
  code: ReasonCode,
  level: AutonomyLevel,
): { signal: string | null; tone: SignalTone } {
  switch (code) {
    case REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL:
      return { signal: "Eligible for promotion", tone: "positive" };
    case REASON_CODES.HOLD_CONFIDENT_WRONG_RATE:
    case REASON_CODES.REMAIN_AT_CURRENT_LEVEL:
      return { signal: `Remain ${AUTONOMY_LABELS[level].name}`, tone: "neutral" };
    case REASON_CODES.PAUSED_RULE_VERSION_MISMATCH:
      return { signal: "Rule-version mismatch", tone: "critical" };
    case REASON_CODES.SANDBOX_REVALIDATION_REQUIRED:
      return { signal: "Revalidation in progress", tone: "warning" };
    case REASON_CODES.RESTRICT_SCOPE:
      return { signal: "Restrict scope", tone: "warning" };
    case REASON_CODES.ROLLBACK_RECOMMENDED:
      return { signal: "Rollback recommended", tone: "critical" };
    case REASON_CODES.BLOCKED_CRITICAL_ERROR:
    case REASON_CODES.BLOCKED_OPEN_INCIDENT:
      return { signal: "Blocking issue", tone: "critical" };
    // A task short of stage evidence, or already at its ceiling, has nothing
    // outstanding to report. Saying so would be noise.
    case REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE:
    case REASON_CODES.HOLD_EVIDENCE_COVERAGE:
    case REASON_CODES.AT_AUTONOMY_CEILING:
      return { signal: null, tone: "neutral" };
    default:
      return { signal: null, tone: "neutral" };
  }
}

export function buildRow(taskId: string, levelOverride?: AutonomyLevel): TaskRowView | null {
  const task = tasks.find((item) => item.task_id === taskId);
  if (!task) return null;
  const level = levelOverride ?? task.current_level;
  const result = evaluateSeededTask(taskId, { current_level: level });
  const { signal, tone } = result
    ? signalFor(result.recommendation.code, level)
    : { signal: null, tone: "neutral" as SignalTone };

  return {
    task_id: task.task_id,
    name: task.name,
    description: task.description,
    level,
    level_label: AUTONOMY_LABELS[level].label,
    state: task.operational_state,
    state_label: OPERATIONAL_STATE_LABELS[task.operational_state],
    state_note: task.state_note,
    signal,
    signal_tone: tone,
  };
}

function summarise(rows: TaskRowView[]): string {
  const counts = new Map<OperationalState, number>();
  for (const row of rows) counts.set(row.state, (counts.get(row.state) ?? 0) + 1);

  const parts = [`${rows.length} ${rows.length === 1 ? "task" : "tasks"}`];
  const phrasing: Array<[OperationalState, (n: number) => string]> = [
    ["healthy", (n) => `${n} healthy`],
    ["needs-review", (n) => `${n} needs review`],
    ["paused", (n) => `${n} paused`],
    ["sandbox", (n) => `${n} in sandbox`],
  ];
  for (const [state, phrase] of phrasing) {
    const count = counts.get(state);
    if (count) parts.push(phrase(count));
  }
  return parts.join(" · ");
}

export function buildScreen1View(filter: TaskFilter = "all"): Screen1View {
  const allRows = tasks
    .map((task) => buildRow(task.task_id))
    .filter((row): row is TaskRowView => row !== null);

  const matches = (row: TaskRowView): boolean => {
    if (filter === "attention") return isNeedsAttention(row.state);
    if (filter === "sandbox") return row.state === "sandbox";
    return true;
  };

  const agentViews: AgentView[] = agents
    .map((agent) => {
      const agentRows = tasksForAgent(agent.agent_id)
        .map((task) => allRows.find((row) => row.task_id === task.task_id))
        .filter((row): row is TaskRowView => row !== undefined);
      return {
        agent_id: agent.agent_id,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        // The summary always describes the agent's whole set of tasks, so a
        // filtered view never misrepresents how the agent is actually doing.
        summary: summarise(agentRows),
        tasks: agentRows.filter(matches),
      };
    })
    .filter((agent) => agent.tasks.length > 0);

  const alerts: AlertView[] = incidents
    .filter((incident) => incident.status === "open" && incident.blocking)
    .map((incident) => {
      const task = tasks.find((item) => item.task_id === incident.task_id);
      const agent = agents.find((item) => item.agent_id === task?.agent_id);
      return {
        task_id: incident.task_id,
        task_name: task?.name ?? incident.task_id,
        agent_name: agent?.name ?? "",
        headline: "Evaluation paused",
        detail: incident.summary,
      };
    });

  const sandboxRecord = sandboxValidations[0];
  const sandboxTask = sandboxRecord
    ? tasks.find((item) => item.task_id === sandboxRecord.task_id)
    : undefined;
  const sandboxAgent = sandboxTask
    ? agents.find((item) => item.agent_id === sandboxTask.agent_id)
    : undefined;

  const sandbox: SandboxTeaserView | null =
    sandboxRecord && sandboxTask
      ? {
          task_id: sandboxRecord.task_id,
          task_name: sandboxTask.name,
          agent_name: sandboxAgent?.name ?? "",
          previous_level_label: AUTONOMY_LABELS[sandboxRecord.previous_level].label,
          candidate_level_label: AUTONOMY_LABELS[sandboxRecord.sandbox_level].label,
          evaluated: sandboxRecord.evaluated_case_count,
          planned: sandboxRecord.planned_case_count,
          percent: Math.round(
            (sandboxRecord.evaluated_case_count / sandboxRecord.planned_case_count) * 100,
          ),
        }
      : null;

  return {
    summary: {
      agent_count: agents.length,
      task_count: allRows.length,
      needs_attention: allRows.filter((row) => isNeedsAttention(row.state)).length,
      sandbox_count: allRows.filter((row) => row.state === "sandbox").length,
    },
    agents: agentViews,
    alerts,
    sandbox,
    filter,
    filter_counts: {
      all: allRows.length,
      attention: allRows.filter((row) => isNeedsAttention(row.state)).length,
      sandbox: allRows.filter((row) => row.state === "sandbox").length,
    },
  };
}

export function parseTaskFilter(value: string | string[] | undefined): TaskFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "attention" || candidate === "sandbox" ? candidate : "all";
}

/**
 * Every task row, precomputed at every level that task could hold.
 *
 * The browser cannot evaluate anything: the run records stay on the server. So
 * the server computes each reachable outcome ahead of time and the client picks
 * the one matching this visitor's decisions. Eight tasks and four levels is a
 * small table, and it keeps the evidence out of the bundle.
 */
export type TaskRowVariants = Record<string, Partial<Record<AutonomyLevel, TaskRowView>>>;

export function buildTaskRowVariants(): TaskRowVariants {
  const variants: TaskRowVariants = {};
  for (const task of tasks) {
    const byLevel: Partial<Record<AutonomyLevel, TaskRowView>> = {};
    for (const level of reachableLevels(task.task_id)) {
      const row = buildRow(task.task_id, level);
      if (row) byLevel[level] = row;
    }
    variants[task.task_id] = byLevel;
  }
  return variants;
}
