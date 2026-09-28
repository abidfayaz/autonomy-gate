import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuditLogPage from "@/app/audit/page";
import AutonomyDecisionPage from "@/app/tasks/[taskId]/decision/page";
import TaskScorecardPage from "@/app/tasks/[taskId]/page";
import { DENIED_TERMS } from "@/lib/domain/vocabulary";
import { loadDemoState } from "@/lib/state/demoState";
import { renderWithProviders } from "../helpers/renderPage";

const TASK = "routine-rule-application";

async function renderScorecard(taskId = TASK) {
  return renderWithProviders(await TaskScorecardPage({ params: Promise.resolve({ taskId }) }));
}

async function renderDecision(taskId = TASK) {
  return renderWithProviders(
    await AutonomyDecisionPage({ params: Promise.resolve({ taskId }) }),
  );
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("an unsettled classification is not evidence", () => {
  it("shows the outstanding classification and what it is waiting for", async () => {
    await renderScorecard();
    expect(screen.getByText("Awaiting confirmation")).toBeInTheDocument();
    expect(
      screen.getByText(/counts as evidence only once a person settles it/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Material error")).toBeInTheDocument();
  });

  it("offers the three ways to resolve it", async () => {
    await renderScorecard();
    expect(screen.getByRole("button", { name: /Confirm as Material error/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change classification" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Needs further review" })).toBeInTheDocument();
  });

  it("leaves the recommendation alone while it is outstanding", async () => {
    const { container } = await renderScorecard();
    expect(container.textContent).toContain("Remain Supervised");
  });
});

describe("bounded judgment, human confirmation, deterministic consequence", () => {
  it("changes nothing when the classification is confirmed as it stands", async () => {
    const user = userEvent.setup();
    const { container } = await renderScorecard();
    await user.click(screen.getByRole("button", { name: /Confirm as Material error/ }));

    expect(await screen.findByText(/You settled this as Material error/)).toBeInTheDocument();
    // A material error is not a critical one, so the gate reaches the same place.
    expect(container.textContent).toContain("Remain Supervised");
    expect(container.textContent).toContain("Confident-but-wrong rate");
  });

  it("blocks the assessment when the same note is settled as critical", async () => {
    const user = userEvent.setup();
    const { container } = await renderScorecard();
    await user.click(screen.getByRole("button", { name: "Change classification" }));
    await user.click(screen.getByRole("button", { name: /Critical error/ }));

    const eligibility = screen
      .getByRole("heading", { name: "Eligibility checks" })
      .closest("section") as HTMLElement;

    // Eligibility fails, and the criteria are no longer assessed at all.
    expect(within(eligibility).getByText("Blocked")).toBeInTheDocument();
    expect(container.textContent).toContain("1 confirmed critical error");
    expect(container.textContent).toContain("Autonomy criteria were not assessed");
  });

  it("argues for a narrower fence, because the error sits outside the routine scope", async () => {
    const user = userEvent.setup();
    const { container } = await renderScorecard();
    await user.click(screen.getByRole("button", { name: "Change classification" }));
    await user.click(screen.getByRole("button", { name: /Critical error/ }));

    // The critical error is in Complex AU while the routine segments stay clean,
    // so the engine narrows the scope rather than stopping the task outright.
    expect(container.textContent).toContain("Restrict scope");
    expect(container.textContent).toContain("Complex AU");
  });

  it("returns to the original outcome when the confirmation is withdrawn", async () => {
    const user = userEvent.setup();
    const first = await renderScorecard();
    await user.click(screen.getByRole("button", { name: "Change classification" }));
    await user.click(screen.getByRole("button", { name: /Critical error/ }));
    expect(first.container.textContent).toContain("Restrict scope");
    first.unmount();

    globalThis.localStorage.clear();

    const again = await renderScorecard();
    expect(again.container.textContent).toContain("Remain Supervised");
    expect(again.container.textContent).not.toContain("1 confirmed critical error");
  });
});

describe("routing for further review is not a classification", () => {
  it("records it as unresolved and says it is not evidence", async () => {
    const user = userEvent.setup();
    await renderScorecard();
    await user.click(screen.getByRole("button", { name: "Needs further review" }));

    const stored = loadDemoState().classifications[0];
    expect(stored?.resolved).toBe(false);
    expect(stored?.result).toBe("uncertain");
    expect(
      await screen.findByText(/Until it is settled it is not evidence/),
    ).toBeInTheDocument();
  });

  it("leaves the recommendation where it was", async () => {
    const user = userEvent.setup();
    const { container } = await renderScorecard();
    await user.click(screen.getByRole("button", { name: "Needs further review" }));
    expect(container.textContent).toContain("Remain Supervised");
  });
});

describe("classifying the note again", () => {
  it("offers a suggestion, and says a suggestion is not evidence", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ result: "material_error", confidence: 0.88, live: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await renderScorecard();
    await user.click(screen.getByRole("button", { name: "Classify the note again" }));

    expect(await screen.findByText(/Suggested classification: Material error/)).toBeInTheDocument();
    expect(screen.getByText(/not evidence until you settle it/)).toBeInTheDocument();
    // Nothing was recorded by asking.
    expect(loadDemoState().classifications).toHaveLength(0);
  });

  it("routes to a person when the layer is unavailable, rather than defaulting", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );

    await renderScorecard();
    await user.click(screen.getByRole("button", { name: "Classify the note again" }));

    expect(
      await screen.findByText(/Classification is unavailable. This case needs human review./),
    ).toBeInTheDocument();
    expect(loadDemoState().classifications).toHaveLength(0);
  });

  it("routes to a person when the answer is uncertain", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ result: "uncertain", confidence: 0.4, live: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await renderScorecard();
    await user.click(screen.getByRole("button", { name: "Classify the note again" }));

    expect(
      await screen.findByText(/could not be classified confidently/),
    ).toBeInTheDocument();
  });

  it("routes to a person when the request itself fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await renderScorecard();
    await user.click(screen.getByRole("button", { name: "Classify the note again" }));
    expect(await screen.findByText(/needs human review/)).toBeInTheDocument();
  });
});

describe("a settled classification travels with the decision", () => {
  it("is kept inside the decision record, not logged separately", async () => {
    const user = userEvent.setup();
    const scorecard = await renderScorecard();
    await user.click(screen.getByRole("button", { name: /Confirm as Material error/ }));
    scorecard.unmount();

    const decision = await renderDecision();
    await user.click(await screen.findByRole("radio", { name: /Keep L3 · Supervised/ }));
    await user.type(screen.getByLabelText("Decision reason"), "Collecting more evidence first.");
    await user.click(screen.getByRole("button", { name: /Confirm decision/ }));
    decision.unmount();

    const recorded = loadDemoState().decisions[0];
    expect(recorded?.confirmed_classifications).toContain(
      "Reviewer note classified as material error, confirmed by Maya",
    );
  });

  it("adds no audit category of its own", async () => {
    const user = userEvent.setup();
    const scorecard = await renderScorecard();
    await user.click(screen.getByRole("button", { name: /Confirm as Material error/ }));
    scorecard.unmount();

    // Settling a classification is evidence state, not an event in the record.
    const { container } = renderWithProviders(AuditLogPage());
    expect(container.querySelectorAll("tbody tr")).toHaveLength(8);
    expect(container.textContent).not.toContain("Classification");
  });
});

describe("vocabulary", () => {
  it("names no provider or architecture term on the panel", async () => {
    const { container } = await renderScorecard();
    const text = (container.textContent ?? "").toLowerCase();
    const found = DENIED_TERMS.filter((term) => text.includes(term.toLowerCase()));
    expect(found, `forbidden terms: ${found.join(", ")}`).toEqual([]);
  });
});
