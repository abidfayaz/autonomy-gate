"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import type { PolicyVersion, StageCriteria, StageKey } from "@/lib/domain/types";
import {
  effectivePolicy,
  nextPolicyVersion,
  policyEditsFor,
  type RecordedPolicyVersion,
} from "@/lib/state/demoState";
import { useDemoState } from "@/lib/state/DemoStateProvider";
import {
  EDITABLE_FIELDS,
  STAGE_LABELS,
  STAGE_ORDER,
  type PoliciesView,
} from "@/lib/view/policies";

/**
 * Screen 5 - Policies & Versions.
 *
 * Saving an edit publishes a new version rather than overwriting the old one.
 * Everything already recorded keeps pointing at the version it was decided
 * under, which is the only reason versions are worth having.
 */

const TODAY = "2026-09-28";

type FieldValues = Record<string, string>;

function readField(stages: Record<StageKey, StageCriteria>, stage: string, path: string): number {
  if (stage === "all") {
    const value = stages.supervised_to_constrained[path as keyof StageCriteria];
    return typeof value === "number" ? value : 0;
  }
  const value = stages[stage as StageKey][path as keyof StageCriteria];
  return typeof value === "number" ? value : 0;
}

function toDisplay(value: number, format: "percent" | "count"): string {
  if (format === "count") return String(value);
  const percent = value * 100;
  return String(Number.parseFloat(percent.toFixed(2)));
}

function fromDisplay(raw: string, format: "percent" | "count"): number | null {
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  if (format === "count") return Math.round(parsed);
  if (parsed > 100) return null;
  return parsed / 100;
}

export function PoliciesClient({ view }: { view: PoliciesView }) {
  const { state, recordPolicy } = useDemoState();
  const [selectedTask, setSelectedTask] = useState(view.default_task_id);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<FieldValues>({});
  const [error, setError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<string | null>(null);

  const seeded = view.seeded_policies[selectedTask];
  const active = useMemo(
    () => (seeded ? effectivePolicy(state, seeded) : undefined),
    [state, seeded],
  );
  const ownEdits = policyEditsFor(state, selectedTask);

  if (!seeded || !active) return null;

  const beginEdit = () => {
    const next: FieldValues = {};
    for (const field of EDITABLE_FIELDS) {
      next[field.key] = toDisplay(
        readField(active.stages, field.stage, field.path),
        field.format,
      );
    }
    setValues(next);
    setError(null);
    setSavedVersion(null);
    setEditing(true);
  };

  const save = () => {
    const stages: Record<StageKey, StageCriteria> = {
      shadow_to_assisted: { ...active.stages.shadow_to_assisted },
      assisted_to_supervised: { ...active.stages.assisted_to_supervised },
      supervised_to_constrained: { ...active.stages.supervised_to_constrained },
    };

    const changes: string[] = [];
    for (const field of EDITABLE_FIELDS) {
      const parsed = fromDisplay(values[field.key] ?? "", field.format);
      if (parsed === null) {
        setError(`${field.label} is not a valid value.`);
        return;
      }
      const before = readField(active.stages, field.stage, field.path);
      if (parsed === before) continue;

      const targets: StageKey[] = field.stage === "all" ? STAGE_ORDER : [field.stage];
      for (const stage of targets) {
        (stages[stage] as unknown as Record<string, number>)[field.path] = parsed;
      }
      changes.push(
        `${field.label}: ${toDisplay(before, field.format)}${field.format === "percent" ? "%" : ""} to ${toDisplay(parsed, field.format)}${field.format === "percent" ? "%" : ""}`,
      );
    }

    if (changes.length === 0) {
      setError("Nothing has changed, so there is no new version to publish.");
      return;
    }

    const version = nextPolicyVersion(active.version);
    const record: RecordedPolicyVersion = {
      policy_version_id: `${selectedTask}-policy-${version}`,
      task_id: selectedTask,
      version,
      created_at: TODAY,
      change_note: changes.join(". "),
      high_confidence_threshold: active.high_confidence_threshold,
      stages,
      based_on: active.version,
    };
    recordPolicy(record);
    setEditing(false);
    setError(null);
    setSavedVersion(version);
  };

  const historyEntries = [
    ...ownEdits
      .map((edit) => ({
        version: edit.version,
        created_at: edit.created_at,
        change_note: edit.change_note,
        active: edit.version === active.version,
        own: true,
      }))
      .reverse(),
    ...(view.history[selectedTask] ?? []).map((entry) => ({
      ...entry,
      active: entry.active && ownEdits.length === 0,
      own: false,
    })),
  ];

  const panel = view.rule_panels[selectedTask];
  const mismatched = Object.values(view.rule_panels).filter((item) => !item.aligned);

  return (
    <div className="space-y-space-lg">
      <div className="grid gap-gutter sm:grid-cols-3">
        <Tile
          icon="rule_folder"
          label="Task policies"
          value={view.counts.policies}
          caption="Tasks with an evaluation policy"
        />
        <Tile
          icon="check_circle"
          label="Versions aligned"
          value={view.counts.aligned}
          caption="Task and evaluator on the current rule"
        />
        <Tile
          icon="warning"
          label="Needs attention"
          value={view.counts.needs_attention}
          caption={
            view.counts.needs_attention === 1
              ? "One task has a version mismatch"
              : "Rule versions disagree"
          }
        />
      </div>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low">
        <div className="border-b border-outline-variant/30 p-space-md">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Policies by task</h2>
          <p className="mt-space-xs font-body-md text-body-md text-on-surface-variant">
            Select a task to review the criteria used to evaluate it.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-lowest/40">
                {["Agent", "Task", "Current autonomy", "Policy version", "Rule status", ""].map(
                  (heading, index) => (
                    <th
                      key={heading || index}
                      scope="col"
                      className="px-space-md py-space-sm font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant"
                    >
                      {heading || <span className="sr-only">Select</span>}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => {
                const rowPolicy = view.seeded_policies[row.task_id];
                const shown = rowPolicy ? effectivePolicy(state, rowPolicy).version : "";
                const isSelected = row.task_id === selectedTask;
                return (
                  <tr
                    key={row.task_id}
                    className={`border-b border-outline-variant/20 last:border-b-0 ${
                      isSelected ? "bg-surface-container-high" : "hover:bg-surface-container/40"
                    }`}
                  >
                    <td className="px-space-md py-space-md font-body-md text-body-sm text-on-surface-variant">
                      {row.agent_name}
                    </td>
                    <td className="px-space-md py-space-md font-body-md text-body-md text-on-surface">
                      {row.task_name}
                    </td>
                    <td className="px-space-md py-space-md font-body-md text-body-sm text-on-surface-variant">
                      {row.level_label}
                    </td>
                    <td className="px-space-md py-space-md font-label-md text-label-md text-on-surface">
                      v{shown}
                    </td>
                    <td className="px-space-md py-space-md">
                      <span
                        className={`font-body-md text-body-sm ${
                          row.rule_status === "current" ? "text-tertiary" : "text-error"
                        }`}
                      >
                        {row.rule_status_label}
                      </span>
                    </td>
                    <td className="px-space-md py-space-md text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTask(row.task_id);
                          setEditing(false);
                          setSavedVersion(null);
                        }}
                        aria-pressed={isSelected}
                        className="rounded-lg px-space-sm py-space-xs font-body-md text-body-sm text-primary hover:bg-surface-container-high"
                      >
                        {isSelected ? "Selected" : "Select"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
        <div className="flex flex-wrap items-start justify-between gap-space-md">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {view.task_names[selectedTask]}
            </h2>
            <p className="mt-space-xs font-body-md text-body-md text-on-surface-variant">
              Evaluation policy <span className="text-on-surface">v{active.version}</span>, active.
              These are the criteria the task is judged against, not how it is currently
              performing.
            </p>
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={beginEdit}
              className="inline-flex items-center gap-space-xs rounded-lg border border-outline-variant/50 px-space-md py-space-sm font-body-md text-body-md text-on-surface-variant hover:bg-surface-container"
            >
              <Icon name="tune" className="text-[18px] leading-none" />
              Edit policy
            </button>
          ) : null}
        </div>

        {savedVersion ? (
          <p className="mt-space-md rounded-lg border border-tertiary/40 bg-tertiary/5 p-space-md font-body-md text-body-md text-on-surface-variant">
            Policy v{savedVersion} published. New evaluations use it from now on. Decisions already
            recorded keep the version they were made under.
          </p>
        ) : null}

        {editing ? (
          <div className="mt-space-lg">
            <p className="rounded-lg border border-secondary/40 bg-secondary/5 p-space-md font-body-md text-body-md text-on-surface-variant">
              Saving these criteria publishes{" "}
              <span className="text-on-surface">v{nextPolicyVersion(active.version)}</span>. The
              current version is kept, and historical decisions continue to reference the version
              used at the time.
            </p>

            <div className="mt-space-md grid gap-space-md sm:grid-cols-2">
              {EDITABLE_FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className="font-body-md text-body-sm text-on-surface">{field.label}</span>
                  <span className="mt-1 flex items-center gap-space-sm">
                    <input
                      type="number"
                      step={field.format === "percent" ? "0.01" : "1"}
                      min="0"
                      value={values[field.key] ?? ""}
                      onChange={(event) =>
                        setValues((previous) => ({
                          ...previous,
                          [field.key]: event.target.value,
                        }))
                      }
                      aria-label={field.label}
                      className="w-32 rounded-lg border border-outline-variant/50 bg-surface-container px-space-sm py-space-xs font-label-md text-label-md text-on-surface focus:border-primary focus:outline-none"
                    />
                    <span className="font-body-md text-body-sm text-on-surface-variant">
                      {field.format === "percent" ? "%" : "cases"}
                    </span>
                  </span>
                  <span className="mt-1 block font-body-md text-body-sm text-on-surface-variant">
                    {field.help}
                  </span>
                </label>
              ))}
            </div>

            {error ? (
              <p className="mt-space-md font-body-md text-body-md text-error">{error}</p>
            ) : null}

            <div className="mt-space-lg flex flex-wrap gap-space-md">
              <button
                type="button"
                onClick={save}
                className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-body-md text-on-primary hover:opacity-90"
              >
                Save as new version
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="rounded-lg border border-outline-variant/50 px-space-lg py-space-sm font-body-md text-body-md text-on-surface-variant hover:bg-surface-container"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-space-lg space-y-space-lg">
            {STAGE_ORDER.map((stage) => (
              <StageCard key={stage} stage={stage} criteria={active.stages[stage]} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-gutter lg:grid-cols-2">
        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Policy history</h2>
          <p className="mt-space-xs font-body-md text-body-md text-on-surface-variant">
            Every version this task has had. Nothing here is overwritten.
          </p>
          <ol className="mt-space-md space-y-space-sm">
            {historyEntries.map((entry) => (
              <li
                key={`${entry.version}-${entry.created_at}`}
                className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md"
              >
                <div className="flex flex-wrap items-center gap-space-sm">
                  <span className="font-label-md text-label-md text-on-surface">
                    v{entry.version}
                  </span>
                  {entry.active ? (
                    <span className="rounded-full border border-tertiary/40 bg-tertiary/10 px-space-sm py-space-xs font-body-md text-body-sm text-tertiary">
                      Active
                    </span>
                  ) : (
                    <span className="font-body-md text-body-sm text-on-surface-variant">
                      Superseded
                    </span>
                  )}
                  {entry.own ? (
                    <span className="rounded-full border border-secondary/40 bg-secondary/10 px-space-sm py-space-xs font-body-md text-body-sm text-secondary">
                      Published by you
                    </span>
                  ) : null}
                  <span className="ml-auto font-body-md text-body-sm text-on-surface-variant">
                    {entry.created_at}
                  </span>
                </div>
                <p className="mt-space-xs font-body-md text-body-sm text-on-surface-variant">
                  {entry.change_note}
                </p>
              </li>
            ))}
          </ol>
          <Link
            href="/audit"
            className="mt-space-md inline-flex items-center gap-space-xs font-body-md text-body-sm text-primary hover:underline"
          >
            View related decisions in the Audit Log
            <Icon name="arrow_forward" className="text-[16px] leading-none" />
          </Link>
        </section>

        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Rule versions</h2>
          <p className="mt-space-xs font-body-md text-body-md text-on-surface-variant">
            Whether this task and its evaluator are using the current rule version. Rule sets are
            defined per task, so one agent&rsquo;s tasks can sit on different versions.
          </p>

          {panel ? (
            <div
              className={`mt-space-md rounded-lg border p-space-md ${
                panel.aligned
                  ? "border-outline-variant/30 bg-surface-container"
                  : "border-error/40 bg-error/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-space-sm">
                <p className="font-body-md text-body-md text-on-surface">{panel.rule_pack_name}</p>
                <span
                  className={`font-body-md text-body-sm ${panel.aligned ? "text-tertiary" : "text-error"}`}
                >
                  {panel.aligned ? "Versions aligned" : "Version mismatch"}
                </span>
              </div>
              <dl className="mt-space-md grid gap-space-md sm:grid-cols-3">
                <Field label="Task rule" value={panel.agent_rule_version} />
                <Field label="Evaluator rule" value={panel.evaluator_rule_version} />
                <Field label="Current rule" value={panel.current_rule_version} />
              </dl>
            </div>
          ) : null}

          {mismatched.length > 0 ? (
            <div className="mt-space-lg">
              <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
                Needs attention
              </p>
              {mismatched.map((item) => (
                <div
                  key={item.task_id}
                  className="mt-space-sm rounded-lg border border-error/40 bg-error/5 p-space-md"
                >
                  <p className="font-body-md text-body-md text-on-surface">{item.task_name}</p>
                  <p className="mt-space-xs font-body-md text-body-sm text-on-surface-variant">
                    The evaluator is on {item.evaluator_rule_version} while the task and the
                    current rule set are on {item.current_rule_version}. Evaluation for this task is
                    paused until the versions align.
                  </p>
                  <Link
                    href={`/tasks/${item.task_id}`}
                    className="mt-space-sm inline-flex items-center gap-space-xs font-body-md text-body-sm text-primary hover:underline"
                  >
                    Review mismatch
                    <Icon name="arrow_forward" className="text-[16px] leading-none" />
                  </Link>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function StageCard({ stage, criteria }: { stage: StageKey; criteria: StageCriteria }) {
  const rows: Array<[string, string]> = [
    ["Minimum cases", String(criteria.minimum_cases)],
    ["Critical errors allowed", String(criteria.max_critical_errors)],
    ["Confident-but-wrong limit", `${(criteria.max_confident_wrong_rate * 100).toFixed(2)}%`],
    ["Evidence coverage", `${(criteria.min_evidence_coverage * 100).toFixed(1)}%`],
  ];
  if (criteria.min_accuracy !== undefined) {
    rows.push(["Accuracy", `${(criteria.min_accuracy * 100).toFixed(1)}%`]);
  }
  if (criteria.max_override_rate !== undefined) {
    rows.push(["Human override limit", `${(criteria.max_override_rate * 100).toFixed(1)}%`]);
  }
  if (criteria.min_correct_escalation_rate !== undefined) {
    rows.push([
      "Correct escalation",
      `${(criteria.min_correct_escalation_rate * 100).toFixed(1)}%`,
    ]);
  }
  if (criteria.min_sample_coverage !== undefined) {
    rows.push(["Sample coverage", `${(criteria.min_sample_coverage * 100).toFixed(1)}%`]);
  }
  if (criteria.max_sampled_error_rate !== undefined) {
    rows.push(["Sampled error rate", `${(criteria.max_sampled_error_rate * 100).toFixed(1)}%`]);
  }
  if (criteria.max_boundary_violations !== undefined) {
    rows.push(["Boundary violations", String(criteria.max_boundary_violations)]);
  }
  if (criteria.max_missed_critical_exceptions !== undefined) {
    rows.push(["Missed critical exceptions", String(criteria.max_missed_critical_exceptions)]);
  }

  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
      <p className="font-body-md text-body-md text-on-surface">{STAGE_LABELS[stage]}</p>
      <dl className="mt-space-md grid gap-x-space-md gap-y-space-sm sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-space-md">
            <dt className="font-body-md text-body-sm text-on-surface-variant">{label}</dt>
            <dd className="font-label-md text-label-md text-on-surface">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Tile({
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-body-md text-body-sm text-on-surface-variant">{label}</dt>
      <dd className="mt-1 font-label-md text-label-md text-on-surface">{value}</dd>
    </div>
  );
}

export type { PolicyVersion };
