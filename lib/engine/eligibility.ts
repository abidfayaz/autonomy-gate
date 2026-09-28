import type { Incident, StageCriteria, Task } from "@/lib/domain/types";
import type { StageMetrics } from "./metrics";
import { REASON_CODES, type ReasonCode } from "./reasonCodes";

/**
 * Eligibility: is this task in a fit state to be assessed at all?
 *
 * This runs before autonomy criteria and is a different question. Criteria ask
 * whether the task performed well enough; eligibility asks whether the evidence
 * can be trusted to answer that. Grading stale or incomplete evidence produces a
 * confident-looking verdict built on nothing, so a failure here stops the
 * promotion assessment rather than counting as one more unmet criterion.
 */

export type CheckStatus = "pass" | "fail" | "not-applicable" | "none";

export interface EligibilityCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** The code raised when this check fails. */
  code: ReasonCode | null;
}

export interface EligibilityReport {
  checks: EligibilityCheck[];
  eligible: boolean;
  /** First failure in the precedence order the PRD's gate pseudocode defines. */
  blocking: EligibilityCheck | null;
}

export interface EligibilityInput {
  task: Task;
  stage: StageCriteria | null;
  metrics: StageMetrics;
  currentRuleVersion: string;
  openIncidents: readonly Incident[];
  atCeiling: boolean;
}

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;

export function evaluateEligibility(input: EligibilityInput): EligibilityReport {
  const { task, stage, metrics, currentRuleVersion, openIncidents, atCeiling } = input;

  const versionsAligned =
    task.agent_rule_version === currentRuleVersion &&
    task.evaluator_rule_version === currentRuleVersion;

  const blockingIncidents = openIncidents.filter((incident) => incident.blocking);
  const safetyIncidents = openIncidents.filter(
    (incident) => incident.type === "safety" && incident.status === "open",
  );

  const checks: EligibilityCheck[] = [];

  // Conditional. Shown only while a material change is awaiting revalidation, so
  // an ordinary evaluation is not cluttered with a check that cannot fail.
  if (task.material_change_pending) {
    checks.push({
      key: "sandbox-revalidation",
      label: "Sandbox revalidation completed",
      status: "fail",
      detail:
        "The changed configuration has not been revalidated yet, so previous autonomy cannot continue.",
      code: REASON_CODES.SANDBOX_REVALIDATION_REQUIRED,
    });
  }

  checks.push({
    key: "rules-current",
    label: "Rules are current",
    status: versionsAligned ? "pass" : "fail",
    detail: versionsAligned
      ? `Task, evaluator and current rule version all on v${currentRuleVersion}.`
      : `Task on v${task.agent_rule_version}, evaluator on v${task.evaluator_rule_version}, current rule v${currentRuleVersion}.`,
    code: REASON_CODES.PAUSED_RULE_VERSION_MISMATCH,
  });

  if (atCeiling || stage === null) {
    checks.push({
      key: "enough-cases",
      label: "Enough cases evaluated",
      status: "not-applicable",
      detail: "This task already holds the highest autonomy level it is permitted to reach.",
      code: null,
    });
  } else {
    const enough = metrics.valid_case_count >= stage.minimum_cases;
    checks.push({
      key: "enough-cases",
      label: "Enough cases evaluated",
      status: enough ? "pass" : "fail",
      detail: `${metrics.valid_case_count} cases evaluated. ${stage.minimum_cases} required at this stage.`,
      code: REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE,
    });
  }

  const criticalAllowance = stage?.max_critical_errors ?? 0;
  const hasCritical = metrics.critical_errors > criticalAllowance;
  checks.push({
    key: "no-blocking-issue",
    label: "No blocking critical issue",
    status: hasCritical || blockingIncidents.length > 0 ? "fail" : "pass",
    detail:
      blockingIncidents.length > 0
        ? (blockingIncidents[0]?.summary ?? "An open issue is blocking evaluation.")
        : hasCritical
          ? `${metrics.critical_errors} confirmed critical ${metrics.critical_errors === 1 ? "error" : "errors"} in the current evidence window.`
          : "No confirmed critical errors and no blocking issue open.",
    code: hasCritical ? REASON_CODES.BLOCKED_CRITICAL_ERROR : REASON_CODES.BLOCKED_OPEN_INCIDENT,
  });

  if (stage === null) {
    checks.push({
      key: "evidence-available",
      label: "Required evidence is available",
      status: "not-applicable",
      detail: "No stage requirement applies at the autonomy ceiling.",
      code: null,
    });
  } else {
    const coverageMet = metrics.evidence_coverage >= stage.min_evidence_coverage;
    checks.push({
      key: "evidence-available",
      label: "Required evidence is available",
      status: coverageMet ? "pass" : "fail",
      detail: `${percent(metrics.evidence_coverage)} of cases requiring supporting evidence have it (minimum ${percent(stage.min_evidence_coverage)}).`,
      code: REASON_CODES.HOLD_EVIDENCE_COVERAGE,
    });
  }

  checks.push({
    key: "no-safety-issue",
    label: "No open safety issue",
    status: safetyIncidents.length > 0 ? "fail" : "none",
    detail:
      safetyIncidents.length > 0
        ? (safetyIncidents[0]?.summary ?? "An unresolved safety issue is open.")
        : "None",
    code: REASON_CODES.BLOCKED_OPEN_INCIDENT,
  });

  // Precedence follows the PRD's gate pseudocode: a changed configuration is
  // questioned before stale versions, stale versions before thin evidence, and
  // thin evidence before anything measured from it.
  const precedence = [
    "sandbox-revalidation",
    "rules-current",
    "enough-cases",
    "no-blocking-issue",
    "evidence-available",
    "no-safety-issue",
  ];

  let blocking: EligibilityCheck | null = null;
  for (const key of precedence) {
    const check = checks.find((item) => item.key === key);
    if (check && check.status === "fail") {
      blocking = check;
      break;
    }
  }

  return { checks, eligible: blocking === null, blocking };
}
