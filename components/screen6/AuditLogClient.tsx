"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { AuditEventType } from "@/lib/domain/types";
import { HISTORY_PRESERVED_NOTICE } from "@/lib/domain/vocabulary";
import { useDemoState } from "@/lib/state/DemoStateProvider";
import {
  countRows,
  rowFromRecordedDecision,
  rowFromRecordedPolicy,
  type AuditDetail,
  type AuditRow,
  type AuditView,
} from "@/lib/view/auditLog";

/**
 * Screen 6 - Audit Log.
 *
 * A governance record, not a system log. Every row answers what happened, who
 * decided, why, and under which policy and rule version, and the evidence behind
 * a decision is the snapshot taken at the time rather than today's numbers.
 */

type TypeFilter = "all" | AuditEventType;
type DateFilter = "all" | "30d" | "quarter";

const TYPE_FILTERS: Array<{ key: TypeFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "autonomy-decision", label: "Autonomy decisions" },
  { key: "policy-change", label: "Policy changes" },
  { key: "sandbox-revalidation", label: "Revalidation" },
  { key: "version-issue", label: "Issues" },
];

const DATE_FILTERS: Array<{ key: DateFilter; label: string }> = [
  { key: "all", label: "Full history" },
  { key: "quarter", label: "Quarter to date" },
  { key: "30d", label: "Last 30 days" },
];

/** Fixed so the prototype reads the same whenever it is opened. */
const TODAY = "2026-09-28";

function withinRange(date: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  if (filter === "quarter") return date >= "2026-07-01";
  const cutoff = new Date(`${TODAY}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  return date >= cutoff.toISOString().slice(0, 10);
}

export function AuditLogClient({ view }: { view: AuditView }) {
  const { state } = useDemoState();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [taskFilter, setTaskFilter] = useState("all");
  const [open, setOpen] = useState<AuditDetail | null>(null);

  // This visitor's decisions join the seeded history, newest first, and are
  // marked so the two are never mistaken for one another.
  const allRows = useMemo(() => {
    const ownDecisions = state.decisions.map((decision) =>
      rowFromRecordedDecision(decision, view.lookups),
    );
    const ownPolicies = state.policies.map((policy) =>
      rowFromRecordedPolicy(policy, view.lookups),
    );
    return [...ownDecisions, ...ownPolicies, ...view.rows].sort((a, b) =>
      b.occurred_at.localeCompare(a.occurred_at),
    );
  }, [state.decisions, state.policies, view.lookups, view.rows]);

  const rows = allRows.filter((row) => {
    if (typeFilter !== "all" && row.type !== typeFilter) return false;
    if (!withinRange(row.occurred_at, dateFilter)) return false;
    if (agentFilter !== "all" && view.lookups.task_agents[row.task_id] !== agentFilter) {
      return false;
    }
    if (taskFilter !== "all" && row.task_id !== taskFilter) return false;
    return true;
  });

  const counts = countRows(allRows);
  const tasksForAgent =
    agentFilter === "all"
      ? view.lookups.tasks
      : view.lookups.tasks.filter((task) => task.agent_id === agentFilter);

  return (
    <div className="space-y-space-lg">
      <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          icon="verified_user"
          label="Autonomy decisions"
          value={counts.autonomy_decisions}
          caption="Recorded across current tasks"
        />
        <SummaryTile
          icon="policy"
          label="Policy changes"
          value={counts.policy_changes}
          caption="Earlier versions preserved"
        />
        <SummaryTile
          icon="sync_alt"
          label="Revalidation"
          value={counts.revalidations}
          caption="After material change"
        />
        <SummaryTile
          icon="report_problem"
          label="Needs attention"
          value={counts.needs_attention}
          caption={view.needs_attention_task ?? "Nothing outstanding"}
        />
      </div>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low">
        <div className="flex flex-wrap items-center gap-space-md border-b border-outline-variant/30 p-space-md">
          <label className="flex items-center gap-space-sm font-body-md text-body-sm text-on-surface-variant">
            Agent
            <select
              value={agentFilter}
              onChange={(event) => {
                setAgentFilter(event.target.value);
                setTaskFilter("all");
              }}
              className="rounded-lg border border-outline-variant/50 bg-surface-container px-space-sm py-space-xs font-body-md text-body-sm text-on-surface"
            >
              <option value="all">All agents</option>
              {view.lookups.agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-space-sm font-body-md text-body-sm text-on-surface-variant">
            Task
            <select
              value={taskFilter}
              onChange={(event) => setTaskFilter(event.target.value)}
              className="rounded-lg border border-outline-variant/50 bg-surface-container px-space-sm py-space-xs font-body-md text-body-sm text-on-surface"
            >
              <option value="all">All tasks</option>
              {tasksForAgent.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-space-xs" role="group" aria-label="Filter by event type">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setTypeFilter(filter.key)}
                aria-pressed={typeFilter === filter.key}
                className={`rounded-full border px-space-md py-space-xs font-body-md text-body-sm transition-colors ${
                  typeFilter === filter.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant/50 text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-space-xs" role="group" aria-label="Filter by date">
            {DATE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setDateFilter(filter.key)}
                aria-pressed={dateFilter === filter.key}
                className={`rounded-full border px-space-md py-space-xs font-body-md text-body-sm transition-colors ${
                  dateFilter === filter.key
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-outline-variant/50 text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-lowest/40">
                {["Date", "Agent & task", "Event", "Change", "By", "Status", ""].map(
                  (heading, index) => (
                    <th
                      key={heading || index}
                      scope="col"
                      className="px-space-md py-space-sm font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant"
                    >
                      {heading || <span className="sr-only">Details</span>}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-space-md py-space-lg font-body-md text-body-md text-on-surface-variant"
                  >
                    No records match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => <Row key={row.event_id} row={row} onOpen={setOpen} />)
              )}
            </tbody>
          </table>
        </div>

        <p className="flex items-center gap-space-sm border-t border-outline-variant/30 p-space-md font-body-md text-body-sm text-on-surface-variant">
          <Icon name="lock" className="text-[16px] leading-none" />
          {HISTORY_PRESERVED_NOTICE} They are not edited or recalculated when a policy changes.
        </p>
      </section>

      {open ? <DetailDrawer detail={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  caption,
}: {
  icon: string;
  label: string;
  value: number;
  caption: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-md">
      <div className="flex items-center justify-between">
        <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
          {label}
        </p>
        <Icon name={icon} className="text-on-surface-variant" />
      </div>
      <p className="mt-space-sm font-headline-xl text-headline-xl text-on-surface">{value}</p>
      <p className="mt-1 font-body-md text-body-sm text-on-surface-variant">{caption}</p>
    </div>
  );
}

function Row({ row, onOpen }: { row: AuditRow; onOpen: (detail: AuditDetail) => void }) {
  return (
    <tr className="border-b border-outline-variant/20 last:border-b-0 hover:bg-surface-container/40">
      <td className="whitespace-nowrap px-space-md py-space-md align-top font-label-md text-label-md text-on-surface-variant">
        {row.occurred_at}
      </td>
      <td className="px-space-md py-space-md align-top">
        <p className="font-body-md text-body-md text-on-surface">{row.task_name}</p>
        <p className="font-body-md text-body-sm text-on-surface-variant">{row.agent_name}</p>
      </td>
      <td className="px-space-md py-space-md align-top">
        <span className="font-body-md text-body-sm text-on-surface-variant">{row.type_label}</span>
        {row.source === "this-session" ? (
          <span className="mt-1 block w-fit rounded-full border border-secondary/40 bg-secondary/10 px-space-sm py-space-xs font-body-md text-body-sm text-secondary">
            Recorded by you
          </span>
        ) : null}
      </td>
      <td className="px-space-md py-space-md align-top font-body-md text-body-sm text-on-surface">
        <span className="text-on-surface-variant">{row.change_from}</span>
        <Icon name="arrow_forward" className="mx-space-xs align-middle text-[14px] text-outline" />
        {row.change_to}
      </td>
      <td className="px-space-md py-space-md align-top font-body-md text-body-sm text-on-surface">
        {row.actor}
      </td>
      <td className="px-space-md py-space-md align-top">
        <span
          className={`font-body-md text-body-sm ${
            row.status === "Needs attention"
              ? "text-error"
              : row.status === "Recommendation declined"
                ? "text-secondary"
                : "text-on-surface-variant"
          }`}
        >
          {row.status}
        </span>
      </td>
      <td className="px-space-md py-space-md align-top text-right">
        {row.detail ? (
          <button
            type="button"
            onClick={() => row.detail && onOpen(row.detail)}
            className="rounded-lg px-space-sm py-space-xs font-body-md text-body-sm text-primary hover:bg-surface-container-high"
          >
            View details
          </button>
        ) : (
          <Link
            href={`/tasks/${row.task_id}`}
            className="rounded-lg px-space-sm py-space-xs font-body-md text-body-sm text-primary hover:bg-surface-container-high"
          >
            View task
          </Link>
        )}
      </td>
    </tr>
  );
}

function DetailDrawer({ detail, onClose }: { detail: AuditDetail; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-detail-title"
      className="fixed inset-0 z-50 flex justify-end bg-surface-container-lowest/80"
    >
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-outline-variant/40 bg-surface-container-low p-space-lg">
        <div className="flex items-start justify-between gap-space-md">
          <div>
            <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
              {detail.outcome_label}
            </p>
            <h2
              id="audit-detail-title"
              className="mt-space-xs font-headline-sm text-headline-sm text-on-surface"
            >
              {detail.task_name}
            </h2>
            <p className="font-body-md text-body-sm text-on-surface-variant">
              {detail.agent_name} · recorded {detail.decided_at}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-space-xs text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          >
            <Icon name="close" />
          </button>
        </div>

        {detail.source === "this-session" ? (
          <p className="mt-space-md rounded-lg border border-secondary/40 bg-secondary/5 p-space-md font-body-md text-body-sm text-on-surface-variant">
            You recorded this decision in this session. It is kept in your browser only.
          </p>
        ) : null}

        <dl className="mt-space-lg grid gap-space-md sm:grid-cols-3">
          <Field label="Previous level" value={detail.previous_level_label} />
          <Field label="System recommendation" value={detail.recommended_label} />
          <Field label="Final decision" value={detail.final_level_label} />
          <Field label="Decided by" value={detail.decided_by} />
          <Field
            label="Differs from recommendation"
            value={detail.was_override ? "Yes" : "No"}
          />
          {detail.reason_category ? (
            <Field label="Reason category" value={detail.reason_category} />
          ) : null}
        </dl>

        <section className="mt-space-lg">
          <h3 className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Decision reason
          </h3>
          <p className="mt-space-xs font-body-md text-body-md text-on-surface">
            &ldquo;{detail.reason}&rdquo;
          </p>
        </section>

        <section className="mt-space-lg">
          <h3 className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Decision scope
          </h3>
          <div className="mt-space-sm grid gap-space-md sm:grid-cols-2">
            <div>
              <p className="font-body-md text-body-sm text-on-surface-variant">Included</p>
              <ul className="mt-space-xs space-y-space-xs">
                {(detail.scope_included.length > 0
                  ? detail.scope_included
                  : ["All cases handled by this task"]
                ).map((item) => (
                  <li key={item} className="font-body-md text-body-sm text-on-surface">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-body-md text-body-sm text-on-surface-variant">Excluded</p>
              <ul className="mt-space-xs space-y-space-xs">
                {(detail.scope_excluded.length > 0 ? detail.scope_excluded : ["Nothing"]).map(
                  (item) => (
                    <li key={item} className="font-body-md text-body-sm text-on-surface-variant">
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
          <p className="mt-space-sm font-body-md text-body-sm text-on-surface-variant">
            This decision applies to this task and scope only. It does not generalise across the
            agent&rsquo;s other tasks.
          </p>
        </section>

        <section className="mt-space-lg">
          <h3 className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Decision context
          </h3>
          <dl className="mt-space-sm grid gap-space-md sm:grid-cols-2">
            <Field label="Evaluation policy" value={detail.policy_version} />
            <Field label="Agent version" value={detail.agent_version} />
            <Field label="Rule version" value={detail.rule_version} />
            <Field label="Evaluator rule version" value={detail.evaluator_rule_version} />
          </dl>
          <p className="mt-space-sm font-body-md text-body-sm text-on-surface-variant">
            This decision remains linked to policy {detail.policy_version} even after newer
            versions are published.
          </p>
        </section>

        <section className="mt-space-lg">
          <h3 className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Evidence at the time
          </h3>
          <dl className="mt-space-sm grid gap-x-space-md gap-y-space-sm sm:grid-cols-2">
            {detail.snapshot_rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-space-md">
                <dt className="font-body-md text-body-sm text-on-surface-variant">{row.label}</dt>
                <dd className="font-label-md text-label-md text-on-surface">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {detail.confirmed_classifications.length > 0 ? (
          <section className="mt-space-lg">
            <h3 className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
              Confirmed review classifications
            </h3>
            <ul className="mt-space-sm space-y-space-xs">
              {detail.confirmed_classifications.map((item) => (
                <li key={item} className="font-body-md text-body-sm text-on-surface-variant">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-body-md text-body-sm text-on-surface-variant">{label}</dt>
      <dd className="mt-1 font-body-md text-body-md text-on-surface">{value}</dd>
    </div>
  );
}
