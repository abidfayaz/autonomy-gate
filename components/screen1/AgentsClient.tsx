"use client";

import { AgentCard } from "@/components/screen1/AgentCard";
import {
  FilterTabs,
  PolicyAlert,
  SummaryCards,
} from "@/components/screen1/Panels";
import { effectiveLevel } from "@/lib/state/demoState";
import { useDemoState } from "@/lib/state/DemoStateProvider";
import type { Screen1View, TaskRowVariants } from "@/lib/view/agentsAndTasks";

/**
 * Applies this visitor's decisions on top of the seeded view.
 *
 * The browser has no evidence to evaluate, so it does not try: the server
 * precomputed a row for every level each task could hold, and this picks the one
 * that matches. The 1.4 MB of run records never leaves the server.
 */
export function AgentsClient({
  view,
  variants,
}: {
  view: Screen1View;
  variants: TaskRowVariants;
}) {
  const { state } = useDemoState();

  const agents = view.agents.map((agent) => ({
    ...agent,
    tasks: agent.tasks.map((task) => {
      const level = effectiveLevel(state, task.task_id, task.level);
      return variants[task.task_id]?.[level] ?? task;
    }),
  }));

  return (
    <>
      <SummaryCards summary={view.summary} />
      <PolicyAlert alerts={view.alerts} />
      <section className="space-y-space-lg">
        <FilterTabs active={view.filter} counts={view.filter_counts} />
        {agents.length > 0 ? (
          agents.map((agent) => <AgentCard key={agent.agent_id} agent={agent} />)
        ) : (
          <p className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg font-body-md text-body-md text-on-surface-variant">
            No tasks match this filter.
          </p>
        )}
      </section>
    </>
  );
}
