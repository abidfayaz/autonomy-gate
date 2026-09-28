import { describe, expect, it } from "vitest";
import { evaluateAllSeededTasks } from "@/lib/data/evaluation";
import { REASON_CODES, type ReasonCode } from "@/lib/engine";
import { EXPLAINED_CODES, standardSummary } from "@/lib/explain/templates";
import { buildScorecardView } from "@/lib/view/taskScorecard";

/**
 * The explanation layer.
 *
 * Its defining property is negative: removing it entirely must change nothing
 * about any autonomy outcome.
 */

describe("the layer cannot change an outcome", () => {
  it("produces the same recommendation for every task whether or not wording exists", () => {
    // The engine is called without any explanation involved, and its result is
    // compared with what the screen shows. If the wording could influence the
    // outcome, these would diverge.
    const engineOutcomes = evaluateAllSeededTasks().map((result) => ({
      task: result.task_id,
      code: result.recommendation.code,
      level: result.recommendation.recommended_level,
      eligible: result.eligibility.eligible,
    }));

    const screenOutcomes = engineOutcomes.map((outcome) => {
      const view = buildScorecardView(outcome.task);
      return {
        task: outcome.task,
        code: view?.recommendation.code,
        level: outcome.level,
        eligible: view?.eligibility.eligible,
      };
    });

    expect(screenOutcomes).toEqual(engineOutcomes);
  });

  it("sends the finished decision and never the evidence", () => {
    // The request carries a reason code, the level under review, and only the
    // figures the wording quotes. There is nothing here to judge from.
    for (const result of evaluateAllSeededTasks()) {
      // Quoted figures like `minimum_cases` are fine: they appear in the
      // wording. What must never be here is the evidence itself.
      const values = Object.values(result.recommendation.detail);
      for (const value of values) {
        expect(Array.isArray(value), result.task_id).toBe(false);
        if (typeof value === "string") {
          expect(value, result.task_id).not.toMatch(/RUN-|CASE-|REV-/);
        }
      }
      const value = JSON.stringify(result.recommendation.detail);
      expect(value.length, result.task_id).toBeLessThan(400);
    }
  });

  it("keeps working when the layer produces nothing at all", () => {
    for (const result of evaluateAllSeededTasks()) {
      const view = buildScorecardView(result.task_id);
      // The deterministic wording is always present, with no live layer involved.
      expect(view?.recommendation.summary.length, result.task_id).toBeGreaterThan(20);
    }
  });
});

describe("a template for every outcome", () => {
  it.each(EXPLAINED_CODES)("%s has wording", (code) => {
    const summary = standardSummary({
      code,
      target_level_label: "L4 · Constrained",
      detail: {
        actual: 0.0088,
        required_max: 0.0025,
        unmet_criteria: 2,
        valid_case_count: 78,
        minimum_cases: 300,
        critical_errors: 1,
        unsafe_segments: "Complex AU",
        retained_segments: "Routine NZ, Routine AU",
      },
    });
    expect(summary.length, code).toBeGreaterThan(20);
    expect(summary, code).toMatch(/\.$/);
  });

  it("covers every code the engine can produce", () => {
    const produced = new Set<ReasonCode>(Object.values(REASON_CODES));
    for (const code of produced) {
      expect(EXPLAINED_CODES, code).toContain(code);
    }
  });

  it("quotes small rates to two decimals, so a limit is never rounded away", () => {
    const summary = standardSummary({
      code: REASON_CODES.HOLD_CONFIDENT_WRONG_RATE,
      target_level_label: "L4 · Constrained",
      detail: { actual: 0.0088, required_max: 0.0025 },
    });
    expect(summary).toContain("0.88%");
    expect(summary).toContain("0.25%");
  });

  it("names no provider or implementation detail in any template", () => {
    for (const code of EXPLAINED_CODES) {
      const summary = standardSummary({
        code,
        target_level_label: "L4 · Constrained",
        detail: { actual: 0.01, required_max: 0.002, unmet_criteria: 1, critical_errors: 1 },
      }).toLowerCase();
      for (const term of ["model", "provider", "groq", "llm", "prompt", "inference", "api"]) {
        expect(summary, `${code}: ${term}`).not.toContain(term);
      }
    }
  });

  it("matches the wording the scorecard shows", () => {
    const view = buildScorecardView("routine-rule-application");
    const engine = evaluateAllSeededTasks().find(
      (result) => result.task_id === "routine-rule-application",
    );
    expect(view?.recommendation.summary).toBe(
      standardSummary({
        code: engine?.recommendation.code as ReasonCode,
        target_level_label: "L4 · Constrained",
        detail: engine?.recommendation.detail ?? {},
      }),
    );
  });
});

describe("the credential never leaves the server", () => {
  it("keeps the client from reaching the provider directly", async () => {
    // The module is server-only; importing it from a client bundle fails the
    // build rather than shipping a credential.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("lib/explain/groq.ts", "utf8"),
    );
    expect(source).toContain('import "server-only"');
    expect(source).toContain("process.env.GROQ_API_KEY");

    const block = await import("node:fs").then((fs) =>
      fs.readFileSync("components/screen2/ExplanationBlock.tsx", "utf8"),
    );
    expect(block).not.toContain("GROQ");
    expect(block).not.toContain("api.groq.com");
  });

  it("never reports a provider problem to the reader", async () => {
    const block = await import("node:fs").then((fs) =>
      fs.readFileSync("components/screen2/ExplanationBlock.tsx", "utf8"),
    );
    for (const phrase of ["unavailable", "failed", "error", "outage", "retry"]) {
      expect(block.toLowerCase().split("//").join(""), phrase).not.toMatch(
        new RegExp(`setsummary\\([^)]*${phrase}`, "i"),
      );
    }
  });
});
