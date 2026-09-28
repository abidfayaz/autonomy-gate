import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { AutonomyLevel } from "@/lib/domain/types";
import { AUTONOMY_DESCRIPTIONS, AUTONOMY_LABELS } from "@/lib/domain/vocabulary";
import type {
  AlertView,
  SandboxTeaserView,
  Screen1View,
  TaskFilter,
} from "@/lib/view/agentsAndTasks";
import { TASK_FILTERS } from "@/lib/view/agentsAndTasks";

/** Summary tiles. Every number is counted from task state, never written down. */
export function SummaryCards({ summary }: { summary: Screen1View["summary"] }) {
  const cards = [
    {
      icon: "smart_toy",
      value: summary.agent_count,
      label: "AI agents",
      caption: "Active agents in this prototype",
    },
    {
      icon: "account_tree",
      value: summary.task_count,
      label: "Tasks",
      caption: "Each evaluated separately",
    },
    {
      icon: "flag",
      value: summary.needs_attention,
      label: "Needs attention",
      caption:
        summary.needs_attention === 1 ? "1 task requires review" : `${summary.needs_attention} tasks require review`,
    },
    {
      icon: "science",
      value: summary.sandbox_count,
      label: "Sandbox validations",
      caption:
        summary.sandbox_count === 1
          ? "1 task being revalidated"
          : `${summary.sandbox_count} tasks being revalidated`,
    },
  ];

  return (
    <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-md"
        >
          <div className="flex items-center justify-between">
            <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
              {card.label}
            </p>
            <Icon name={card.icon} className="text-on-surface-variant" />
          </div>
          <p className="mt-space-sm font-headline-xl text-headline-xl text-on-surface">
            {card.value}
          </p>
          <p className="mt-1 font-body-md text-body-sm text-on-surface-variant">{card.caption}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Filters are links rather than buttons, so the view is shareable and the whole
 * screen stays server-rendered.
 */
export function FilterTabs({
  active,
  counts,
}: {
  active: TaskFilter;
  counts: Record<TaskFilter, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-space-xs" role="group" aria-label="Filter tasks">
      {TASK_FILTERS.map((filter) => {
        const selected = filter.key === active;
        return (
          <Link
            key={filter.key}
            href={filter.key === "all" ? "/" : `/?filter=${filter.key}`}
            aria-current={selected ? "true" : undefined}
            className={`rounded-full border px-space-md py-space-xs font-body-md text-body-sm transition-colors ${
              selected
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-outline-variant/50 text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {filter.label} ({counts[filter.key]})
          </Link>
        );
      })}
    </div>
  );
}

export function PolicyAlert({ alerts }: { alerts: AlertView[] }) {
  if (alerts.length === 0) return null;
  const count = alerts.length;
  return (
    <section className="rounded-xl border border-error/40 bg-error/5 p-space-lg">
      <div className="flex items-center gap-space-sm">
        <Icon name="gavel" className="text-error" />
        <h2 className="font-body-md text-body-md text-error">
          {count === 1 ? "1 policy issue requires attention" : `${count} policy issues require attention`}
        </h2>
      </div>
      {alerts.map((alert) => (
        <div key={alert.task_id} className="mt-space-md">
          <p className="font-headline-sm text-headline-sm text-on-surface">{alert.headline}</p>
          <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
            {alert.agent_name}&rsquo;s {alert.task_name} task: {alert.detail} Evaluation for this
            task is paused until the versions are aligned.
          </p>
          <Link
            href={`/tasks/${alert.task_id}`}
            className="mt-space-sm inline-flex items-center gap-space-xs font-body-md text-body-sm text-primary hover:underline"
          >
            Review issue
            <Icon name="arrow_forward" className="text-[16px] leading-none" />
          </Link>
        </div>
      ))}
    </section>
  );
}

/**
 * The sandbox teaser states the previously approved level and the level the
 * candidate actually starts from, side by side. Showing both is the point:
 * previous autonomy is a record, not an entitlement.
 */
export function SandboxTeaser({ sandbox }: { sandbox: SandboxTeaserView }) {
  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-sm">
          <Icon name="science" className="text-secondary" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Sandbox revalidation
          </h2>
        </div>
        <Link
          href="/sandbox"
          className="inline-flex items-center gap-space-xs font-body-md text-body-sm text-primary hover:underline"
        >
          View sandbox
          <Icon name="arrow_forward" className="text-[16px] leading-none" />
        </Link>
      </div>

      <p className="mt-space-sm max-w-3xl font-body-md text-body-md text-on-surface-variant">
        Candidate configurations must earn autonomy again after a material change. Previous
        autonomy does not transfer automatically to a changed model, rule, prompt or task
        definition.
      </p>

      <div className="mt-space-lg grid gap-gutter md:grid-cols-3">
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Candidate scope
          </p>
          <p className="mt-space-xs font-body-md text-body-md text-on-surface">
            {sandbox.agent_name}
          </p>
          <p className="font-body-md text-body-sm text-on-surface-variant">
            Task: {sandbox.task_name}
          </p>
        </div>
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Previous approved level
          </p>
          <p className="mt-space-xs font-body-md text-body-md text-on-surface">
            {sandbox.previous_level_label}
          </p>
          <p className="font-body-md text-body-sm text-on-surface-variant">
            Previously approved in production
          </p>
        </div>
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Candidate status
          </p>
          <p className="mt-space-xs font-body-md text-body-md text-on-surface">
            {sandbox.candidate_level_label} validation
          </p>
          <p className="font-body-md text-body-sm text-on-surface-variant">
            Revalidating before autonomy can continue
          </p>
        </div>
      </div>

      <div className="mt-space-lg">
        <div className="flex items-center justify-between font-body-md text-body-sm text-on-surface-variant">
          <span>Validation progress</span>
          <span>
            {sandbox.evaluated} of {sandbox.planned} cases evaluated
          </span>
        </div>
        <div
          className="mt-space-xs h-2 w-full overflow-hidden rounded-full bg-surface-container-highest"
          role="progressbar"
          aria-valuenow={sandbox.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Validation progress"
        >
          <div className="h-full rounded-full bg-secondary" style={{ width: `${sandbox.percent}%` }} />
        </div>
      </div>
    </section>
  );
}

const LEVELS: AutonomyLevel[] = ["shadow", "assisted", "supervised", "constrained"];

export function LevelLegend() {
  return (
    <section>
      <h2 className="font-headline-sm text-headline-sm text-on-surface">Autonomy levels</h2>
      <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
        Each level tests a different kind of trust, so a task proves something new at every stage
        rather than passing the same test more strictly.
      </p>
      <div className="mt-space-md grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        {LEVELS.map((level) => (
          <div
            key={level}
            className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-md"
          >
            <div className="flex items-baseline gap-space-sm">
              <span className="font-label-md text-label-md text-primary">
                {AUTONOMY_LABELS[level].code}
              </span>
              <span className="font-body-md text-body-md text-on-surface">
                {AUTONOMY_LABELS[level].name}
              </span>
            </div>
            <p className="mt-space-sm font-body-md text-body-sm text-on-surface-variant">
              {AUTONOMY_DESCRIPTIONS[level]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
