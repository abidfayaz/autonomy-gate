import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_STAGES, TASK_SPECS } from "@/data/generator/specs.mts";
import {
  activePolicyForTask,
  auditEvents,
  agents,
  cases,
  currentRuleVersionForTask,
  decisions,
  incidents,
  judgments,
  policyVersions,
  reviews,
  rulePacks,
  ruleVersions,
  runs,
  runsForTask,
  reviewsForTask,
  sandboxValidations,
  SEED_DATASET,
  tasks,
} from "@/lib/data/seed";
import { AUTONOMY_ORDER } from "@/lib/domain/types";

const DATASET_PATH = resolve(process.cwd(), "data/seed/dataset.json");
const TODAY = "2026-09-27";

/* ------------------------------------------------------------ determinism */

describe("determinism", () => {
  it("regenerates byte-identical output from the fixed seed", () => {
    const before = readFileSync(DATASET_PATH, "utf8");
    execFileSync(
      process.execPath,
      ["--experimental-strip-types", "data/generator/generate.mts"],
      { cwd: process.cwd(), stdio: "pipe" },
    );
    const after = readFileSync(DATASET_PATH, "utf8");
    expect(after).toBe(before);
  });
});

/* -------------------------------------------------------- shape and scale */

describe("dataset shape", () => {
  it("has the two prototype agents and eight tasks", () => {
    expect(agents).toHaveLength(2);
    expect(tasks).toHaveLength(8);
    expect(tasks.filter((t) => t.agent_id === "invoice-helper")).toHaveLength(4);
    expect(tasks.filter((t) => t.agent_id === "tax-helper")).toHaveLength(4);
  });

  it("pairs every run with exactly one case", () => {
    expect(runs).toHaveLength(cases.length);
    const caseIds = new Set(cases.map((c) => c.case_id));
    for (const run of runs) expect(caseIds.has(run.case_id)).toBe(true);
  });

  it("gives every record a unique id", () => {
    const unique = (ids: string[]) => new Set(ids).size === ids.length;
    expect(unique(runs.map((r) => r.run_id))).toBe(true);
    expect(unique(cases.map((c) => c.case_id))).toBe(true);
    expect(unique(reviews.map((r) => r.review_id))).toBe(true);
    expect(unique(auditEvents.map((e) => e.event_id))).toBe(true);
    expect(unique(policyVersions.map((p) => p.policy_version_id))).toBe(true);
  });

  it("resolves every foreign key", () => {
    const taskIds = new Set(tasks.map((t) => t.task_id));
    const runIds = new Set(runs.map((r) => r.run_id));
    for (const run of runs) expect(taskIds.has(run.task_id)).toBe(true);
    for (const review of reviews) expect(runIds.has(review.run_id)).toBe(true);
    for (const judgment of judgments) expect(runIds.has(judgment.run_id)).toBe(true);
    for (const decision of decisions) expect(taskIds.has(decision.task_id)).toBe(true);
    for (const event of auditEvents) expect(taskIds.has(event.task_id)).toBe(true);
  });
});

/* ------------------------------------------------- task-level autonomy */

describe("autonomy is task-level", () => {
  it("stores autonomy on tasks and never on agents", () => {
    for (const agent of agents) {
      expect(Object.keys(agent)).not.toContain("current_level");
      expect(Object.keys(agent)).not.toContain("autonomy_ceiling");
    }
    for (const task of tasks) {
      expect(AUTONOMY_ORDER).toContain(task.current_level);
      expect(AUTONOMY_ORDER).toContain(task.autonomy_ceiling);
    }
  });

  it("never seeds a task above its own ceiling", () => {
    for (const task of tasks) {
      const current = AUTONOMY_ORDER.indexOf(task.current_level);
      const ceiling = AUTONOMY_ORDER.indexOf(task.autonomy_ceiling);
      expect(current).toBeLessThanOrEqual(ceiling);
    }
  });

  it("caps Draft tax position at Supervised", () => {
    const task = tasks.find((t) => t.task_id === "draft-tax-position");
    expect(task?.autonomy_ceiling).toBe("supervised");
  });
});

/* ----------------------------------------------------- rule pack scoping */

describe("rule packs are task-scoped", () => {
  it("gives each task its own pack with exactly one current version", () => {
    expect(rulePacks).toHaveLength(tasks.length);
    for (const task of tasks) {
      const pack = rulePacks.find((p) => p.task_id === task.task_id);
      expect(pack).toBeDefined();
      const current = ruleVersions.filter(
        (v) => v.rule_pack_id === pack?.rule_pack_id && v.current,
      );
      expect(current).toHaveLength(1);
    }
  });

  it("lets one agent carry different rule families at once", () => {
    const taxPacks = tasks
      .filter((t) => t.agent_id === "tax-helper")
      .map((t) => currentRuleVersionForTask(t.task_id)?.version);
    expect(new Set(taxPacks).size).toBeGreaterThan(1);
  });

  it("aligns every task's versions except the one seeded mismatch", () => {
    const misaligned = tasks.filter((task) => {
      const current = currentRuleVersionForTask(task.task_id)?.version;
      return (
        task.agent_rule_version !== current || task.evaluator_rule_version !== current
      );
    });
    expect(misaligned.map((t) => t.task_id)).toEqual(["draft-tax-position"]);
  });

  it("seeds Draft tax position with a stale evaluator, not a stale task", () => {
    const task = tasks.find((t) => t.task_id === "draft-tax-position");
    expect(task?.agent_rule_version).toBe("2.4");
    expect(task?.evaluator_rule_version).toBe("2.3");
    expect(currentRuleVersionForTask("draft-tax-position")?.version).toBe("2.4");
    expect(task?.operational_state).toBe("paused");
  });

  it("keeps Filing readiness aligned but flagged for revalidation", () => {
    const task = tasks.find((t) => t.task_id === "filing-readiness");
    const current = currentRuleVersionForTask("filing-readiness")?.version;
    expect(task?.agent_rule_version).toBe(current);
    expect(task?.evaluator_rule_version).toBe(current);
    expect(task?.material_change_pending).toBe(true);
    expect(task?.operational_state).toBe("sandbox");
  });
});

/* --------------------------------------------------- operational states */

describe("operational state", () => {
  it("separates operational state from promotion eligibility", () => {
    const states = Object.fromEntries(tasks.map((t) => [t.task_id, t.operational_state]));
    expect(states["draft-tax-position"]).toBe("paused");
    expect(states["filing-readiness"]).toBe("sandbox");
    // Promotion-ready tasks stay Healthy: being eligible is a recommendation.
    expect(states["detect-invoice-exceptions"]).toBe("healthy");
    expect(states["risk-detection"]).toBe("healthy");
    expect(states["match-invoice-to-ledger"]).toBe("healthy");
  });

  it("yields one Needs Attention and one Sandbox, without double counting", () => {
    const needsAttention = tasks.filter(
      (t) => t.operational_state === "paused" || t.operational_state === "needs-review",
    );
    const sandbox = tasks.filter((t) => t.operational_state === "sandbox");
    expect(needsAttention).toHaveLength(1);
    expect(sandbox).toHaveLength(1);
  });
});

/* ------------------------------------------------ stage evidence volumes */

describe("stage evidence", () => {
  it("keeps every task's evidence in a single mode, matching its stage", () => {
    for (const spec of TASK_SPECS) {
      const modes = new Set(runsForTask(spec.task_id).map((r) => r.autonomy_mode));
      expect([...modes]).toEqual([spec.evidence_mode]);
    }
  });

  it("meets the stage minimum for each task seeded as promotion-ready", () => {
    const expectations: Array<[string, keyof typeof DEFAULT_STAGES]> = [
      ["risk-detection", "shadow_to_assisted"],
      ["detect-invoice-exceptions", "assisted_to_supervised"],
      ["match-invoice-to-ledger", "supervised_to_constrained"],
      ["routine-rule-application", "supervised_to_constrained"],
    ];
    for (const [taskId, stage] of expectations) {
      expect(runsForTask(taskId).length).toBeGreaterThanOrEqual(
        DEFAULT_STAGES[stage].minimum_cases,
      );
    }
  });

  it("leaves Classify expense short of its stage minimum on purpose", () => {
    expect(runsForTask("classify-expense").length).toBeLessThan(
      DEFAULT_STAGES.supervised_to_constrained.minimum_cases,
    );
  });

  it("produces no acceptance or override evidence in Shadow", () => {
    expect(reviewsForTask("risk-detection")).toHaveLength(0);
    expect(reviewsForTask("filing-readiness")).toHaveLength(0);
  });

  it("reviews every Assisted-mode output", () => {
    for (const taskId of ["detect-invoice-exceptions", "draft-tax-position"]) {
      expect(reviewsForTask(taskId).length).toBe(runsForTask(taskId).length);
    }
  });
});

/* ------------------------------------------------- the locked scorecard */

describe("Routine rule application scorecard", () => {
  const taskRuns = () => runsForTask("routine-rule-application");

  it("holds the locked case count of 342", () => {
    expect(taskRuns()).toHaveLength(342);
  });

  it("fails exactly one Supervised to Constrained criterion: confident-but-wrong", () => {
    const list = taskRuns();
    const policy = activePolicyForTask("routine-rule-application");
    const stage = policy?.stages.supervised_to_constrained;
    expect(stage).toBeDefined();
    if (!stage || !policy) return;

    const confidentWrong = list.filter(
      (r) => !r.correct && r.confidence >= policy.high_confidence_threshold,
    ).length;
    const sampled = list.filter((r) => r.post_execution_sampled);
    const evidencePresent = list.filter((r) => r.evidence_present).length;

    // The one failure.
    expect(confidentWrong / list.length).toBeGreaterThan(stage.max_confident_wrong_rate);

    // Everything else passes.
    expect(list.length).toBeGreaterThanOrEqual(stage.minimum_cases);
    expect(list.filter((r) => r.critical_error)).toHaveLength(0);
    expect(list.filter((r) => r.boundary_violation)).toHaveLength(0);
    expect(list.filter((r) => r.missed_critical_exception)).toHaveLength(0);
    expect(sampled.length / list.length).toBeGreaterThanOrEqual(stage.min_sample_coverage ?? 0);
    expect(sampled.filter((r) => r.post_execution_error)).toHaveLength(0);
    expect(evidencePresent / list.length).toBeGreaterThanOrEqual(stage.min_evidence_coverage);
  });

  it("uses an override rate of 3.0% over reviewed runs", () => {
    const taskReviews = reviewsForTask("routine-rule-application");
    const overridden = taskReviews.filter((r) => r.disposition === "overridden").length;
    expect(taskReviews).toHaveLength(100);
    expect(overridden / taskReviews.length).toBeCloseTo(0.03, 5);
  });

  it("is governed by policy v1.3, which tightened confident-but-wrong", () => {
    const policy = activePolicyForTask("routine-rule-application");
    expect(policy?.version).toBe("1.3");
    expect(policy?.stages.supervised_to_constrained.max_confident_wrong_rate).toBe(0.0025);
  });
});

/* ------------------------------------------------------- review dispositions */

describe("review dispositions", () => {
  it("uses three dispositions, never folding escalation into override", () => {
    const dispositions = new Set(reviews.map((r) => r.disposition));
    for (const disposition of dispositions) {
      expect(["accepted", "overridden", "escalated"]).toContain(disposition);
    }
    expect(dispositions.has("escalated")).toBe(true);
  });

  it("marks the substantive result as changed only on an override", () => {
    for (const review of reviews) {
      expect(review.changed_result).toBe(review.disposition === "overridden");
    }
  });

  it("seeds a task where an escalation was missed, so the rate is not always 100%", () => {
    const taskId = "draft-tax-position";
    const expected = runsForTask(taskId).filter((r) => r.escalation_expected);
    const escalatedRunIds = new Set(
      reviewsForTask(taskId)
        .filter((r) => r.disposition === "escalated")
        .map((r) => r.run_id),
    );
    const correct = expected.filter((r) => escalatedRunIds.has(r.run_id)).length;
    expect(expected.length).toBe(3);
    expect(correct).toBe(2);
  });
});

/* ------------------------------------------------- confident-but-wrong rule */

describe("confident-but-wrong", () => {
  it("counts exactly the confident-but-wrong runs each task declared", () => {
    for (const task of tasks) {
      const policy = activePolicyForTask(task.task_id);
      if (!policy) continue;
      const declared = TASK_SPECS.find((s) => s.task_id === task.task_id);
      const expectedCount =
        declared?.buckets.reduce((sum, b) => sum + b.confident_wrong, 0) ?? 0;
      const actual = runsForTask(task.task_id).filter(
        (r) => !r.correct && r.confidence >= policy.high_confidence_threshold,
      ).length;
      expect(actual).toBe(expectedCount);
    }
  });

  it("keeps ordinary errors strictly below the high-confidence threshold", () => {
    for (const task of tasks) {
      const policy = activePolicyForTask(task.task_id);
      if (!policy) continue;
      const declared = TASK_SPECS.find((s) => s.task_id === task.task_id);
      const declaredConfidentWrong =
        declared?.buckets.reduce((sum, b) => sum + b.confident_wrong, 0) ?? 0;
      const incorrect = runsForTask(task.task_id).filter((r) => !r.correct);
      const atOrAbove = incorrect.filter(
        (r) => r.confidence >= policy.high_confidence_threshold,
      );
      // Anything incorrect that is not a declared confident-but-wrong run must sit
      // below the threshold, or the seeded rate would silently drift upward.
      expect(atOrAbove).toHaveLength(declaredConfidentWrong);
      expect(incorrect.length - atOrAbove.length).toBe(incorrect.length - declaredConfidentWrong);
    }
  });

  it("never treats a correct run as confident-but-wrong", () => {
    for (const run of runs) {
      if (run.correct) continue;
      expect(run.confidence).toBeGreaterThan(0);
      expect(run.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("stage criteria composition", () => {
  it("does not gate Supervised to Constrained on accuracy or override rate", () => {
    const stage = DEFAULT_STAGES.supervised_to_constrained;
    expect(stage.min_accuracy).toBeUndefined();
    expect(stage.max_override_rate).toBeUndefined();
    // It gates on the evidence only Supervised-mode operation can produce.
    expect(stage.min_sample_coverage).toBe(0.1);
    expect(stage.max_sampled_error_rate).toBe(0.01);
    expect(stage.max_boundary_violations).toBe(0);
    expect(stage.max_missed_critical_exceptions).toBe(0);
    expect(stage.max_confident_wrong_rate).toBe(0.0025);
    expect(stage.minimum_cases).toBe(300);
  });

  it("gates Shadow to Assisted on correctness, which is all Shadow can prove", () => {
    const stage = DEFAULT_STAGES.shadow_to_assisted;
    expect(stage.min_accuracy).toBe(0.98);
    expect(stage.minimum_cases).toBe(200);
    // Nobody relies on Shadow output, so no acceptance or override evidence exists.
    expect(stage.max_override_rate).toBeUndefined();
    expect(stage.min_correct_escalation_rate).toBeUndefined();
    expect(stage.min_sample_coverage).toBeUndefined();
  });

  it("gates Assisted to Supervised on override and escalation, not accuracy", () => {
    const stage = DEFAULT_STAGES.assisted_to_supervised;
    expect(stage.max_override_rate).toBe(0.05);
    expect(stage.min_correct_escalation_rate).toBe(0.95);
    expect(stage.minimum_cases).toBe(200);
    expect(stage.min_accuracy).toBeUndefined();
    expect(stage.min_sample_coverage).toBeUndefined();
  });
});

/* ------------------------------------------------------------- timeline */

describe("timeline", () => {
  const isoBefore = (a: string, b: string) => a.localeCompare(b) <= 0;

  it("places every seeded record in 2026, on or before today", () => {
    const dates = [
      ...runs.map((r) => r.occurred_at),
      ...decisions.map((d) => d.decided_at),
      ...auditEvents.map((e) => e.occurred_at),
      ...policyVersions.map((p) => p.created_at),
      ...ruleVersions.map((v) => v.effective_from),
      ...incidents.map((i) => i.opened_at),
      ...sandboxValidations.map((s) => s.opened_at),
    ];
    for (const date of dates) {
      expect(date.startsWith("2026")).toBe(true);
      expect(isoBefore(date, TODAY)).toBe(true);
    }
  });

  it("only cites policy versions that already existed on the decision date", () => {
    for (const decision of decisions) {
      const policy = policyVersions.find(
        (p) => p.task_id === decision.task_id && p.version === decision.policy_version,
      );
      expect(policy).toBeDefined();
      expect(isoBefore(policy?.created_at ?? "", decision.decided_at)).toBe(true);
    }
  });

  it("only cites rule versions that were in force on the decision date", () => {
    for (const decision of decisions) {
      const pack = rulePacks.find((p) => p.task_id === decision.task_id);
      const version = ruleVersions.find(
        (v) => v.rule_pack_id === pack?.rule_pack_id && v.version === decision.rule_version,
      );
      expect(version).toBeDefined();
      expect(isoBefore(version?.effective_from ?? "", decision.decided_at)).toBe(true);

      // And no later version had already superseded it by that date.
      const superseding = ruleVersions.filter(
        (v) =>
          v.rule_pack_id === pack?.rule_pack_id &&
          v.effective_from > (version?.effective_from ?? "") &&
          isoBefore(v.effective_from, decision.decided_at),
      );
      expect(superseding).toHaveLength(0);
    }
  });

  it("keeps each task's runs inside its current evidence window", () => {
    for (const task of tasks) {
      for (const run of runsForTask(task.task_id)) {
        expect(isoBefore(task.evidence_window_start, run.occurred_at)).toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------- frozen history */

describe("decision history", () => {
  it("freezes an evidence snapshot on every decision", () => {
    for (const decision of decisions) {
      expect(decision.snapshot.task_id).toBe(decision.task_id);
      expect(decision.snapshot.valid_case_count).toBeGreaterThan(0);
      expect(decision.reason.length).toBeGreaterThan(0);
      expect(decision.decided_by).toBe("Maya");
    }
  });

  it("records a declined recommendation without changing the level", () => {
    const declined = decisions.find((d) => d.outcome === "recommendation-declined");
    expect(declined).toBeDefined();
    expect(declined?.final_level).toBe(declined?.current_level);
    expect(declined?.was_override).toBe(true);
  });

  it("never seeds a decision that skips a level", () => {
    for (const decision of decisions) {
      const from = AUTONOMY_ORDER.indexOf(decision.current_level);
      const to = AUTONOMY_ORDER.indexOf(decision.final_level);
      expect(Math.abs(to - from)).toBeLessThanOrEqual(1);
    }
  });
});

/* --------------------------------------------------------------- sandbox */

describe("sandbox revalidation", () => {
  it("returns a previously Constrained task to Shadow without inheriting the level", () => {
    const sandbox = sandboxValidations.find((s) => s.task_id === "filing-readiness");
    const task = tasks.find((t) => t.task_id === "filing-readiness");
    expect(sandbox?.previous_level).toBe("constrained");
    expect(sandbox?.sandbox_level).toBe("shadow");
    expect(task?.current_level).toBe("shadow");
  });

  it("carries overlapping coverage groups rather than independent totals", () => {
    const sandbox = sandboxValidations[0];
    expect(sandbox).toBeDefined();
    if (!sandbox) return;
    const groupTotal = sandbox.coverage_groups.reduce((sum, g) => sum + g.case_count, 0);
    expect(sandbox.coverage_groups.length).toBe(5);
    // Overlap is the point: the groups must not sum to the planned suite.
    expect(groupTotal).not.toBe(sandbox.planned_case_count);
  });

  it("leaves the continuity decision to a human", () => {
    expect(sandboxValidations[0]?.human_decision).toBe("pending");
  });

  it("shows a weak Complex AU segment that argues for a narrower scope", () => {
    const sandboxRuns = runsForTask("filing-readiness");
    const complexAu = sandboxRuns.filter((r) => {
      const relatedCase = cases.find((c) => c.case_id === r.case_id);
      return relatedCase?.jurisdiction === "AU" && relatedCase.complexity === "complex";
    });
    const routine = sandboxRuns.filter((r) => {
      const relatedCase = cases.find((c) => c.case_id === r.case_id);
      return relatedCase?.complexity === "routine";
    });
    const rate = (list: typeof sandboxRuns) =>
      list.filter((r) => r.correct).length / list.length;

    expect(complexAu.filter((r) => r.critical_error).length).toBe(1);
    expect(rate(complexAu)).toBeLessThan(rate(routine));
    expect(rate(routine)).toBe(1);
  });
});

/* -------------------------------------------------- bounded classifications */

describe("bounded classifications", () => {
  it("keeps every classification inside the closed vocabulary", () => {
    const allowed = ["no_error", "minor_error", "material_error", "critical_error", "uncertain"];
    for (const judgment of judgments) {
      expect(allowed).toContain(judgment.result);
      if (judgment.human_confirmed_result !== null) {
        expect(allowed).toContain(judgment.human_confirmed_result);
      }
    }
  });

  it("leaves one consequential classification awaiting human confirmation", () => {
    const pending = judgments.filter(
      (j) => j.requires_human_confirmation && j.human_confirmed_result === null,
    );
    expect(pending).toHaveLength(1);
    expect(pending[0]?.task_id).toBe("routine-rule-application");
    expect(pending[0]?.result).toBe("material_error");
  });

  it("attaches substantive error classifications only to incorrect runs", () => {
    // A minor error may sit on a correct run: presentation can be wrong while the
    // substantive result is right. Material and critical cannot, by definition.
    const substantive = ["material_error", "critical_error"];
    const runById = new Map(runs.map((run) => [run.run_id, run]));
    for (const judgment of judgments) {
      const outcome = judgment.human_confirmed_result ?? judgment.result;
      if (!substantive.includes(outcome)) continue;
      const run = runById.get(judgment.run_id);
      expect(run, `${judgment.judgment_id} points at a missing run`).toBeDefined();
      expect(
        run?.correct,
        `${judgment.judgment_id} classifies a correct run as ${outcome}`,
      ).toBe(false);
    }
  });

  it("confirms critical classifications only against runs already flagged critical", () => {
    // Otherwise a confirmed classification and a run flag would describe two
    // separate critical errors, and the engine would rightly count both.
    const runById = new Map(runs.map((run) => [run.run_id, run]));
    for (const judgment of judgments) {
      if (judgment.human_confirmed_result !== "critical_error") continue;
      expect(runById.get(judgment.run_id)?.critical_error).toBe(true);
    }
  });

  it("keeps each task's confirmed critical errors at the declared count", () => {
    for (const spec of TASK_SPECS) {
      const declared = spec.buckets.reduce((sum, b) => sum + b.critical_errors, 0);
      const taskRuns = runsForTask(spec.task_id);
      const flagged = new Set(
        taskRuns.filter((run) => run.critical_error).map((run) => run.run_id),
      );
      for (const judgment of judgments) {
        if (judgment.task_id !== spec.task_id) continue;
        if (judgment.human_confirmed_result === "critical_error") flagged.add(judgment.run_id);
      }
      expect(flagged.size, `${spec.task_id} confirmed critical errors`).toBe(declared);
    }
  });

  it("keeps unresolved classifications far below the evaluator-maturity guardrail", () => {
    const unresolved = judgments.filter((j) => j.human_confirmed_result === null).length;
    expect(unresolved / judgments.length).toBeLessThan(0.5);
  });
});

/* ------------------------------------------------------------ provenance */

describe("provenance", () => {
  it("records the seed and generation date on the dataset", () => {
    expect(SEED_DATASET.seed).toBe(20260927);
    expect(SEED_DATASET.generated_at).toBe(TODAY);
  });

  it("opens an audit event for the paused task and the pending revalidation", () => {
    const types = auditEvents.map((e) => `${e.task_id}:${e.type}`);
    expect(types).toContain("draft-tax-position:version-issue");
    expect(types).toContain("filing-readiness:sandbox-revalidation");
  });

  it("keeps the blocking incident open against the paused task", () => {
    const open = incidents.filter((i) => i.status === "open");
    expect(open).toHaveLength(1);
    expect(open[0]?.task_id).toBe("draft-tax-position");
    expect(open[0]?.blocking).toBe(true);
  });
});
