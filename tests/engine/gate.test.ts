import { describe, expect, it } from "vitest";
import { evaluateAllSeededTasks, evaluateSeededTask } from "@/lib/data/evaluation";
import { REASON_CODES } from "@/lib/engine";

/**
 * The gate applied to the seeded dataset: the outcome every screen will render.
 */

const evaluate = (taskId: string) => {
  const result = evaluateSeededTask(taskId);
  expect(result, `no evaluation for ${taskId}`).not.toBeNull();
  if (!result) throw new Error("unreachable");
  return result;
};

describe("seeded gate outcomes", () => {
  it("produces a recommendation for every task", () => {
    const results = evaluateAllSeededTasks();
    expect(results).toHaveLength(8);
    for (const result of results) {
      expect(result.recommendation.code).toBeTruthy();
      expect(result.recommendation.label).toBeTruthy();
    }
  });

  it("holds Routine rule application on confident-but-wrong alone", () => {
    const result = evaluate("routine-rule-application");

    expect(result.eligibility.eligible).toBe(true);
    expect(result.recommendation.code).toBe(REASON_CODES.HOLD_CONFIDENT_WRONG_RATE);
    expect(result.recommendation.label).toBe("Remain at current level");
    expect(result.recommendation.promotion_available).toBe(false);
    expect(result.target_level).toBe("constrained");

    expect(result.criteria).not.toBeNull();
    expect(result.criteria?.failed).toHaveLength(1);
    expect(result.criteria?.failed[0]?.key).toBe("confident-wrong");
    expect(result.recommendation.detail.required_max).toBe(0.0025);
  });

  it("recommends Constrained for Match invoice to ledger, with a fence", () => {
    const result = evaluate("match-invoice-to-ledger");

    expect(result.eligibility.eligible).toBe(true);
    expect(result.recommendation.code).toBe(REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL);
    expect(result.recommendation.recommended_level).toBe("constrained");
    expect(result.recommendation.promotion_available).toBe(true);
    // Constrained is never granted without an explicit scope.
    expect(result.recommendation.recommended_scope).not.toBeNull();
    expect(result.criteria?.satisfied).toBe(true);
  });

  it("recommends Supervised for Detect invoice exceptions", () => {
    const result = evaluate("detect-invoice-exceptions");

    expect(result.recommendation.code).toBe(REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL);
    expect(result.recommendation.recommended_level).toBe("supervised");
    expect(result.stage).toBe("assisted_to_supervised");
  });

  it("recommends Assisted for Risk detection", () => {
    const result = evaluate("risk-detection");

    expect(result.recommendation.code).toBe(REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL);
    expect(result.recommendation.recommended_level).toBe("assisted");
    expect(result.stage).toBe("shadow_to_assisted");
  });

  it("holds Classify expense for want of stage evidence, without grading it", () => {
    const result = evaluate("classify-expense");

    expect(result.recommendation.code).toBe(REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE);
    expect(result.eligibility.eligible).toBe(false);
    // The point of the eligibility gate: criteria are not assessed at all.
    expect(result.criteria).toBeNull();
  });

  it("pauses Draft tax position on the rule-version mismatch", () => {
    const result = evaluate("draft-tax-position");

    expect(result.recommendation.code).toBe(REASON_CODES.PAUSED_RULE_VERSION_MISMATCH);
    expect(result.recommendation.label).toBe("Evaluation paused");
    expect(result.criteria).toBeNull();
    expect(result.recommendation.promotion_available).toBe(false);
  });

  it("requires revalidation for Filing readiness before anything else is asked", () => {
    const result = evaluate("filing-readiness");

    expect(result.recommendation.code).toBe(REASON_CODES.SANDBOX_REVALIDATION_REQUIRED);
    expect(result.criteria).toBeNull();
    // The sandbox check takes precedence over the confirmed critical error, because
    // a changed configuration is questioned before anything measured from it.
    expect(result.eligibility.blocking?.key).toBe("sandbox-revalidation");
  });

  it("reports Read invoice fields as already at its ceiling", () => {
    const result = evaluate("read-invoice-fields");

    expect(result.at_ceiling).toBe(true);
    expect(result.target_level).toBeNull();
    expect(result.recommendation.code).toBe(REASON_CODES.AT_AUTONOMY_CEILING);
    expect(result.recommendation.promotion_available).toBe(false);
  });

  it("never recommends a level beyond a task's ceiling", () => {
    for (const result of evaluateAllSeededTasks()) {
      if (result.recommendation.recommended_level === null) continue;
      const order = ["shadow", "assisted", "supervised", "constrained"];
      const recommended = order.indexOf(result.recommendation.recommended_level);
      const current = order.indexOf(result.current_level);
      expect(Math.abs(recommended - current)).toBeLessThanOrEqual(1);
    }
  });

  it("offers promotion only from an eligible assessment", () => {
    for (const result of evaluateAllSeededTasks()) {
      if (!result.recommendation.promotion_available) continue;
      expect(result.eligibility.eligible).toBe(true);
      expect(result.criteria?.satisfied).toBe(true);
    }
  });
});

describe("scope segmentation", () => {
  it("breaks Routine rule application down by jurisdiction and complexity", () => {
    const result = evaluate("routine-rule-application");
    expect(result.scope.segments.map((segment) => segment.label)).toEqual([
      "Routine NZ",
      "Routine AU",
      "Complex NZ",
      "Complex AU",
    ]);
  });

  it("marks the routine segments eligible while the complex ones hold", () => {
    const result = evaluate("routine-rule-application");
    const verdicts = Object.fromEntries(
      result.scope.segments.map((segment) => [segment.label, segment.verdict]),
    );
    expect(verdicts["Routine NZ"]).toBe("eligible");
    expect(verdicts["Routine AU"]).toBe("eligible");
    expect(verdicts["Complex NZ"]).toBe("remain");
    expect(verdicts["Complex AU"]).toBe("remain");
    // No segment is unsafe, so narrowing is not the recommendation.
    expect(result.scope.unsafe).toHaveLength(0);
  });

  it("surfaces the unsafe Complex AU segment on the sandbox candidate", () => {
    const result = evaluate("filing-readiness");
    const complexAu = result.scope.segments.find((segment) => segment.label === "Complex AU");
    expect(complexAu?.critical_errors).toBe(1);
    expect(complexAu?.verdict).toBe("restrict");
    expect(result.scope.unsafe.map((segment) => segment.label)).toEqual(["Complex AU"]);
  });

  it("never lets a strong aggregate hide a weak segment", () => {
    const result = evaluate("filing-readiness");
    const worst = Math.min(...result.scope.segments.map((segment) => segment.accuracy));
    expect(result.metrics.accuracy).toBeGreaterThan(worst);
    expect(worst).toBeLessThan(0.95);
  });
});

describe("stage-specific criteria", () => {
  it("gates Supervised to Constrained on post-execution evidence, not accuracy", () => {
    const result = evaluate("routine-rule-application");
    const keys = result.criteria?.criteria.map((criterion) => criterion.key) ?? [];

    expect(keys).toContain("sample-coverage");
    expect(keys).toContain("sampled-error-rate");
    expect(keys).toContain("boundary-violations");
    expect(keys).toContain("missed-critical-exceptions");
    // Accuracy and override rate are context at this stage, not criteria.
    expect(keys).not.toContain("accuracy");
    expect(keys).not.toContain("override-rate");

    const additional = result.criteria?.additional.map((item) => item.key) ?? [];
    expect(additional).toContain("accuracy-context");
    expect(additional).toContain("override-context");
  });

  it("gates Assisted to Supervised on override and escalation, not accuracy", () => {
    const result = evaluate("detect-invoice-exceptions");
    const keys = result.criteria?.criteria.map((criterion) => criterion.key) ?? [];

    expect(keys).toContain("override-rate");
    expect(keys).toContain("correct-escalation");
    expect(keys).not.toContain("accuracy");
    expect(keys).not.toContain("sample-coverage");
  });

  it("gates Shadow to Assisted on correctness, which is all Shadow can prove", () => {
    const result = evaluate("risk-detection");
    const keys = result.criteria?.criteria.map((criterion) => criterion.key) ?? [];

    expect(keys).toContain("accuracy");
    expect(keys).toContain("confident-wrong");
    expect(keys).not.toContain("override-rate");
    expect(keys).not.toContain("sample-coverage");
    // Shadow produced no acceptance or override evidence at all.
    expect(result.metrics.human_override_rate).toBeNull();
    expect(result.metrics.human_acceptance_rate).toBeNull();
  });
});
