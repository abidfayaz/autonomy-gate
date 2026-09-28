import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionForm } from "@/components/screen3/DecisionForm";
import { Icon } from "@/components/Icon";
import { tasks } from "@/lib/data/seed";
import { buildDecisionPageData } from "@/lib/view/decisionContext";

export function generateStaticParams() {
  return tasks.map((task) => ({ taskId: task.task_id }));
}

export default async function AutonomyDecisionPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const data = buildDecisionPageData(taskId);
  if (!data) notFound();

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
          <li>{data.agent_name}</li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/tasks/${data.task_id}`} className="hover:text-on-surface hover:underline">
              {data.task_name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-on-surface">Autonomy decision</li>
        </ol>
      </nav>

      <header>
        <span className="inline-flex items-center gap-space-xs rounded-full border border-outline-variant/50 px-space-sm py-space-xs font-body-md text-body-sm text-on-surface-variant">
          <Icon name="info" className="text-[14px] leading-none" />
          Synthetic prototype data
        </span>
        <h1 className="mt-space-sm font-headline-xl text-headline-xl text-on-surface">
          Review autonomy decision
        </h1>
        <p className="mt-space-sm max-w-3xl font-body-md text-body-lg text-on-surface-variant">
          Review the recommendation, scope and supporting evidence before recording the final human
          decision for {data.task_name}.
        </p>
      </header>

      <DecisionForm data={data} />
    </div>
  );
}
