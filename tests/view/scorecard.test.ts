import { describe, expect, it } from "vitest";
import { tasks } from "@/lib/data/seed";
import { buildScorecardView } from "@/lib/view/taskScorecard";

const view = (taskId: string) => {
  const result = buildScorecardView(taskId);
  expect(result, `no scorecard for ${taskId}`).not.toBeNull();
  if (!result) throw new Error("unreachable");
  return result;
};

describe("scorecard coverage", () => {
  it("builds a scorecard for every task", () => {
    for (const task of tasks) {
      expect(buildScorecardView(task.task_id)).not.toBeNull();
    }
  });

  it("returns nothing for an unknown task", () => {
    expect(buildScorecardView("no-such-task")).toBeNull();
  });
});

describe("stage-specific criteria", () => {
  it("shows the eight Supervised to Constrained criteria and no others", () => {
    const scorecard = view("routine-rule-application");
    expect(scorecard.criteria?.stage_label).toBe("Supervised to Constrained");
    expect(scorecard.criteria?.rows.map((row) => row.key)).toEqual([
      "minimum-cases",
      "sample-coverage",
      "sampled-error-rate",
      "critical-errors",
      "boundary-violations",
      "missed-critical-exceptions",
      "confident-wrong",
      "evidence-coverage",
    ]);
  });

  it("keeps accuracy and override rate out of the gating table", () => {
    const scorecard = view("routine-rule-application");
    const gatingLabels = scorecard.criteria?.rows.map((row) => row.label) ?? [];
    expect(gatingLabels).not.toContain("Accuracy");
    expect(gatingLabels).not.toContain("Human override rate");

    const additional = scorecard.criteria?.additional.map((row) => row.label) ?? [];
    expect(additional).toContain("Accuracy");
    expect(additional).toContain("Human override rate");
  });

  it("marks exactly one criterion as needing improvement", () => {
    const scorecard = view("routine-rule-application");
    const failing = scorecard.criteria?.rows.filter((row) => row.result === "fail") ?? [];
    expect(failing).toHaveLength(1);
    expect(failing[0]?.key).toBe("confident-wrong");
    expect(scorecard.criteria?.result_line).toBe("1 criterion is not yet met.");
  });

  it("switches criteria with the stage the task is leaving", () => {
    expect(view("detect-invoice-exceptions").criteria?.stage_label).toBe(
      "Assisted to Supervised",
    );
    expect(view("risk-detection").criteria?.stage_label).toBe("Shadow to Assisted");

    const assistedKeys = view("detect-invoice-exceptions").criteria?.rows.map((r) => r.key) ?? [];
    expect(assistedKeys).toContain("override-rate");
    expect(assistedKeys).toContain("correct-escalation");
    expect(assistedKeys).not.toContain("sample-coverage");

    const shadowKeys = view("risk-detection").criteria?.rows.map((r) => r.key) ?? [];
    expect(shadowKeys).toContain("accuracy");
    expect(shadowKeys).not.toContain("override-rate");
  });

  it("names the evidence mode the criteria are assessed on", () => {
    expect(view("routine-rule-application").criteria?.evidence_label).toBe(
      "Supervised-mode evidence",
    );
    expect(view("risk-detection").criteria?.evidence_label).toBe("Shadow-mode evidence");
  });
});

describe("number formatting", () => {
  it("shows sub-one-percent rates to two decimals, so a limit is never rounded away", () => {
    const scorecard = view("routine-rule-application");
    const confidentWrong = scorecard.criteria?.rows.find((row) => row.key === "confident-wrong");
    // At one decimal the requirement would read 0.3%, which is not the policy.
    expect(confidentWrong?.requirement_display).toBe("≤ 0.25%");
    expect(confidentWrong?.actual_display).toBe("0.88%");
  });

  it("shows ordinary percentages to one decimal", () => {
    const scorecard = view("routine-rule-application");
    const coverage = scorecard.criteria?.rows.find((row) => row.key === "evidence-coverage");
    expect(coverage?.actual_display).toBe("99.1%");
    expect(coverage?.requirement_display).toBe("≥ 98.0%");
  });

  it("shows counts as plain integers", () => {
    const scorecard = view("routine-rule-application");
    const cases = scorecard.criteria?.rows.find((row) => row.key === "minimum-cases");
    expect(cases?.actual_display).toBe("342");
    expect(cases?.requirement_display).toBe("≥ 300");
  });
});

describe("eligibility gate", () => {
  it("does not assess criteria when eligibility fails", () => {
    for (const taskId of ["classify-expense", "draft-tax-position", "filing-readiness"]) {
      const scorecard = view(taskId);
      expect(scorecard.eligibility.eligible, taskId).toBe(false);
      expect(scorecard.criteria, taskId).toBeNull();
      expect(scorecard.criteria_blocked, taskId).not.toBeNull();
    }
  });

  it("states the blocking reason as a reason, not as a check name", () => {
    // A check's label names the condition that should hold, so appending it to
    // "evaluation blocked" would read as though the condition were satisfied.
    const line = view("draft-tax-position").eligibility.result_line;
    expect(line).toBe(
      "Result: evaluation blocked because the task, the evaluator and the current rule set are not on the same version.",
    );
    expect(line).not.toMatch(/blocked\. Rules are current/);
  });

  it("gives every blocked task a readable blocking reason", () => {
    for (const taskId of ["classify-expense", "draft-tax-position", "filing-readiness"]) {
      const line = view(taskId).eligibility.result_line;
      expect(line, taskId).toMatch(/^Result: evaluation blocked because \w/);
      expect(line, taskId).toMatch(/\.$/);
    }
  });

  it("explains why the criteria were not assessed", () => {
    const scorecard = view("draft-tax-position");
    expect(scorecard.criteria_blocked?.headline).toBe("Autonomy criteria were not assessed");
    expect(scorecard.criteria_blocked?.detail).toContain("Eligibility did not pass");
    expect(scorecard.criteria_blocked?.detail).toContain("2.3");
  });

  it("shows the sandbox check only while a material change is pending", () => {
    const withChange = view("filing-readiness").eligibility.checks.map((check) => check.key);
    expect(withChange).toContain("sandbox-revalidation");

    for (const taskId of ["routine-rule-application", "risk-detection", "classify-expense"]) {
      const keys = view(taskId).eligibility.checks.map((check) => check.key);
      expect(keys, taskId).not.toContain("sandbox-revalidation");
    }
  });

  it("reports an absent safety issue as None rather than a pass", () => {
    const safety = view("routine-rule-application").eligibility.checks.find(
      (check) => check.key === "no-safety-issue",
    );
    expect(safety?.status).toBe("none");
    expect(safety?.status_label).toBe("None");
  });

  it("marks stage checks not applicable at the ceiling", () => {
    const scorecard = view("read-invoice-fields");
    const cases = scorecard.eligibility.checks.find((check) => check.key === "enough-cases");
    expect(cases?.status).toBe("not-applicable");
    expect(scorecard.at_ceiling).toBe(true);
    expect(scorecard.criteria_blocked?.headline).toBe("No progression to assess");
  });
});

describe("recommendation summary", () => {
  it("names the failing rate and the requirement it missed", () => {
    const scorecard = view("routine-rule-application");
    expect(scorecard.recommendation.headline).toBe("Remain Supervised");
    expect(scorecard.recommendation.summary).toContain("0.88%");
    expect(scorecard.recommendation.summary).toContain("0.25%");
    expect(scorecard.recommendation.target_level_label).toBe("L4 · Constrained");
    expect(scorecard.recommendation.promotion_available).toBe(false);
  });

  it("reports the evidence shortfall in cases, not percentages", () => {
    const scorecard = view("classify-expense");
    expect(scorecard.recommendation.summary).toContain("78 cases have been evaluated");
    expect(scorecard.recommendation.summary).toContain("300 are required");
  });

  it("says previous autonomy does not carry over for a changed configuration", () => {
    const scorecard = view("filing-readiness");
    expect(scorecard.recommendation.headline).toBe("Evaluation paused");
    expect(scorecard.recommendation.summary).toContain("does not carry over");
  });

  it("offers promotion only where the engine allows it", () => {
    expect(view("match-invoice-to-ledger").recommendation.promotion_available).toBe(true);
    expect(view("routine-rule-application").recommendation.promotion_available).toBe(false);
    expect(view("draft-tax-position").recommendation.promotion_available).toBe(false);
  });

  it("writes a summary for every task", () => {
    for (const task of tasks) {
      expect(view(task.task_id).recommendation.summary.length).toBeGreaterThan(20);
    }
  });
});

describe("scope, classification and configuration", () => {
  it("breaks performance down across all four segments", () => {
    const scorecard = view("routine-rule-application");
    expect(scorecard.scope_rows.map((row) => row.label)).toEqual([
      "Routine NZ",
      "Routine AU",
      "Complex NZ",
      "Complex AU",
    ]);
    expect(scorecard.scope_rows[0]?.verdict_label).toBe("Eligible for promotion");
    expect(scorecard.scope_rows[3]?.verdict_label).toBe("Remain at current level");
  });

  it("shows the figure that actually drives each verdict", () => {
    // Two segments can share an accuracy and differ in verdict, because the
    // verdict turns on confident-but-wrong. Showing only accuracy would make the
    // table look arbitrary, which is the opposite of what this section is for.
    const rows = view("routine-rule-application").scope_rows;
    for (const row of rows) {
      expect(row.confident_wrong_display).toMatch(/%$/);
    }
    const complexNz = rows.find((row) => row.label === "Complex NZ");
    expect(complexNz?.confident_wrong_display).not.toBe("0.0%");
  });

  it("withholds per-segment verdicts while eligibility is failing", () => {
    // A segment cannot be eligible for promotion on a task that is not being
    // assessed at all. The performance figures still stand on their own.
    const blocked = view("draft-tax-position");
    expect(blocked.eligibility.eligible).toBe(false);
    for (const row of blocked.scope_rows) {
      expect(row.verdict).toBeNull();
      expect(row.verdict_label).toBe("Not assessed");
      expect(row.accuracy_display).toMatch(/%$/);
    }
  });

  it("surfaces the unsafe segment on the sandbox candidate", () => {
    const restrict = view("filing-readiness").scope_rows.find(
      (row) => row.verdict === "restrict",
    );
    expect(restrict?.label).toBe("Complex AU");
    expect(restrict?.critical_errors).toBe(1);
  });

  it("shows the classification still awaiting a person", () => {
    const item = view("routine-rule-application").classification;
    expect(item?.result_label).toBe("Material error");
    expect(item?.confirmed).toBe(false);
    expect(item?.status_label).toBe("Awaiting confirmation");
    expect(item?.status_detail).toContain("before it counts as evidence");
  });

  it("reports version alignment, and the one task where it fails", () => {
    expect(view("routine-rule-application").configuration.aligned).toBe(true);
    const mismatch = view("draft-tax-position").configuration;
    expect(mismatch.aligned).toBe(false);
    expect(mismatch.agent_rule_version).toBe("v2.4");
    expect(mismatch.evaluator_rule_version).toBe("v2.3");
    expect(mismatch.current_rule_version).toBe("v2.4");
    expect(mismatch.status_label).toBe("Version mismatch");
  });

  it("names the task's own rule pack, since packs are task-scoped", () => {
    expect(view("routine-rule-application").configuration.rule_pack_name).toBe(
      "Routine tax rules",
    );
    expect(view("draft-tax-position").configuration.rule_pack_name).toBe("Tax position rules");
  });
});
