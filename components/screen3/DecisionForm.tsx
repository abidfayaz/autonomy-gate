"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AutonomyBadge } from "@/components/Badges";
import { Icon } from "@/components/Icon";
import { AUTONOMY_LABELS } from "@/lib/domain/vocabulary";
import {
  classificationsForTask,
  effectiveLevel,
  type RecordedDecision,
} from "@/lib/state/demoState";
import { useDemoState } from "@/lib/state/DemoStateProvider";
import type { DecisionPageData } from "@/lib/view/decisionContext";

/**
 * Screen 3 - Autonomy Decision Review.
 *
 * The one place a person changes anything. Every option offered here comes from
 * the engine, so the interface cannot present a choice the product's rules
 * forbid, and the reason is required because a decision without one is not a
 * governance record.
 */

const REASON_CATEGORIES = [
  "More evidence required",
  "Risk remains too high",
  "Scope needs narrowing",
  "Business context",
  "Other",
];

export function DecisionForm({ data }: { data: DecisionPageData }) {
  const { state, recordDecision } = useDemoState();
  const [action, setAction] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [recorded, setRecorded] = useState<RecordedDecision | null>(null);

  const level = effectiveLevel(state, data.task_id, data.seeded_level);
  const context = data.contexts[level];

  // Selecting the recommended option by default would quietly make the
  // recommendation the decision. A person has to choose.
  const selected = useMemo(
    () => context?.options.find((option) => option.action === action) ?? null,
    [context, action],
  );

  // No loading gate: with no stored decisions `effectiveLevel` returns the
  // seeded level, so the server renders the real page and the client only
  // re-renders if this visitor has actually changed something.
  if (!context) {
    return (
      <p className="rounded-xl border border-error/40 bg-error/5 p-space-lg font-body-md text-body-md text-error">
        No decision context is available for this task at its current level.
      </p>
    );
  }

  const reasonProvided = reason.trim().length >= 10;
  const acknowledgementNeeded = selected?.is_override ?? false;
  const canSubmit =
    selected !== null && reasonProvided && (!acknowledgementNeeded || acknowledged);

  // A disabled control that does not say what it is waiting for reads as broken.
  const outstanding: string[] = [];
  if (!selected) outstanding.push("choose a decision above");
  if (!reasonProvided) outstanding.push("give a reason of at least 10 characters");
  if (acknowledgementNeeded && !acknowledged) {
    outstanding.push("acknowledge that this differs from the recommendation");
  }

  const submit = () => {
    if (!selected || !canSubmit) return;
    const decision: RecordedDecision = {
      decision_id: `DEC-S${String(state.decisions.length + 1).padStart(3, "0")}`,
      task_id: data.task_id,
      decided_at: new Date().toISOString().slice(0, 10),
      current_level: context.level,
      recommended_level: context.recommended_level,
      recommendation_code: context.recommendation_code,
      final_level: selected.resulting_level,
      outcome: selected.outcome,
      was_override: selected.is_override,
      scope: selected.scope,
      decided_by: "Maya",
      reason: reason.trim(),
      reason_category: category || "Other",
      policy_version: context.policy_version,
      agent_version: context.agent_version,
      rule_version: context.rule_version,
      evaluator_rule_version: context.evaluator_rule_version,
      // Frozen here. The Audit Log reads this, never today's numbers.
      snapshot: context.snapshot,
      // A classification a person settled here is part of the evidence this
      // decision rests on, so it is kept with it rather than logged separately.
      confirmed_classifications: [
        ...context.confirmed_classifications,
        ...classificationsForTask(state, data.task_id)
          .filter((item) => item.resolved)
          .map(
            (item) =>
              `Reviewer note classified as ${item.result.replace("_", " ")}, confirmed by ${item.reviewer}`,
          ),
      ],
    };
    recordDecision(decision);
    setRecorded(decision);
  };

  if (recorded) {
    return (
      <section className="rounded-xl border border-tertiary/40 bg-tertiary/5 p-space-lg">
        <div className="flex items-center gap-space-sm">
          <Icon name="check_circle" className="text-tertiary" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Decision recorded</h2>
        </div>
        <p className="mt-space-sm max-w-2xl font-body-md text-body-md text-on-surface-variant">
          {data.task_name} is now {AUTONOMY_LABELS[recorded.final_level].label}. The evidence
          behind this decision has been kept as it stood today, along with the policy and rule
          versions in force.
        </p>
        <dl className="mt-space-md grid gap-space-md sm:grid-cols-3">
          <div>
            <dt className="font-body-md text-body-sm text-on-surface-variant">Decision</dt>
            <dd className="mt-1 font-body-md text-body-md text-on-surface">
              {AUTONOMY_LABELS[recorded.current_level].label} →{" "}
              {AUTONOMY_LABELS[recorded.final_level].label}
            </dd>
          </div>
          <div>
            <dt className="font-body-md text-body-sm text-on-surface-variant">Recorded by</dt>
            <dd className="mt-1 font-body-md text-body-md text-on-surface">
              {recorded.decided_by}
            </dd>
          </div>
          <div>
            <dt className="font-body-md text-body-sm text-on-surface-variant">Policy version</dt>
            <dd className="mt-1 font-label-md text-label-md text-on-surface">
              v{recorded.policy_version}
            </dd>
          </div>
        </dl>
        <div className="mt-space-lg flex flex-wrap gap-space-md">
          <Link
            href={`/tasks/${data.task_id}`}
            className="inline-flex items-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-body-md text-on-primary hover:opacity-90"
          >
            Return to scorecard
          </Link>
          <Link
            href="/audit"
            className="inline-flex items-center gap-space-xs rounded-lg border border-outline-variant/50 px-space-lg py-space-sm font-body-md text-body-md text-on-surface-variant hover:bg-surface-container"
          >
            View in Audit Log
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-space-lg">
      <div className="grid gap-gutter lg:grid-cols-3">
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Current autonomy
          </p>
          <div className="mt-space-md">
            <AutonomyBadge level={context.level} />
          </div>
          <p className="mt-space-md font-body-md text-body-sm text-on-surface-variant">
            {context.current_level_description}
          </p>
          <p className="mt-space-md border-t border-outline-variant/30 pt-space-sm font-body-md text-body-sm text-on-surface-variant">
            {data.level_provenance}
          </p>
        </div>

        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
          <div className="flex items-center justify-between gap-space-sm">
            <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
              System recommendation
            </p>
            <span className="font-body-md text-body-sm text-on-surface-variant">
              Source: active policy
            </span>
          </div>
          <p className="mt-space-md font-headline-sm text-headline-sm text-on-surface">
            {context.recommendation_headline}
          </p>
          <p className="mt-space-sm font-body-md text-body-sm text-on-surface-variant">
            {context.recommendation_summary}
          </p>
        </div>

        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Target considered
          </p>
          <p className="mt-space-md font-headline-sm text-headline-sm text-on-surface">
            {context.target_level_label ?? "No further level"}
          </p>
          <p className="mt-space-sm font-body-md text-body-sm text-on-surface-variant">
            {context.promotion_available
              ? "Promotion is available for the scope below."
              : context.blocked
                ? "Promotion is unavailable while evaluation is blocked."
                : "Promotion is not recommended at this time."}
          </p>
        </div>
      </div>

      {context.blocked ? (
        <section className="rounded-xl border border-error/40 bg-error/5 p-space-lg">
          <div className="flex items-center gap-space-sm">
            <Icon name="lock" className="text-error" />
            <h2 className="font-body-md text-body-md text-error">Promotion is not available</h2>
          </div>
          <p className="mt-space-sm max-w-3xl font-body-md text-body-md text-on-surface-variant">
            {context.blocked_reason} An override can disagree with a recommendation, but it cannot
            approve a promotion on evidence the evaluation has already found untrustworthy.
          </p>
        </section>
      ) : null}

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Decision scope</h2>
        <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
          This decision applies only to the task and scope below. It does not change autonomy for
          the whole agent.
        </p>
        <div className="mt-space-md grid gap-gutter md:grid-cols-2">
          <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
            <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
              Included
            </p>
            <ul className="mt-space-sm space-y-space-xs">
              {context.scope.included.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-space-sm font-body-md text-body-sm text-on-surface"
                >
                  <Icon name="check" className="text-[16px] leading-none text-tertiary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* Two different kinds of exclusion. Run together in one list, a task
              name reads like a case type. */}
          <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
            <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
              Excluded from this scope
            </p>
            {context.scope.excluded.length > 0 ? (
              <ul className="mt-space-sm space-y-space-xs">
                {context.scope.excluded.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-space-sm font-body-md text-body-sm text-on-surface-variant"
                  >
                    <Icon name="remove" className="text-[16px] leading-none text-outline" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-space-sm font-body-md text-body-sm text-on-surface-variant">
                Nothing is excluded from the scope of this task.
              </p>
            )}

            <p className="mt-space-md font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
              Other tasks of this agent, unaffected
            </p>
            <ul className="mt-space-sm space-y-space-xs">
              {data.sibling_task_names.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-space-sm font-body-md text-body-sm text-on-surface-variant"
                >
                  <Icon name="block" className="text-[16px] leading-none text-outline" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Decision basis</h2>
          <Link
            href={`/tasks/${data.task_id}`}
            className="inline-flex items-center gap-space-xs font-body-md text-body-sm text-primary hover:underline"
          >
            View full scorecard
            <Icon name="arrow_forward" className="text-[16px] leading-none" />
          </Link>
        </div>
        <div className="mt-space-md grid gap-gutter md:grid-cols-2">
          <BasisList title="Eligibility checks" rows={context.eligibility_rows} />
          <BasisList
            title="Autonomy criteria"
            rows={context.criteria_rows}
            emptyLabel="Not assessed while evaluation is blocked."
          />
        </div>
      </section>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
        <div className="flex items-center gap-space-sm">
          <Icon name="gavel" className="text-primary" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Human decision</h2>
        </div>
        <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
          Reviewer: Maya. The system recommends; you decide, and the reason is kept. If your
          decision differs from the recommendation, both are kept: the difference stays visible in
          the audit history, and the new level takes effect immediately.
        </p>

        <fieldset className="mt-space-md">
          <legend className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Choose a decision
          </legend>
          <div className="mt-space-sm space-y-space-sm">
            {context.options.map((option) => {
              const isSelected = option.action === action;
              return (
                <label
                  key={option.action}
                  className={`flex cursor-pointer items-start gap-space-md rounded-lg border p-space-md transition-colors ${
                    isSelected
                      ? "border-primary bg-surface-container-high"
                      : "border-outline-variant/40 bg-surface-container-low hover:bg-surface-container"
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={option.action}
                    checked={isSelected}
                    onChange={() => {
                      setAction(option.action);
                      setAcknowledged(false);
                    }}
                    className="mt-1 h-4 w-4 accent-[#c0c1ff]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-space-sm">
                      <span className="font-body-md text-body-md text-on-surface">
                        {option.label}
                      </span>
                      {option.recommended ? (
                        <span className="rounded-full border border-tertiary/40 bg-tertiary/10 px-space-sm py-space-xs font-body-md text-body-sm text-tertiary">
                          Recommended
                        </span>
                      ) : null}
                      {option.is_override ? (
                        <span className="rounded-full border border-secondary/40 bg-secondary/10 px-space-sm py-space-xs font-body-md text-body-sm text-secondary">
                          Differs from recommendation
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block font-body-md text-body-sm text-on-surface-variant">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {acknowledgementNeeded ? (
          <label className="mt-space-md flex items-start gap-space-sm rounded-lg border border-secondary/40 bg-secondary/5 p-space-md">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[#89ceff]"
            />
            <span className="font-body-md text-body-sm text-on-surface-variant">
              This decision differs from the system recommendation. Both are kept: the
              recommendation, your decision, and the reason you give are recorded together, and the
              difference stays visible in the audit history. The new level takes effect
              immediately, and the evidence is kept exactly as it stands today.
            </span>
          </label>
        ) : null}

        <div className="mt-space-lg">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Decision reason <span className="text-error">*</span>
          </p>
          <p
            id="decision-reason-category"
            className="mt-space-sm font-body-md text-body-sm text-on-surface-variant"
          >
            Category (optional)
          </p>
          <div
            className="mt-space-xs flex flex-wrap gap-space-xs"
            role="group"
            aria-labelledby="decision-reason-category"
          >
            {REASON_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full border px-space-md py-space-xs font-body-md text-body-sm transition-colors ${
                  category === item
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant/50 text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            aria-label="Decision reason"
            placeholder="Record why this decision was made. This is kept in the audit history."
            className="mt-space-sm w-full rounded-lg border border-outline-variant/50 bg-surface-container p-space-md font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:outline-none"
          />
          <p className="mt-space-xs font-body-md text-body-sm text-on-surface-variant">
            {reason.trim().length} characters. A reason of at least 10 characters is required for
            the audit history.
          </p>
        </div>

        <div className="mt-space-lg flex flex-wrap items-center justify-between gap-space-md">
          <p className="inline-flex items-center gap-space-xs font-body-md text-body-sm text-on-surface-variant">
            <Icon name="lock" className="text-[16px] leading-none" />
            {outstanding.length > 0
              ? `To record this decision, ${outstanding.join(", and ")}.`
              : "Submitting records this decision in the audit history."}
          </p>
          <div className="flex flex-wrap gap-space-md">
            <Link
              href={`/tasks/${data.task_id}`}
              className="rounded-lg border border-outline-variant/50 px-space-lg py-space-sm font-body-md text-body-md text-on-surface-variant hover:bg-surface-container"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-space-sm rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-body-md text-on-primary transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="check_circle" className="text-[18px] leading-none" />
              Confirm decision
            </button>
          </div>
        </div>
      </section>

      {data.previous_decision ? (
        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
          <div className="flex items-center gap-space-sm">
            <Icon name="history" className="text-on-surface-variant" />
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Previous decision</h2>
          </div>
          <dl className="mt-space-md grid gap-space-md sm:grid-cols-3">
            <div>
              <dt className="font-body-md text-body-sm text-on-surface-variant">Recorded</dt>
              <dd className="mt-1 font-body-md text-body-md text-on-surface">
                {data.previous_decision.decided_at}
              </dd>
            </div>
            <div>
              <dt className="font-body-md text-body-sm text-on-surface-variant">Change</dt>
              <dd className="mt-1 font-body-md text-body-md text-on-surface">
                {data.previous_decision.from_label} → {data.previous_decision.to_label}
              </dd>
            </div>
            <div>
              <dt className="font-body-md text-body-sm text-on-surface-variant">Decided by</dt>
              <dd className="mt-1 font-body-md text-body-md text-on-surface">
                {data.previous_decision.decided_by}
              </dd>
            </div>
          </dl>
          <p className="mt-space-md max-w-3xl font-body-md text-body-sm text-on-surface-variant">
            &ldquo;{data.previous_decision.reason}&rdquo;
          </p>
        </section>
      ) : null}
    </div>
  );
}

function BasisList({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: Array<{ label: string; value: string; passed: boolean | null }>;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
      <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="mt-space-sm font-body-md text-body-sm text-on-surface-variant">
          {emptyLabel ?? "Nothing to show."}
        </p>
      ) : (
        <ul className="mt-space-sm space-y-space-xs">
          {rows.map((row) => (
            <li key={row.label} className="flex items-start justify-between gap-space-md">
              <span className="font-body-md text-body-sm text-on-surface">{row.label}</span>
              <span
                className={`whitespace-nowrap font-body-md text-body-sm ${
                  row.passed === false
                    ? "text-error"
                    : row.passed === null
                      ? "text-outline"
                      : "text-tertiary"
                }`}
              >
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
