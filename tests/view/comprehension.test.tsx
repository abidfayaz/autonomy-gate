import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import AutonomyDecisionPage from "@/app/tasks/[taskId]/decision/page";
import TaskScorecardPage from "@/app/tasks/[taskId]/page";
import { renderWithProviders } from "../helpers/renderPage";

/**
 * The six questions from the comprehension checkpoint, asserted against the real
 * screens.
 *
 * Three of them failed when this was walked by hand. These tests exist so the
 * answers cannot quietly disappear again: each one checks that the screen states
 * something, not merely that it is styled a particular way.
 */

const STATES: Array<[string, string]> = [
  ["match-invoice-to-ledger", "promotion-eligible"],
  ["routine-rule-application", "held on an unmet criterion"],
  ["draft-tax-position", "paused"],
];

async function scorecard(taskId: string) {
  return renderWithProviders(await TaskScorecardPage({ params: Promise.resolve({ taskId }) }));
}

async function decision(taskId: string) {
  return renderWithProviders(
    await AutonomyDecisionPage({ params: Promise.resolve({ taskId }) }),
  );
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});

describe("Q1 - what autonomy level is this task currently at", () => {
  it.each(STATES)("%s (%s) names the level", async (taskId) => {
    const { container } = await scorecard(taskId);
    expect(screen.getByText("Current autonomy")).toBeInTheDocument();
    expect(container.textContent).toMatch(/L[1-4]/);
  });
});

describe("Q2 - why is it at that level", () => {
  it.each(STATES)("%s (%s) says how the level was reached", async (taskId) => {
    const { container } = await scorecard(taskId);
    expect(screen.getByText("How this level was reached")).toBeInTheDocument();
    const text = container.textContent ?? "";
    // Either a recorded approval, or an explicit statement that there is none.
    expect(text).toMatch(/Approved on \d{4}-\d{2}-\d{2} by \w+|Starting level\./);
  });

  it("names the decision that established the level, not merely the latest one", async () => {
    // The latest decision here is a revalidation that confirmed L3 without
    // changing it. Rendering that as "approved L3 to L3" would say nothing.
    const { container } = await scorecard("routine-rule-application");
    const text = container.textContent ?? "";
    expect(text).toContain("Approved on 2026-05-18 by Maya");
    expect(text).toContain("moving from L2 · Assisted to L3 · Supervised");
    expect(text).toContain("Confirmed again on 2026-07-24");
    expect(text).not.toContain("L3 · Supervised → L3 · Supervised");
  });

  it("says plainly when a task has never been promoted", async () => {
    const { container } = await scorecard("match-invoice-to-ledger");
    expect(container.textContent).toContain("Starting level.");
  });

  it("gives the same answer on the decision screen", async () => {
    const { container } = await decision("routine-rule-application");
    const text = container.textContent ?? "";
    expect(text).toContain("Approved on 2026-05-18 by Maya");
    expect(text).toContain("moving from L2 · Assisted to L3 · Supervised");
  });
});

describe("Q3 - what is preventing it from progressing", () => {
  it("names the failing criterion in words, not only in colour", async () => {
    const { container } = await decision("routine-rule-application");
    const basis = screen.getByText("Decision basis").closest("section") as HTMLElement;
    const text = basis.textContent ?? "";

    // The one failure has to be legible in plain text.
    expect(text).toContain("Confident-but-wrong rate");
    expect(text).toContain("0.88% vs ≤ 0.25% · Not met");
    expect(text).toContain("342 vs ≥ 300 · Pass");
    expect(container.textContent).not.toBeNull();
  });

  it("marks exactly one criterion as not met on the held task", async () => {
    await decision("routine-rule-application");
    const basis = screen.getByText("Decision basis").closest("section") as HTMLElement;
    const notMet = (basis.textContent ?? "").match(/· Not met/g) ?? [];
    expect(notMet).toHaveLength(1);
  });

  it("explains the block itself when evaluation is paused", async () => {
    const { container } = await decision("draft-tax-position");
    expect(screen.getByText("Promotion is not available")).toBeInTheDocument();
    expect(container.textContent).toContain("evaluator on v2.3");
    expect(container.textContent).toContain("Not assessed while evaluation is blocked.");
  });

  it("says nothing is in the way when the task is eligible", async () => {
    const { container } = await scorecard("match-invoice-to-ledger");
    expect(container.textContent).toContain(
      "Every criterion for the next autonomy level has been met.",
    );
  });
});

describe("Q4 - what is the system recommending", () => {
  it.each(STATES)("%s (%s) states the recommendation and its source", async (taskId) => {
    const { container } = await scorecard(taskId);
    expect(screen.getByText("Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Source: active policy")).toBeInTheDocument();
    expect((container.textContent ?? "").length).toBeGreaterThan(0);
  });
});

describe("Q5 - what can the human reviewer actually decide", () => {
  it.each(STATES)("%s (%s) offers labelled options with one recommended", async (taskId) => {
    await decision(taskId);
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Recommended")).toHaveLength(1);
  });

  it("does not blame missing evidence when the block is a version mismatch", async () => {
    const { container } = await decision("draft-tax-position");
    const text = container.textContent ?? "";
    expect(text).toContain("until the condition blocking evaluation is resolved");
    expect(text).not.toContain("Continue at the current level while more evidence is collected");
  });

  it("separates excluded scope from the agent's other tasks", async () => {
    await decision("routine-rule-application");
    const scope = screen.getByText("Decision scope").closest("section") as HTMLElement;
    expect(within(scope).getByText("Excluded from this scope")).toBeInTheDocument();
    expect(
      within(scope).getByText("Other tasks of this agent, unaffected"),
    ).toBeInTheDocument();
  });
});

describe("Q6 - what happens if the recommendation is overridden", () => {
  it("states the consequence without requiring an option to be selected first", async () => {
    // Describing what the reviewer must do is not an answer to what happens, and
    // a consequence you can only discover by clicking is not readable.
    const { container } = await decision("routine-rule-application");
    const text = container.textContent ?? "";
    expect(text).toContain("both are kept");
    expect(text).toContain("stays visible in the audit history");
    expect(text).toContain("takes effect immediately");
  });

  it("marks which options depart from the recommendation", async () => {
    await decision("routine-rule-application");
    expect(screen.getAllByText("Differs from recommendation").length).toBeGreaterThan(0);
  });

  it("says why an override cannot rescue a blocked promotion", async () => {
    const { container } = await decision("draft-tax-position");
    expect(container.textContent).toContain(
      "cannot approve a promotion on evidence the evaluation has already found untrustworthy",
    );
  });
});

describe("no architecture terminology was used to fix comprehension", () => {
  it.each(STATES)("%s (%s) stays in governance language", async (taskId) => {
    const scorecardView = await scorecard(taskId);
    const scorecardText = (scorecardView.container.textContent ?? "").toLowerCase();
    scorecardView.unmount();

    const decisionView = await decision(taskId);
    const decisionText = (decisionView.container.textContent ?? "").toLowerCase();

    for (const term of ["engine", "deterministic", "reason code", "evaluator logic", "api"]) {
      expect(scorecardText, `${taskId} scorecard: ${term}`).not.toContain(term);
      expect(decisionText, `${taskId} decision: ${term}`).not.toContain(term);
    }
  });
});
