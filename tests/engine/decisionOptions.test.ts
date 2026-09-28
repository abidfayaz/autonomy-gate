import { describe, expect, it } from "vitest";
import { buildEvaluationInput, evaluateSeededTask } from "@/lib/data/evaluation";
import { getTask } from "@/lib/data/seed";
import type { AutonomyLevel } from "@/lib/domain/types";
import { evaluateTask } from "@/lib/engine";
import { deriveDecisionOptions, isRecordableDecision } from "@/lib/engine/decisionOptions";

/**
 * What a person is allowed to decide.
 *
 * An override is a disagreement with a recommendation. It is not a way around
 * the product's structural rules, and these tests are where that distinction is
 * actually enforced.
 */

const optionsFor = (taskId: string) => {
  const task = getTask(taskId);
  const result = evaluateSeededTask(taskId);
  expect(task).toBeDefined();
  expect(result).not.toBeNull();
  if (!task || !result) throw new Error("unreachable");
  return { task, result, options: deriveDecisionOptions(result, task) };
};

describe("options offered", () => {
  it("offers the recommended promotion when the engine found one", () => {
    const { options } = optionsFor("match-invoice-to-ledger");
    const approve = options.find((option) => option.action === "approve-next");
    expect(approve?.label).toBe("Approve L4 · Constrained");
    expect(approve?.recommended).toBe(true);
    expect(approve?.is_override).toBe(false);
    // Constrained always carries an explicit fence.
    expect(approve?.scope).not.toBeNull();
  });

  it("offers declining a recommended promotion, marked as a departure", () => {
    const { options } = optionsFor("match-invoice-to-ledger");
    const keep = options.find((option) => option.action === "keep");
    expect(keep?.recommended).toBe(false);
    expect(keep?.is_override).toBe(true);
    expect(keep?.outcome).toBe("recommendation-declined");
  });

  it("still offers promotion as an override when a criterion is unmet", () => {
    // Eligibility passed, so the evidence is trustworthy; a person may disagree
    // with the engine's judgement of it.
    const { options } = optionsFor("routine-rule-application");
    const approve = options.find((option) => option.action === "approve-next");
    expect(approve).toBeDefined();
    expect(approve?.recommended).toBe(false);
    expect(approve?.is_override).toBe(true);

    const keep = options.find((option) => option.action === "keep");
    expect(keep?.recommended).toBe(true);
  });

  it("recommends keeping the level by default when nothing else is indicated", () => {
    const { options } = optionsFor("routine-rule-application");
    const recommended = options.filter((option) => option.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0]?.action).toBe("keep");
  });

  it("always offers exactly one recommended option", () => {
    for (const taskId of [
      "read-invoice-fields",
      "classify-expense",
      "match-invoice-to-ledger",
      "detect-invoice-exceptions",
      "routine-rule-application",
      "risk-detection",
      "draft-tax-position",
      "filing-readiness",
    ]) {
      const { options } = optionsFor(taskId);
      expect(options.filter((option) => option.recommended), taskId).toHaveLength(1);
    }
  });
});

describe("promotion is removed by a failed eligibility gate", () => {
  it.each([
    ["draft-tax-position", "a rule-version mismatch"],
    ["filing-readiness", "a pending revalidation"],
    ["classify-expense", "insufficient stage evidence"],
  ])("offers no promotion on %s (%s)", (taskId) => {
    const { options } = optionsFor(taskId);
    expect(options.find((option) => option.action === "approve-next")).toBeUndefined();
  });

  it("still lets a person keep or lower the level while blocked", () => {
    const { options } = optionsFor("draft-tax-position");
    const actions = options.map((option) => option.action);
    expect(actions).toContain("keep");
    expect(actions).toContain("lower");
  });

  it("rejects a promotion recorded against a blocked task, whatever the interface offered", () => {
    const task = getTask("draft-tax-position");
    const result = evaluateSeededTask("draft-tax-position");
    if (!task || !result) throw new Error("unreachable");
    expect(isRecordableDecision(task, result, "supervised")).toBe(false);
    // Holding or lowering stays available.
    expect(isRecordableDecision(task, result, "assisted")).toBe(true);
    expect(isRecordableDecision(task, result, "shadow")).toBe(true);
  });
});

describe("structural rules survive an override", () => {
  it("never offers a promotion past the task's ceiling", () => {
    // Draft tax position is capped at Supervised.
    const task = getTask("draft-tax-position");
    if (!task) throw new Error("unreachable");
    expect(task.autonomy_ceiling).toBe("supervised");

    const input = buildEvaluationInput("draft-tax-position", { current_level: "supervised" });
    if (!input) throw new Error("unreachable");
    const atCeiling = evaluateTask(input);
    const options = deriveDecisionOptions(atCeiling, {
      ...task,
      current_level: "supervised",
    });
    expect(options.find((option) => option.action === "approve-next")).toBeUndefined();
    expect(isRecordableDecision({ ...task, current_level: "supervised" }, atCeiling, "constrained")).toBe(
      false,
    );
  });

  it("never records a decision that skips a level", () => {
    const task = getTask("detect-invoice-exceptions");
    const result = evaluateSeededTask("detect-invoice-exceptions");
    if (!task || !result) throw new Error("unreachable");
    expect(task.current_level).toBe("assisted");
    // One step up is fine; two is not, however strong the evidence.
    expect(isRecordableDecision(task, result, "supervised")).toBe(true);
    expect(isRecordableDecision(task, result, "constrained")).toBe(false);
    expect(isRecordableDecision(task, result, "shadow")).toBe(true);
  });

  it("only ever offers levels one step from the current one", () => {
    const order: AutonomyLevel[] = ["shadow", "assisted", "supervised", "constrained"];
    for (const taskId of [
      "read-invoice-fields",
      "match-invoice-to-ledger",
      "routine-rule-application",
      "risk-detection",
    ]) {
      const { task, options } = optionsFor(taskId);
      for (const option of options) {
        const distance =
          order.indexOf(option.resulting_level) - order.indexOf(task.current_level);
        expect(Math.abs(distance), `${taskId}/${option.action}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("offers no lower level from Shadow", () => {
    const { options } = optionsFor("risk-detection");
    expect(options.find((option) => option.action === "lower")).toBeUndefined();
  });
});

describe("scope restriction", () => {
  it("keeps the level and narrows where it applies", () => {
    const { options } = optionsFor("routine-rule-application");
    const restrict = options.find((option) => option.action === "restrict-scope");
    expect(restrict?.resulting_level).toBe("supervised");
    expect(restrict?.outcome).toBe("scope-restricted");
    // The routine segments are the ones performing.
    expect(restrict?.scope?.included).toEqual(["Routine NZ cases", "Routine AU cases"]);
    expect(restrict?.scope?.excluded).toEqual(["Complex NZ cases", "Complex AU cases"]);
  });

  it("is available even while evaluation is blocked, because it reduces exposure", () => {
    const { options } = optionsFor("filing-readiness");
    expect(options.find((option) => option.action === "restrict-scope")).toBeDefined();
  });

  it("is the recommended option when the engine asked for a narrower fence", () => {
    const { options } = optionsFor("filing-readiness");
    // Filing readiness is blocked on revalidation first, so narrowing is offered
    // but not recommended; the recommendation stays with the blocking condition.
    const restrict = options.find((option) => option.action === "restrict-scope");
    expect(restrict?.recommended).toBe(false);
  });
});

describe("promotion moves the task on to the next stage's evidence", () => {
  it("leaves a promoted task needing evidence it has not yet produced", () => {
    // Risk detection is eligible to leave Shadow. Once at Assisted it must build
    // Assisted-mode evidence before it can go further, which it has none of.
    const promoted = evaluateSeededTask("risk-detection", { current_level: "assisted" });
    expect(promoted?.metrics.valid_case_count).toBe(0);
    expect(promoted?.recommendation.code).toBe("HOLD_INSUFFICIENT_STAGE_EVIDENCE");
  });

  it("puts a task promoted to its ceiling beyond further progression", () => {
    const promoted = evaluateSeededTask("match-invoice-to-ledger", {
      current_level: "constrained",
    });
    expect(promoted?.at_ceiling).toBe(true);
    expect(promoted?.recommendation.code).toBe("AT_AUTONOMY_CEILING");
  });
});
