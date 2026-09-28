import { describe, expect, it } from "vitest";
import { evaluateAllSeededTasks, buildEvaluationInput } from "@/lib/data/evaluation";
import { evaluateTask, REASON_CODES } from "@/lib/engine";

/**
 * The outcome table the product ships with, asserted in one place so a change to
 * the engine or the dataset that moves any task shows up as a named difference
 * rather than as a screen that quietly reads differently.
 */
const EXPECTED: Array<[string, string, string | null]> = [
  ["read-invoice-fields", REASON_CODES.AT_AUTONOMY_CEILING, "constrained"],
  ["classify-expense", REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE, null],
  ["match-invoice-to-ledger", REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL, "constrained"],
  ["detect-invoice-exceptions", REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL, "supervised"],
  ["routine-rule-application", REASON_CODES.HOLD_CONFIDENT_WRONG_RATE, "supervised"],
  ["risk-detection", REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL, "assisted"],
  ["draft-tax-position", REASON_CODES.PAUSED_RULE_VERSION_MISMATCH, null],
  ["filing-readiness", REASON_CODES.SANDBOX_REVALIDATION_REQUIRED, null],
];

describe("seeded outcome table", () => {
  const results = new Map(
    evaluateAllSeededTasks().map((result) => [result.task_id, result] as const),
  );

  it.each(EXPECTED)("%s resolves to %s", (taskId, code, level) => {
    const result = results.get(taskId);
    expect(result).toBeDefined();
    expect(result?.recommendation.code).toBe(code);
    expect(result?.recommendation.recommended_level).toBe(level);
  });

  it("covers exactly three promotion journeys, one per stage", () => {
    const eligible = [...results.values()].filter(
      (result) => result.recommendation.code === REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL,
    );
    expect(eligible).toHaveLength(3);
    expect(eligible.map((result) => result.stage).sort()).toEqual([
      "assisted_to_supervised",
      "shadow_to_assisted",
      "supervised_to_constrained",
    ]);
  });

  it("puts one task in each blocked state", () => {
    const codes = [...results.values()].map((result) => result.recommendation.code);
    expect(codes.filter((code) => code === REASON_CODES.PAUSED_RULE_VERSION_MISMATCH)).toHaveLength(
      1,
    );
    expect(
      codes.filter((code) => code === REASON_CODES.SANDBOX_REVALIDATION_REQUIRED),
    ).toHaveLength(1);
  });
});

describe("confirming a pending classification", () => {
  /**
   * Phase 9 makes this interactive. The engine behaviour it will depend on is
   * asserted here, so the interaction is added to a gate that already works.
   */
  const input = buildEvaluationInput("routine-rule-application");

  it("changes nothing while the classification stays material", () => {
    expect(input).not.toBeNull();
    if (!input) return;
    const confirmed = {
      ...input,
      judgments: input.judgments.map((judgment) =>
        judgment.judgment_id === "JDG-001"
          ? { ...judgment, human_confirmed_result: "material_error" as const }
          : judgment,
      ),
    };
    const result = evaluateTask(confirmed);
    expect(result.recommendation.code).toBe(REASON_CODES.HOLD_CONFIDENT_WRONG_RATE);
    expect(result.metrics.critical_errors).toBe(0);
  });

  it("blocks the assessment once the same classification is confirmed critical", () => {
    expect(input).not.toBeNull();
    if (!input) return;
    const escalated = {
      ...input,
      judgments: input.judgments.map((judgment) =>
        judgment.judgment_id === "JDG-001"
          ? { ...judgment, human_confirmed_result: "critical_error" as const }
          : judgment,
      ),
    };
    const result = evaluateTask(escalated);

    expect(result.metrics.critical_errors).toBe(1);
    expect(result.eligibility.eligible).toBe(false);
    expect(result.eligibility.blocking?.key).toBe("no-blocking-issue");
    expect(result.criteria).toBeNull();
    expect(result.recommendation.promotion_available).toBe(false);

    // The error falls in Complex AU while the routine segments stay clean, so the
    // engine argues for a narrower fence rather than stopping the task outright.
    expect(result.recommendation.code).toBe(REASON_CODES.RESTRICT_SCOPE);
    expect(result.recommendation.detail.unsafe_segments).toBe("Complex AU");
  });

  it("returns to the original outcome when the confirmation is withdrawn", () => {
    expect(input).not.toBeNull();
    if (!input) return;
    const before = evaluateTask(input);
    const escalated = evaluateTask({
      ...input,
      judgments: input.judgments.map((judgment) =>
        judgment.judgment_id === "JDG-001"
          ? { ...judgment, human_confirmed_result: "critical_error" as const }
          : judgment,
      ),
    });
    const restored = evaluateTask(input);

    expect(escalated.recommendation.code).not.toBe(before.recommendation.code);
    expect(JSON.stringify(restored)).toBe(JSON.stringify(before));
  });
});
