"use client";

import Link from "next/link";
import { useState } from "react";
import { AutonomyBadge } from "@/components/Badges";
import { Icon } from "@/components/Icon";
import { AUTONOMY_LABELS } from "@/lib/domain/vocabulary";
import { latestContinuityFor, type RecordedDecision } from "@/lib/state/demoState";
import { useDemoState } from "@/lib/state/DemoStateProvider";
import type { SandboxView } from "@/lib/view/sandbox";

/**
 * Screen 4 - Sandbox Revalidation.
 *
 * Previous autonomy and the candidate's actual level sit side by side, because
 * that contrast is the point: a task can have earned the highest level it is
 * allowed and still start again from Shadow once the configuration underneath it
 * changes. Nothing here restores autonomy on its own.
 */

const REASON_CATEGORIES = [
  "Revalidation passed",
  "Scope requires restriction",
  "More evidence required",
  "Other",
];

const TODAY = "2026-09-28";

export function SandboxClient({ view }: { view: SandboxView }) {
  const { state, recordDecision } = useDemoState();
  const [action, setAction] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");

  const recorded = latestContinuityFor(state, view.task_id);
  const selected = view.options.find((option) => option.action === action) ?? null;
  const canSubmit = selected !== null && reason.trim().length >= 10;

  // A disabled control that does not say what it is waiting for reads as broken.
  const outstanding: string[] = [];
  if (!selected) outstanding.push("choose an outcome above");
  if (reason.trim().length < 10) outstanding.push("give a reason of at least 10 characters");

  const submit = () => {
    if (!selected || !canSubmit) return;
    const decision: RecordedDecision = {
      decision_id: `DEC-S${String(state.decisions.length + 1).padStart(3, "0")}`,
      task_id: view.task_id,
      kind: "continuity",
      resolves_revalidation: selected.resolves_revalidation,
      decided_at: TODAY,
      current_level: view.candidate_level,
      recommended_level: null,
      recommendation_code: "SANDBOX_REVALIDATION_REQUIRED",
      final_level: selected.resulting_level,
      outcome:
        selected.action === "continue-for-validated-scope"
          ? view.recommendation === "restrict-scope"
            ? "scope-restricted"
            : "approved"
          : selected.action === "lower-autonomy"
            ? "autonomy-lowered"
            : "kept-current-level",
      was_override: selected.is_override,
      scope: selected.scope,
      decided_by: "Maya",
      reason: reason.trim(),
      reason_category: category || "Other",
      policy_version: view.policy_version,
      agent_version: view.agent_version,
      rule_version: view.candidate_rule_version,
      evaluator_rule_version: view.candidate_rule_version,
      snapshot: {
        task_id: view.task_id,
        autonomy_mode: view.candidate_level,
        valid_case_count: view.evaluated_case_count,
        accuracy:
          view.scope_rows.reduce(
            (sum, row) => sum + Number.parseFloat(row.accuracy_display) * row.case_count,
            0,
          ) /
          100 /
          Math.max(1, view.evaluated_case_count),
        critical_errors: view.scope_rows.reduce((sum, row) => sum + row.critical_errors, 0),
        confident_wrong_rate: 0,
        evidence_coverage: 0,
        human_acceptance_rate: null,
        human_override_rate: null,
        correct_escalation_rate: null,
        sample_coverage: null,
        sampled_error_rate: null,
        boundary_violations: null,
        missed_critical_exceptions: null,
      },
      confirmed_classifications: [],
    };
    recordDecision(decision);
  };

  if (recorded) {
    return (
      <section className="rounded-xl border border-tertiary/40 bg-tertiary/5 p-space-lg">
        <div className="flex items-center gap-space-sm">
          <Icon name="verified" className="text-tertiary" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Continuity decision recorded
          </h2>
        </div>
        <p className="mt-space-sm max-w-2xl font-body-md text-body-md text-on-surface-variant">
          {view.task_name} continues at {AUTONOMY_LABELS[recorded.final_level].label}
          {recorded.scope ? ` for ${recorded.scope.label}` : ""}.{" "}
          {recorded.resolves_revalidation
            ? "The revalidation is closed."
            : "The revalidation stays open while more evidence is collected."}
        </p>
        <p className="mt-space-sm max-w-2xl font-body-md text-body-sm text-on-surface-variant">
          &ldquo;{recorded.reason}&rdquo;
        </p>
        <div className="mt-space-lg flex flex-wrap gap-space-md">
          <Link
            href={`/tasks/${view.task_id}`}
            className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-body-md text-on-primary hover:opacity-90"
          >
            Return to task
          </Link>
          <Link
            href="/audit"
            className="rounded-lg border border-outline-variant/50 px-space-lg py-space-sm font-body-md text-body-md text-on-surface-variant hover:bg-surface-container"
          >
            View in Audit Log
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-space-lg">
      <section className="rounded-xl border border-secondary/40 bg-secondary/5 p-space-lg">
        <div className="flex items-start gap-space-sm">
          <Icon name="gavel" className="text-secondary" />
          <p className="max-w-4xl font-body-md text-body-md text-on-surface-variant">
            Previous autonomy is recorded, but it does not transfer to the changed configuration.
            This revalidation tests the updated rule version against the previously approved scope,
            and a person decides whether the earlier level continues.
          </p>
        </div>
      </section>

      <div className="grid gap-gutter lg:grid-cols-3">
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Previous approved autonomy
          </p>
          <div className="mt-space-md">
            <AutonomyBadge level={view.previous_level} />
          </div>
          <p className="mt-space-md font-body-md text-body-sm text-on-surface-variant">
            Approved under rule v{view.previous_rule_version} for the validated scope. Kept as a
            record, not as an entitlement.
          </p>
        </div>

        <div className="rounded-xl border border-secondary/40 bg-surface-container-low p-space-lg">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Candidate state
          </p>
          <div className="mt-space-md">
            <AutonomyBadge level={view.candidate_level} />
          </div>
          <p className="mt-space-md font-body-md text-body-sm text-on-surface-variant">
            The changed configuration starts again here, whatever the task held before.
          </p>
        </div>

        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Continuity recommendation
          </p>
          <p className="mt-space-md font-headline-sm text-headline-sm text-on-surface">
            {view.recommendation_label}
          </p>
          <p className="mt-space-sm font-body-md text-body-sm text-on-surface-variant">
            {view.recommendation_detail}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Why this task is being revalidated
        </h2>
        <div className="mt-space-md grid gap-gutter md:grid-cols-3">
          <Fact icon="difference" title="Material change" body={view.change_summary} />
          <Fact icon="warning" title="Why it matters" body={view.change_impact} />
          <Fact
            icon="policy"
            title="Revalidation requirement"
            body="The changed configuration must be tested before previous autonomy can continue."
          />
        </div>
      </section>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Validation coverage</h2>
          <span className="font-body-md text-body-sm text-on-surface-variant">
            {view.progress_percent}% complete
          </span>
        </div>

        <div className="mt-space-md">
          <div className="flex items-center justify-between font-body-md text-body-sm text-on-surface-variant">
            <span>Validation progress</span>
            <span>
              {view.evaluated_case_count} of {view.planned_case_count} cases evaluated
            </span>
          </div>
          <div
            className="mt-space-xs h-2 w-full overflow-hidden rounded-full bg-surface-container-highest"
            role="progressbar"
            aria-valuenow={view.progress_percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Validation progress"
          >
            <div
              className="h-full rounded-full bg-secondary"
              style={{ width: `${view.progress_percent}%` }}
            />
          </div>
        </div>

        <p className="mt-space-md font-body-md text-body-sm text-on-surface-variant">
          Coverage groups overlap. They describe the kinds of case included in revalidation, not
          separate totals.
        </p>
        <ul className="mt-space-sm grid gap-space-sm sm:grid-cols-2 lg:grid-cols-3">
          {view.coverage_groups.map((group) => (
            <li
              key={group.label}
              className="flex items-center justify-between gap-space-md rounded-lg border border-outline-variant/30 bg-surface-container p-space-md"
            >
              <span className="font-body-md text-body-sm text-on-surface">{group.label}</span>
              <span className="whitespace-nowrap font-label-md text-label-md text-on-surface-variant">
                {group.case_count} · {group.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Performance after the change
        </h2>
        <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
          How the changed configuration behaved across the previously approved scope. A weaker
          segment is the case for a narrower fence, not for discarding the whole task.
        </p>
        <div className="mt-space-md overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/30">
                {["Scope", "Cases", "Accuracy", "Confident-but-wrong", "Critical errors", "Result"].map(
                  (heading, index) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`py-space-sm font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant ${
                        index === 0 ? "pr-space-md" : "px-space-md"
                      } ${index > 0 && index < 5 ? "text-right" : ""}`}
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {view.scope_rows.map((row) => (
                <tr key={row.key} className="border-b border-outline-variant/15 last:border-b-0">
                  <td className="py-space-sm pr-space-md font-body-md text-body-md text-on-surface">
                    {row.unsafe ? (
                      <Icon
                        name="warning"
                        className="mr-space-xs align-middle text-[16px] text-error"
                      />
                    ) : null}
                    {row.label}
                  </td>
                  <td className="px-space-md py-space-sm text-right font-label-md text-label-md text-on-surface-variant">
                    {row.case_count}
                  </td>
                  <td className="px-space-md py-space-sm text-right font-label-md text-label-md text-on-surface">
                    {row.accuracy_display}
                  </td>
                  <td className="px-space-md py-space-sm text-right font-label-md text-label-md text-on-surface">
                    {row.confident_wrong_display}
                  </td>
                  <td className="px-space-md py-space-sm text-right font-label-md text-label-md text-on-surface">
                    {row.critical_errors}
                  </td>
                  <td
                    className={`px-space-md py-space-sm font-body-md text-body-sm ${
                      row.unsafe ? "text-error" : "text-on-surface-variant"
                    }`}
                  >
                    {row.verdict_label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
        <div className="flex items-center gap-space-sm">
          <Icon name="verified_user" className="text-primary" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Continuity decision</h2>
        </div>
        <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
          Reviewer: Maya. Previous autonomy does not return on its own. Whichever option is
          recorded, the earlier approval stays in the history alongside it.
        </p>

        <fieldset className="mt-space-md">
          <legend className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Choose an outcome
          </legend>
          <div className="mt-space-sm space-y-space-sm">
            {view.options.map((option) => {
              const isSelected = option.action === action;
              return (
                <label
                  key={option.action}
                  className={`flex cursor-pointer items-start gap-space-md rounded-lg border p-space-md transition-colors ${
                    isSelected
                      ? "border-primary bg-surface-container-high"
                      : "border-outline-variant/40 hover:bg-surface-container"
                  }`}
                >
                  <input
                    type="radio"
                    name="continuity"
                    value={option.action}
                    checked={isSelected}
                    onChange={() => setAction(option.action)}
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
                      {!option.resolves_revalidation ? (
                        <span className="rounded-full border border-secondary/40 bg-secondary/10 px-space-sm py-space-xs font-body-md text-body-sm text-secondary">
                          Revalidation stays open
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block font-body-md text-body-sm text-on-surface-variant">
                      {option.description}
                    </span>
                    {option.scope && option.scope.excluded.length > 0 ? (
                      <span className="mt-space-sm block font-body-md text-body-sm text-on-surface-variant">
                        Applies to {option.scope.included.join(", ")}. Excludes{" "}
                        {option.scope.excluded.join(", ")}.
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-space-lg">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Decision reason <span className="text-error">*</span>
          </p>
          <p
            id="continuity-reason-category"
            className="mt-space-sm font-body-md text-body-sm text-on-surface-variant"
          >
            Category (optional)
          </p>
          <div
            className="mt-space-xs flex flex-wrap gap-space-xs"
            role="group"
            aria-labelledby="continuity-reason-category"
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
            placeholder="Record why this continuity decision was made. This is kept in the audit history."
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
              ? `To record this decision, ${outstanding.join(" and ")}.`
              : "Submitting records this continuity decision in the audit history."}
          </p>
          <div className="flex flex-wrap gap-space-md">
            <Link
              href={`/tasks/${view.task_id}`}
              className="rounded-lg border border-outline-variant/50 px-space-lg py-space-sm font-body-md text-body-md text-on-surface-variant hover:bg-surface-container"
            >
              Return to task
            </Link>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-space-sm rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-body-md text-on-primary transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="verified_user" className="text-[18px] leading-none" />
              Record continuity decision
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Fact({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
      <div className="flex items-center gap-space-sm">
        <Icon name={icon} className="text-on-surface-variant" />
        <p className="font-body-md text-body-md text-on-surface">{title}</p>
      </div>
      <p className="mt-space-xs font-body-md text-body-sm text-on-surface-variant">{body}</p>
    </div>
  );
}
