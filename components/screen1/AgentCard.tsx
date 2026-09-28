import Link from "next/link";
import { AutonomyBadge, SignalBadge, StateBadge } from "@/components/Badges";
import { Icon } from "@/components/Icon";
import type { AgentView } from "@/lib/view/agentsAndTasks";

/**
 * One agent and its tasks.
 *
 * The agent has a name, a description and a count of how its tasks are doing.
 * It deliberately has no autonomy level of its own: there is nowhere on this
 * card for one to go, which is the product's whole argument made structural.
 */
export function AgentCard({ agent }: { agent: AgentView }) {
  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-low">
      <header className="flex flex-wrap items-start gap-space-md border-b border-outline-variant/40 px-space-lg py-space-md">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
          <Icon name={agent.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {agent.name}
          </h2>
          <p className="mt-space-xs font-body-md text-body-md text-on-surface-variant">
            {agent.description}
          </p>
        </div>
        <p className="font-label-md text-label-md text-on-surface-variant">
          {agent.summary}
        </p>
      </header>

      {/* Below wide screens the table scrolls rather than crushing its columns:
          an autonomy level squeezed onto three lines is harder to read, not smaller. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/30 bg-surface-container-lowest/40">
              <th
                scope="col"
                className="px-space-lg py-space-sm font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant"
              >
                Task
              </th>
              <th
                scope="col"
                className="px-space-md py-space-sm font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant"
              >
                Autonomy level
              </th>
              <th
                scope="col"
                className="px-space-md py-space-sm font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant"
              >
                Operational status
              </th>
              <th
                scope="col"
                className="px-space-md py-space-sm font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant"
              >
                Recommendation
              </th>
              <th scope="col" className="px-space-lg py-space-sm">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {agent.tasks.map((task) => (
              <tr
                key={task.task_id}
                className="border-b border-outline-variant/20 last:border-b-0 hover:bg-surface-container/50"
              >
                <td className="px-space-lg py-space-md align-top">
                  <p className="font-body-md text-body-md text-on-surface">
                    {task.name}
                  </p>
                  <p className="mt-1 max-w-sm font-body-md text-body-sm text-on-surface-variant">
                    {task.description}
                  </p>
                  {task.state_note ? (
                    <p className="mt-space-xs max-w-sm font-body-md text-body-sm text-error">
                      {task.state_note}
                    </p>
                  ) : null}
                </td>
                <td className="px-space-md py-space-md align-top">
                  <AutonomyBadge level={task.level} />
                </td>
                <td className="px-space-md py-space-md align-top">
                  <StateBadge state={task.state} label={task.state_label} />
                </td>
                <td className="px-space-md py-space-md align-top">
                  {task.signal ? (
                    <SignalBadge signal={task.signal} tone={task.signal_tone} />
                  ) : (
                    <span className="font-body-md text-body-sm text-outline">
                      &mdash;
                    </span>
                  )}
                </td>
                <td className="px-space-lg py-space-md align-top text-right">
                  <Link
                    href={`/tasks/${task.task_id}`}
                    className="inline-flex items-center gap-space-xs whitespace-nowrap rounded-lg px-space-sm py-space-xs font-body-md text-body-sm text-primary transition-colors hover:bg-surface-container-high"
                  >
                    View scorecard
                    <Icon
                      name="arrow_forward"
                      className="text-[16px] leading-none"
                    />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
