import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import AutonomyDecisionPage from "@/app/tasks/[taskId]/decision/page";
import TaskScorecardPage from "@/app/tasks/[taskId]/page";
import { DENIED_TERMS } from "@/lib/domain/vocabulary";
import { loadDemoState } from "@/lib/state/demoState";
import { renderWithProviders } from "../helpers/renderPage";

async function renderDecision(taskId: string) {
  const ui = await AutonomyDecisionPage({ params: Promise.resolve({ taskId }) });
  return renderWithProviders(ui);
}

async function renderScorecard(taskId: string) {
  const ui = await TaskScorecardPage({ params: Promise.resolve({ taskId }) });
  return renderWithProviders(ui);
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});

describe("decision screen", () => {
  it("shows the level, the recommendation and the target side by side", async () => {
    await renderDecision("routine-rule-application");
    expect(await screen.findByText("Current autonomy")).toBeInTheDocument();
    expect(screen.getByText("System recommendation")).toBeInTheDocument();
    expect(screen.getByText("Target considered")).toBeInTheDocument();
    expect(screen.getByText("L4 · Constrained")).toBeInTheDocument();
  });

  it("states what the decision does not cover", async () => {
    await renderDecision("routine-rule-application");
    const scope = (await screen.findByText("Decision scope")).closest("section") as HTMLElement;
    expect(
      within(scope).getByText(/does not change autonomy for the whole agent/i),
    ).toBeInTheDocument();
    // The agent's other tasks are named, so the boundary is visible.
    expect(within(scope).getByText("Draft tax position")).toBeInTheDocument();
    expect(within(scope).getByText("Filing readiness")).toBeInTheDocument();
  });

  it("marks the recommended option and flags the ones that differ", async () => {
    await renderDecision("routine-rule-application");
    expect(await screen.findByText("Recommended")).toBeInTheDocument();
    expect(screen.getAllByText("Differs from recommendation").length).toBeGreaterThan(0);
  });

  it("offers no promotion while evaluation is blocked, and says why", async () => {
    const { container } = await renderDecision("draft-tax-position");
    expect(await screen.findByText("Promotion is not available")).toBeInTheDocument();
    expect(
      screen.getByText(/cannot approve a promotion on evidence the evaluation has already found/i),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Approve L3 · Supervised/);
  });
});

describe("recording a decision", () => {
  it("requires a choice, a reason, and an acknowledgement when overriding", async () => {
    const user = userEvent.setup();
    await renderDecision("routine-rule-application");

    const submit = await screen.findByRole("button", { name: /Confirm decision/ });
    expect(submit).toBeDisabled();

    // Choosing an option is not enough on its own.
    await user.click(screen.getByRole("radio", { name: /Keep L3 · Supervised/ }));
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Decision reason"), "Collecting more evidence first.");
    expect(submit).toBeEnabled();
  });

  it("blocks an override until it is acknowledged", async () => {
    const user = userEvent.setup();
    await renderDecision("routine-rule-application");

    const submit = await screen.findByRole("button", { name: /Confirm decision/ });
    await user.click(screen.getByRole("radio", { name: /Approve L4 · Constrained/ }));
    await user.type(
      screen.getByLabelText("Decision reason"),
      "Accepting the residual risk for this quarter.",
    );
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
  });

  it("persists the decision with its frozen evidence", async () => {
    const user = userEvent.setup();
    await renderDecision("routine-rule-application");

    await user.click(await screen.findByRole("radio", { name: /Keep L3 · Supervised/ }));
    await user.type(screen.getByLabelText("Decision reason"), "Collecting more evidence first.");
    await user.click(screen.getByRole("button", { name: /Confirm decision/ }));

    expect(await screen.findByText("Decision recorded")).toBeInTheDocument();

    const stored = loadDemoState();
    expect(stored.decisions).toHaveLength(1);
    const recorded = stored.decisions[0];
    expect(recorded?.task_id).toBe("routine-rule-application");
    expect(recorded?.final_level).toBe("supervised");
    expect(recorded?.decided_by).toBe("Maya");
    expect(recorded?.recommendation_code).toBe("HOLD_CONFIDENT_WRONG_RATE");
    expect(recorded?.policy_version).toBe("1.3");
    // The evidence is kept as it stood, not as a pointer to today's numbers.
    expect(recorded?.snapshot.valid_case_count).toBe(342);
    expect(recorded?.snapshot.confident_wrong_rate).toBeCloseTo(0.0088, 4);
  });

  it("records an override as an override", async () => {
    const user = userEvent.setup();
    await renderDecision("routine-rule-application");

    await user.click(await screen.findByRole("radio", { name: /Approve L4 · Constrained/ }));
    await user.type(screen.getByLabelText("Decision reason"), "Accepting the residual risk.");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Confirm decision/ }));

    const recorded = loadDemoState().decisions[0];
    expect(recorded?.was_override).toBe(true);
    expect(recorded?.final_level).toBe("constrained");
    expect(recorded?.outcome).toBe("approved");
  });
});

describe("a recorded decision reaches the other screens", () => {
  it("moves the scorecard to the level the decision left the task at", async () => {
    const user = userEvent.setup();
    const decisionView = await renderDecision("match-invoice-to-ledger");

    await user.click(await screen.findByRole("radio", { name: /Approve L4 · Constrained/ }));
    await user.type(screen.getByLabelText("Decision reason"), "Every criterion has been met.");
    await user.click(screen.getByRole("button", { name: /Confirm decision/ }));
    expect(await screen.findByText("Decision recorded")).toBeInTheDocument();
    decisionView.unmount();

    const scorecard = await renderScorecard("match-invoice-to-ledger");
    // The scorecard now reflects the promotion, and says so.
    expect(await screen.findByText(/You recorded a decision for this task/)).toBeInTheDocument();
    expect(within(scorecard.container).getByText("Constrained")).toBeInTheDocument();
    expect(screen.getByText("No progression to assess")).toBeInTheDocument();
  });

  it("returns to the seeded state once the demo is reset", async () => {
    const user = userEvent.setup();
    const decisionView = await renderDecision("match-invoice-to-ledger");
    await user.click(await screen.findByRole("radio", { name: /Approve L4 · Constrained/ }));
    await user.type(screen.getByLabelText("Decision reason"), "Every criterion has been met.");
    await user.click(screen.getByRole("button", { name: /Confirm decision/ }));
    decisionView.unmount();

    globalThis.localStorage.clear();

    const scorecard = await renderScorecard("match-invoice-to-ledger");
    expect(scorecard.container.textContent).not.toMatch(/You recorded a decision/);
    expect(await screen.findByText("Supervised")).toBeInTheDocument();
  });
});

describe("vocabulary", () => {
  it.each(["routine-rule-application", "draft-tax-position", "risk-detection"])(
    "%s uses no forbidden term",
    async (taskId) => {
      const { container } = await renderDecision(taskId);
      await screen.findByText("Current autonomy");
      const text = (container.textContent ?? "").toLowerCase();
      const found = DENIED_TERMS.filter((term) => text.includes(term.toLowerCase()));
      expect(found, `forbidden terms on ${taskId}: ${found.join(", ")}`).toEqual([]);
    },
  );
});
