import {
  activePolicyForTask,
  casesForTask,
  currentRuleVersionForTask,
  getTask,
  judgmentsForTask,
  openIncidentsForTask,
  reviewsForTask,
  runsForTask,
  tasks,
} from "@/lib/data/seed";
import type { ApprovedScope, AutonomyLevel } from "@/lib/domain/types";
import { evaluateTask, type EvaluationInput, type EvaluationResult } from "@/lib/engine";

/**
 * Assembles engine input from the seeded dataset.
 *
 * This adapter exists so the engine never imports data. It also accepts
 * overrides, which is how a visitor's recorded decision is applied: the seed is
 * never mutated, the task is simply evaluated as though it held the level that
 * decision left it at.
 */

export interface TaskOverrides {
  current_level?: AutonomyLevel;
  approved_scope?: ApprovedScope | null;
}

export function buildEvaluationInput(
  taskId: string,
  overrides: TaskOverrides = {},
): EvaluationInput | null {
  const seededTask = getTask(taskId);
  if (!seededTask) return null;

  const policy = activePolicyForTask(taskId);
  if (!policy) return null;

  const currentRuleVersion = currentRuleVersionForTask(taskId)?.version;
  if (currentRuleVersion === undefined) return null;

  const task = {
    ...seededTask,
    ...(overrides.current_level ? { current_level: overrides.current_level } : {}),
    ...(overrides.approved_scope !== undefined
      ? { approved_scope: overrides.approved_scope }
      : {}),
  };

  return {
    task,
    policy,
    currentRuleVersion,
    runs: runsForTask(taskId),
    reviews: reviewsForTask(taskId),
    cases: casesForTask(taskId),
    judgments: judgmentsForTask(taskId),
    openIncidents: openIncidentsForTask(taskId),
  };
}

export function evaluateSeededTask(
  taskId: string,
  overrides: TaskOverrides = {},
): EvaluationResult | null {
  const input = buildEvaluationInput(taskId, overrides);
  return input ? evaluateTask(input) : null;
}

export function evaluateAllSeededTasks(): EvaluationResult[] {
  return tasks
    .map((task) => evaluateSeededTask(task.task_id))
    .filter((result): result is EvaluationResult => result !== null);
}

/** Every level a task could hold, from Shadow up to its own ceiling. */
export function reachableLevels(taskId: string): AutonomyLevel[] {
  const task = getTask(taskId);
  if (!task) return [];
  const order: AutonomyLevel[] = ["shadow", "assisted", "supervised", "constrained"];
  const ceiling = order.indexOf(task.autonomy_ceiling);
  return order.slice(0, ceiling + 1);
}
