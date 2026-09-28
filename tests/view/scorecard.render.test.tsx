import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TaskScorecardPage from "@/app/tasks/[taskId]/page";
import { tasks } from "@/lib/data/seed";
import { DENIED_TERMS } from "@/lib/domain/vocabulary";
import { renderWithProviders } from "../helpers/renderPage";

async function renderScorecard(taskId: string) {
  const ui = await TaskScorecardPage({ params: Promise.resolve({ taskId }) });
  return renderWithProviders(ui);
}

describe("scorecard structure", () => {
  it("presents the PRD's sections in order", async () => {
    const { container } = await renderScorecard("routine-rule-application");
    const headings = [...container.querySelectorAll("h1, h2")].map(
      (node) => node.textContent ?? "",
    );
    expect(headings).toEqual([
      "Routine rule application",
      "Eligibility checks",
      "Autonomy criteria",
      "Performance by scope",
      "Review classification",
      "Current configuration",
    ]);
  });

  it("puts eligibility before criteria, because the order carries the logic", async () => {
    const { container } = await renderScorecard("routine-rule-application");
    const text = container.textContent ?? "";
    expect(text.indexOf("Eligibility checks")).toBeLessThan(text.indexOf("Autonomy criteria"));
  });

  it("shows current autonomy alongside the recommendation", async () => {
    await renderScorecard("routine-rule-application");
    expect(screen.getByText("Current autonomy")).toBeInTheDocument();
    expect(screen.getByText("Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Remain Supervised")).toBeInTheDocument();
  });

  it("uses the agreed provenance labels rather than architecture terms", async () => {
    await renderScorecard("routine-rule-application");
    expect(screen.getByText("Source: active policy")).toBeInTheDocument();
    // "Standard summary" without the live layer, "Plain-language summary" with
    // it. Neither names a provider.
    expect(screen.getByText("Standard summary")).toBeInTheDocument();
  });

  it("links on to the decision screen and offers no export", async () => {
    const { container } = await renderScorecard("routine-rule-application");
    const link = screen.getByRole("link", { name: /Review autonomy decision/ });
    expect(link).toHaveAttribute("href", "/tasks/routine-rule-application/decision");
    expect(container.textContent).not.toMatch(/Export scorecard/i);
  });
});

describe("criteria table", () => {
  it("renders the stage criteria with one failure", async () => {
    const { container } = await renderScorecard("routine-rule-application");
    const table = container.querySelector("table");
    expect(table).toBeDefined();
    const text = table?.textContent ?? "";

    expect(text).toContain("Minimum Supervised-mode cases");
    expect(text).toContain("Sampled post-execution error rate");
    expect(text).toContain("Boundary violations");
    expect(text).toContain("Missed critical exceptions");
    expect(text).toContain("0.88%");
    expect(text).toContain("≤ 0.25%");
    expect(text).toContain("Needs improvement");
  });

  it("puts accuracy and override rate under Additional metrics", async () => {
    const { container } = await renderScorecard("routine-rule-application");
    const table = container.querySelector("table");
    expect(table?.textContent).not.toContain("Human override rate");

    const additional = screen.getByText("Additional metrics").closest("div");
    expect(within(additional as HTMLElement).getByText("Accuracy")).toBeInTheDocument();
    expect(within(additional as HTMLElement).getByText("Human override rate")).toBeInTheDocument();
    expect(
      screen.getByText(/not criteria for this stage, so they do not gate promotion/i),
    ).toBeInTheDocument();
  });

  it("replaces the criteria table with an explanation when eligibility fails", async () => {
    const { container } = await renderScorecard("draft-tax-position");
    const criteria = screen
      .getByRole("heading", { name: "Autonomy criteria" })
      .closest("section") as HTMLElement;

    expect(within(criteria).getByText("Not assessed")).toBeInTheDocument();
    expect(within(criteria).getByText("Autonomy criteria were not assessed")).toBeInTheDocument();
    expect(criteria.querySelector("table")).toBeNull();
    // Nothing anywhere reads like a normal promotion assessment.
    expect(container.textContent).not.toContain("Needs improvement");
  });

  it("withholds promotional scope verdicts while evaluation is blocked", async () => {
    await renderScorecard("draft-tax-position");
    const scope = screen
      .getByRole("heading", { name: "Performance by scope" })
      .closest("section") as HTMLElement;
    const text = scope.textContent ?? "";
    expect(text).not.toContain("Eligible for promotion");
    expect(within(scope).getAllByText("Not assessed").length).toBe(4);
    // The performance figures themselves still stand.
    expect(text).toContain("95.0%");
  });

  it("keeps an unsafe segment visible even while evaluation is blocked", async () => {
    await renderScorecard("filing-readiness");
    const scope = screen
      .getByRole("heading", { name: "Performance by scope" })
      .closest("section") as HTMLElement;
    // A confirmed critical error is a safety fact, not a promotion judgement.
    expect(within(scope).getByText("Restrict scope")).toBeInTheDocument();
  });
});

describe("blocked and paused states", () => {
  it("shows the paused task's version mismatch in the configuration panel", async () => {
    await renderScorecard("draft-tax-position");
    expect(screen.getByText("Version mismatch")).toBeInTheDocument();
    expect(screen.getByText("v2.3")).toBeInTheDocument();
    expect(screen.getAllByText("v2.4").length).toBeGreaterThan(0);
  });

  it("shows the conditional sandbox check only on the changed configuration", async () => {
    const sandbox = await renderScorecard("filing-readiness");
    expect(
      within(sandbox.container).getByText("Sandbox revalidation completed"),
    ).toBeInTheDocument();
    sandbox.unmount();

    const normal = await renderScorecard("routine-rule-application");
    expect(normal.container.textContent).not.toContain("Sandbox revalidation completed");
  });

  it("states there is nothing left to assess at the ceiling", async () => {
    await renderScorecard("read-invoice-fields");
    expect(screen.getByText("No progression to assess")).toBeInTheDocument();
    expect(screen.getByText("No further level available")).toBeInTheDocument();
  });
});

describe("vocabulary across every scorecard", () => {
  it.each(tasks.map((task) => task.task_id))("%s uses no forbidden term", async (taskId) => {
    const { container } = await renderScorecard(taskId);
    const text = (container.textContent ?? "").toLowerCase();
    const found = DENIED_TERMS.filter((term) => text.includes(term.toLowerCase()));
    expect(found, `forbidden terms on ${taskId}: ${found.join(", ")}`).toEqual([]);
  });

  it("renders every scorecard without a missing value", async () => {
    for (const task of tasks) {
      const { container, unmount } = await renderScorecard(task.task_id);
      const text = container.textContent ?? "";
      expect(text, task.task_id).not.toMatch(/undefined|NaN|\[object Object\]/);
      unmount();
    }
  });

  it("states that the data is synthetic", async () => {
    const { container } = await renderScorecard("routine-rule-application");
    expect(container.textContent).toMatch(/Synthetic prototype data/i);
  });
});
