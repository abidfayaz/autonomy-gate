import { Icon } from "@/components/Icon";
import { AgentsClient } from "@/components/screen1/AgentsClient";
import { LevelLegend, SandboxTeaser } from "@/components/screen1/Panels";
import {
  buildScreen1View,
  buildTaskRowVariants,
  parseTaskFilter,
} from "@/lib/view/agentsAndTasks";

/**
 * Screen 1 - Agents & Tasks.
 *
 * A Server Component: the seeded run list stays on the server and only the view
 * model is rendered. Filtering runs through the URL rather than client state, so
 * a filtered view is shareable and the page ships no data to the browser.
 */
export default async function AgentsAndTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const { filter } = await searchParams;
  const view = buildScreen1View(parseTaskFilter(filter));
  const variants = buildTaskRowVariants();

  return (
    <div className="space-y-space-xl py-space-md">
      <header>
        <div className="flex flex-wrap items-center gap-space-md">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Governance domain: Financial accounting
          </p>
          <span className="inline-flex items-center gap-space-xs rounded-full border border-outline-variant/50 px-space-sm py-space-xs font-body-md text-body-sm text-on-surface-variant">
            <Icon name="info" className="text-[14px] leading-none" />
            Synthetic prototype data
          </span>
        </div>
        <h1 className="mt-space-sm font-headline-xl text-headline-xl text-on-surface">
          AI agents
        </h1>
        <p className="mt-space-sm max-w-3xl font-body-md text-body-lg text-on-surface-variant">
          Autonomy is evaluated separately for each task. A task can earn more freedom only when
          its evidence, risk and current rules support it.
        </p>
      </header>

      <AgentsClient view={view} variants={variants} />

      {view.sandbox ? <SandboxTeaser sandbox={view.sandbox} /> : null}

      <LevelLegend />
    </div>
  );
}
