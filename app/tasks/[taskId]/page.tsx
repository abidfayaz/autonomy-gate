import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ScorecardClient } from "@/components/screen2/ScorecardClient";
import { reachableLevels } from "@/lib/data/evaluation";
import {
  activePolicyForTask,
  currentRuleVersionForTask,
  getTask,
  tasks,
} from "@/lib/data/seed";
import type { AutonomyLevel } from "@/lib/domain/types";
import { buildPoliciesView } from "@/lib/view/policies";
import {
  buildScorecardMeta,
  buildScorecardView,
  type ScorecardView,
} from "@/lib/view/taskScorecard";

/**
 * Screen 2 - Task Scorecard.
 *
 * Sections follow the PRD's order deliberately: eligibility comes before
 * criteria, because the order carries the logic. If eligibility does not pass,
 * the criteria section does not present itself as a normal promotion assessment.
 */

export function generateStaticParams() {
  return tasks.map((task) => ({ taskId: task.task_id }));
}

export default async function TaskScorecardPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const seeded = getTask(taskId);
  const view = buildScorecardView(taskId);
  const meta = buildScorecardMeta(taskId);
  const seededPolicy = activePolicyForTask(taskId);
  if (!view || !seeded || !meta || !seededPolicy) notFound();

  const policiesView = buildPoliciesView();

  // A scorecard for every level this task could hold, so a recorded decision
  // changes what is shown without the evidence reaching the browser.
  const variants: Partial<Record<AutonomyLevel, ScorecardView>> = {};
  for (const level of reachableLevels(taskId)) {
    const variant = buildScorecardView(taskId, level);
    if (variant) variants[level] = variant;
  }

  return (
    <div className="space-y-space-lg py-space-md">
      <nav aria-label="Breadcrumb" className="font-body-md text-body-sm text-on-surface-variant">
        <ol className="flex flex-wrap items-center gap-space-xs">
          <li>
            <Link href="/" className="hover:text-on-surface hover:underline">
              Agents &amp; Tasks
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>{view.agent_name}</li>
          <li aria-hidden="true">/</li>
          <li className="text-on-surface">{view.task_name}</li>
        </ol>
      </nav>

      <header>
        <div className="flex flex-wrap items-center gap-space-md">
          <span className="inline-flex items-center gap-space-xs font-body-md text-body-sm text-on-surface-variant">
            <Icon name={view.agent_icon} className="text-[18px] leading-none" />
            Agent: {view.agent_name}
          </span>
          <span className="inline-flex items-center gap-space-xs rounded-full border border-outline-variant/50 px-space-sm py-space-xs font-body-md text-body-sm text-on-surface-variant">
            <Icon name="info" className="text-[14px] leading-none" />
            Synthetic prototype data
          </span>
        </div>
        <h1 className="mt-space-sm font-headline-xl text-headline-xl text-on-surface">
          {view.task_name}
        </h1>
        <p className="mt-space-sm max-w-3xl font-body-md text-body-lg text-on-surface-variant">
          {view.task_description}
        </p>
        <div className="mt-space-md flex flex-wrap gap-space-lg">
          <Link
            href="/audit"
            className="inline-flex items-center gap-space-xs font-body-md text-body-sm text-primary hover:underline"
          >
            <Icon name="history" className="text-[16px] leading-none" />
            Evaluation history
          </Link>
          <Link
            href="/policies"
            className="inline-flex items-center gap-space-xs font-body-md text-body-sm text-primary hover:underline"
          >
            <Icon name="rule_folder" className="text-[16px] leading-none" />
            View evaluation policy
          </Link>
        </div>
      </header>

      <ScorecardClient
        variants={variants}
        seededLevel={seeded.current_level}
        taskId={taskId}
        task={seeded}
        meta={meta}
        seededPolicy={seededPolicy}
        evidence={policiesView.evidence[taskId] ?? {}}
        evidenceIfCritical={policiesView.evidence_if_critical[taskId] ?? {}}
        currentRuleVersion={currentRuleVersionForTask(taskId)?.version ?? ""}
      />
    </div>
  );
}
