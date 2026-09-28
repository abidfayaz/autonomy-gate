import Link from "next/link";
import { ExplanationBlock } from "@/components/screen2/ExplanationBlock";
import { AutonomyBadge } from "@/components/Badges";
import { Icon } from "@/components/Icon";
import type { ScorecardView } from "@/lib/view/taskScorecard";

/** Shared panel shell, so every section on the scorecard reads the same way. */
export function Panel({
  title,
  status,
  statusTone = "neutral",
  description,
  children,
}: {
  title: string;
  status?: string;
  statusTone?: "positive" | "neutral" | "critical";
  description?: string;
  children: React.ReactNode;
}) {
  const tones = {
    positive: "border-tertiary/40 bg-tertiary/10 text-tertiary",
    neutral: "border-outline-variant/60 bg-surface-container text-on-surface-variant",
    critical: "border-error/40 bg-error/10 text-error",
  };
  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
        {status ? (
          <span
            className={`rounded-full border px-space-sm py-space-xs font-body-md text-body-sm ${tones[statusTone]}`}
          >
            {status}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
          {description}
        </p>
      ) : null}
      <div className="mt-space-md">{children}</div>
    </section>
  );
}

/** Current autonomy and what the system recommends, side by side. */
export function HeadlineCards({ view }: { view: ScorecardView }) {
  const blocked = view.recommendation.blocked;
  return (
    <div className="grid gap-gutter lg:grid-cols-2">
      <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
        <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
          Current autonomy
        </p>
        <div className="mt-space-md">
          <AutonomyBadge level={view.current_level} />
        </div>
        <p className="mt-space-md max-w-md font-body-md text-body-md text-on-surface-variant">
          {view.current_level_description}
        </p>
        <div className="mt-space-md border-t border-outline-variant/30 pt-space-md">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            How this level was reached
          </p>
          <p className="mt-space-xs max-w-md font-body-md text-body-sm text-on-surface-variant">
            {view.level_provenance}
          </p>
        </div>
      </div>

      <div
        className={`rounded-xl border p-space-lg ${
          blocked
            ? "border-error/40 bg-error/5"
            : view.recommendation.promotion_available
              ? "border-tertiary/40 bg-tertiary/5"
              : "border-outline-variant/40 bg-surface-container-low"
        }`}
      >
        <div className="flex items-center justify-between gap-space-sm">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Recommendation
          </p>
          {/* The provenance of the recommendation, in governance terms. */}
          <span className="font-body-md text-body-sm text-on-surface-variant">
            Source: active policy
          </span>
        </div>
        <p className="mt-space-md font-headline-lg text-headline-lg text-on-surface">
          {view.recommendation.headline}
        </p>
        <ExplanationBlock
          code={view.recommendation.code}
          targetLevelLabel={view.recommendation.target_level_label}
          detail={view.recommendation.detail}
          standard={view.recommendation.summary}
        />
      </div>
    </div>
  );
}

const CHECK_ICONS: Record<string, { icon: string; className: string }> = {
  pass: { icon: "check_circle", className: "text-tertiary" },
  fail: { icon: "cancel", className: "text-error" },
  "not-applicable": { icon: "remove_circle", className: "text-outline" },
  none: { icon: "check_circle", className: "text-tertiary" },
};

export function EligibilitySection({ view }: { view: ScorecardView }) {
  return (
    <Panel
      title="Eligibility checks"
      status={view.eligibility.eligible ? "Eligible" : "Blocked"}
      statusTone={view.eligibility.eligible ? "positive" : "critical"}
      description="These checks must pass before the task can be assessed for more autonomy. They ask whether the evidence can be trusted, not whether the task performed well."
    >
      <ul className="divide-y divide-outline-variant/20">
        {view.eligibility.checks.map((check) => {
          const style = CHECK_ICONS[check.status] ?? CHECK_ICONS.pass;
          return (
            <li key={check.key} className="flex items-start gap-space-md py-space-sm">
              <Icon name={style?.icon ?? "check_circle"} className={style?.className ?? ""} />
              <div className="min-w-0 flex-1">
                <p className="font-body-md text-body-md text-on-surface">{check.label}</p>
                <p className="mt-1 font-body-md text-body-sm text-on-surface-variant">
                  {check.detail}
                </p>
              </div>
              <span className="whitespace-nowrap font-body-md text-body-sm text-on-surface-variant">
                {check.status_label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-space-md font-body-md text-body-md text-on-surface">
        {view.eligibility.result_line}
      </p>
    </Panel>
  );
}

const RESULT_STYLES: Record<string, string> = {
  pass: "text-tertiary",
  fail: "text-error",
  "not-applicable": "text-outline",
};

export function CriteriaSection({ view }: { view: ScorecardView }) {
  if (!view.criteria) {
    return (
      <Panel title="Autonomy criteria" status="Not assessed" statusTone="critical">
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
          <p className="font-body-md text-body-md text-on-surface">
            {view.criteria_blocked?.headline}
          </p>
          <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
            {view.criteria_blocked?.detail}
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Autonomy criteria"
      status={view.criteria.stage_label}
      description={`Each stage proves something the previous one could not. These criteria are assessed on ${view.criteria.evidence_label.toLowerCase()} only.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/30">
              <th
                scope="col"
                className="py-space-sm pr-space-md font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant"
              >
                Criterion
              </th>
              <th
                scope="col"
                className="py-space-sm pr-space-md text-right font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant"
              >
                Current
              </th>
              <th
                scope="col"
                className="py-space-sm pr-space-md text-right font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant"
              >
                Requirement
              </th>
              <th
                scope="col"
                className="py-space-sm text-right font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant"
              >
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {view.criteria.rows.map((row) => (
              <tr key={row.key} className="border-b border-outline-variant/15 last:border-b-0">
                <td className="py-space-sm pr-space-md font-body-md text-body-md text-on-surface">
                  {row.label}
                  {row.result === "not-applicable" && row.note ? (
                    <span className="block font-body-md text-body-sm text-on-surface-variant">
                      {row.note}
                    </span>
                  ) : null}
                </td>
                <td className="py-space-sm pr-space-md text-right font-label-md text-label-md text-on-surface">
                  {row.actual_display}
                </td>
                <td className="py-space-sm pr-space-md text-right font-label-md text-label-md text-on-surface-variant">
                  {row.requirement_display}
                </td>
                <td
                  className={`py-space-sm text-right font-body-md text-body-sm ${RESULT_STYLES[row.result] ?? ""}`}
                >
                  {row.result_label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-space-md font-body-md text-body-md text-on-surface">
        {view.criteria.result_line}
      </p>

      {view.criteria.additional.length > 0 ? (
        <div className="mt-space-lg rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Additional metrics
          </p>
          <p className="mt-space-xs font-body-md text-body-sm text-on-surface-variant">
            Useful context. These are not criteria for this stage, so they do not gate promotion.
          </p>
          <dl className="mt-space-md grid gap-space-md sm:grid-cols-3">
            {view.criteria.additional.map((row) => (
              <div key={row.key}>
                <dt className="font-body-md text-body-sm text-on-surface-variant">{row.label}</dt>
                <dd className="mt-1 font-label-md text-label-md text-on-surface">
                  {row.actual_display}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </Panel>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  eligible: "text-tertiary",
  remain: "text-on-surface-variant",
  restrict: "text-error",
};

export function ScopeSection({ view }: { view: ScorecardView }) {
  return (
    <Panel
      title="Performance by scope"
      description="An aggregate can look strong while one segment is unsafe. Results are broken down by jurisdiction and case complexity so a weaker segment cannot hide inside an average."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/30">
              {[
                "Scope",
                "Cases",
                "Accuracy",
                "Confident-but-wrong",
                "Critical errors",
                "Scope recommendation",
              ].map((heading, index) => (
                <th
                  key={heading}
                  scope="col"
                  className={`py-space-sm font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant ${
                    index === 0 ? "pr-space-md" : "px-space-md"
                  } ${index > 0 && index < 5 ? "text-right" : ""}`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.scope_rows.map((row) => (
              <tr key={row.key} className="border-b border-outline-variant/15 last:border-b-0">
                <td className="py-space-sm pr-space-md font-body-md text-body-md text-on-surface">
                  {row.verdict === "restrict" ? (
                    <Icon name="warning" className="mr-space-xs align-middle text-[16px] text-error" />
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
                    row.verdict ? (VERDICT_STYLES[row.verdict] ?? "") : "text-outline"
                  }`}
                >
                  {row.verdict_label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function ClassificationSection({ view }: { view: ScorecardView }) {
  if (!view.classification) return null;
  const item = view.classification;
  return (
    <Panel
      title="Review classification"
      status={item.status_label}
      statusTone={item.confirmed ? "positive" : "critical"}
      description="How an ambiguous reviewer note was classified before it contributes to autonomy evidence."
    >
      <figure className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
        <blockquote className="font-body-md text-body-md text-on-surface">
          &ldquo;{item.reviewer_note}&rdquo;
        </blockquote>
        <figcaption className="mt-space-xs font-body-md text-body-sm text-on-surface-variant">
          Reviewer note
        </figcaption>
      </figure>

      <dl className="mt-space-md grid gap-space-md sm:grid-cols-3">
        <div>
          <dt className="font-body-md text-body-sm text-on-surface-variant">Classification</dt>
          <dd className="mt-1 font-body-md text-body-md text-on-surface">{item.result_label}</dd>
        </div>
        <div>
          <dt className="font-body-md text-body-sm text-on-surface-variant">
            Classification confidence
          </dt>
          <dd className="mt-1 font-label-md text-label-md text-on-surface">
            {item.confidence_display}
          </dd>
        </div>
        <div>
          <dt className="font-body-md text-body-sm text-on-surface-variant">Human review</dt>
          <dd className="mt-1 font-body-md text-body-md text-on-surface">
            {item.requires_confirmation ? "Confirmation required" : "Not required"}
          </dd>
        </div>
      </dl>

      <p className="mt-space-md font-body-md text-body-sm text-on-surface-variant">
        {item.status_detail}
      </p>
    </Panel>
  );
}

export function ConfigurationSection({ view }: { view: ScorecardView }) {
  const config = view.configuration;
  const entries: Array<[string, string]> = [
    ["Agent version", config.agent_version],
    ["Evaluation policy", config.policy_version],
    ["Rule set", config.rule_pack_name],
    ["Task rule version", config.agent_rule_version],
    ["Evaluator rule version", config.evaluator_rule_version],
    ["Current rule version", config.current_rule_version],
  ];
  return (
    <Panel
      title="Current configuration"
      status={config.status_label}
      statusTone={config.aligned ? "positive" : "critical"}
      description="The versions this task and its evaluation are currently using. Evidence only counts while all three rule versions agree."
    >
      <dl className="grid gap-space-md sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([label, value]) => (
          <div key={label}>
            <dt className="font-body-md text-body-sm text-on-surface-variant">{label}</dt>
            <dd className="mt-1 font-label-md text-label-md text-on-surface">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-space-md font-body-md text-body-sm text-on-surface-variant">
        Evidence window opened {config.aligned ? "on" : "on"} {view.evidence_window_start}.
      </p>
    </Panel>
  );
}

export function NextLevelFooter({ view }: { view: ScorecardView }) {
  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
      <div className="flex flex-wrap items-end justify-between gap-space-lg">
        <div>
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Next autonomy level
          </p>
          <p className="mt-space-sm font-headline-sm text-headline-sm text-on-surface">
            {view.recommendation.target_level_label
              ? `Target: ${view.recommendation.target_level_label}`
              : "No further level available"}
          </p>
          <p className="mt-space-xs max-w-2xl font-body-md text-body-md text-on-surface-variant">
            {view.recommendation.summary}
          </p>
        </div>
        <Link
          href={`/tasks/${view.task_id}/decision`}
          className="inline-flex items-center gap-space-sm rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-body-md text-on-primary transition-opacity hover:opacity-90"
        >
          Review autonomy decision
          <Icon name="arrow_forward" className="text-[18px] leading-none" />
        </Link>
      </div>
    </section>
  );
}
