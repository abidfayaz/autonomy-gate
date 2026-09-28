import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import AuditLogPage from "@/app/audit/page";
import SandboxRevalidationPage from "@/app/sandbox/page";
import TaskScorecardPage from "@/app/tasks/[taskId]/page";
import { DENIED_TERMS } from "@/lib/domain/vocabulary";
import { loadDemoState } from "@/lib/state/demoState";
import { buildSandboxView } from "@/lib/view/sandbox";
import { renderWithProviders } from "../helpers/renderPage";

const renderSandbox = () => renderWithProviders(SandboxRevalidationPage());
const renderAudit = () => renderWithProviders(AuditLogPage());

async function renderScorecard(taskId: string) {
  return renderWithProviders(await TaskScorecardPage({ params: Promise.resolve({ taskId }) }));
}

async function recordContinuity(optionName: RegExp, reason: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: optionName }));
  await user.type(screen.getByLabelText("Decision reason"), reason);
  await user.click(screen.getByRole("button", { name: /Record continuity decision/ }));
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});

describe("previous autonomy is history, not an entitlement", () => {
  it("shows the previously approved level beside the level the candidate restarts from", () => {
    const { container } = renderSandbox();
    expect(screen.getByText("Previous approved autonomy")).toBeInTheDocument();
    expect(screen.getByText("Candidate state")).toBeInTheDocument();
    const text = container.textContent ?? "";
    expect(text).toContain("Constrained");
    expect(text).toContain("Shadow");
    expect(text).toContain("Kept as a record, not as an entitlement");
  });

  it("states that previous autonomy does not transfer on its own", () => {
    const { container } = renderSandbox();
    expect(container.textContent).toContain(
      "it does not transfer to the changed configuration",
    );
  });

  it("never presents the candidate as holding the previous level", () => {
    const view = buildSandboxView();
    expect(view?.previous_level).toBe("constrained");
    expect(view?.candidate_level).toBe("shadow");
    expect(view?.candidate_level).not.toBe(view?.previous_level);
  });

  it("explains what changed and why it matters", () => {
    const { container } = renderSandbox();
    const text = container.textContent ?? "";
    expect(text).toContain("Material change");
    expect(text).toContain("v3.1 to v3.2");
    expect(text).toContain("Why it matters");
    expect(text).toContain("must be tested before previous autonomy can continue");
  });
});

describe("coverage", () => {
  it("reports progress against the planned suite", () => {
    renderSandbox();
    expect(screen.getByText("142 of 200 cases evaluated")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Validation progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "71");
  });

  it("labels the coverage groups as overlapping rather than as totals", () => {
    const { container } = renderSandbox();
    expect(container.textContent).toContain("Coverage groups overlap");
    expect(container.textContent).toContain("not separate totals");
    expect(screen.getByText("Previously successful cases")).toBeInTheDocument();
    expect(screen.getByText("Known past failures")).toBeInTheDocument();
  });

  it("carries groups that deliberately do not sum to the planned suite", () => {
    const view = buildSandboxView();
    const total = (view?.coverage_groups ?? []).reduce(
      (sum, group) => sum + group.case_count,
      0,
    );
    expect(view?.coverage_groups).toHaveLength(5);
    expect(total).not.toBe(view?.planned_case_count);
  });
});

describe("performance after the change", () => {
  it("shows the weak segment that argues for a narrower fence", () => {
    renderSandbox();
    const section = screen
      .getByRole("heading", { name: "Performance after the change" })
      .closest("section") as HTMLElement;
    const text = section.textContent ?? "";
    expect(text).toContain("Complex AU");
    expect(text).toContain("Restrict");
    expect(text).toContain("Routine NZ");
    expect(text).toContain("Stable");
  });

  it("derives the recommendation from the evidence, not from a stored label", () => {
    const view = buildSandboxView();
    expect(view?.recommendation).toBe("restrict-scope");
    expect(view?.recommendation_detail).toContain("Complex AU");
    expect(view?.recommendation_detail).toContain("confirmed critical error");
  });
});

describe("continuity options", () => {
  it("offers three distinct outcomes", () => {
    const view = buildSandboxView();
    expect(view?.options.map((option) => option.action)).toEqual([
      "continue-for-validated-scope",
      "keep-in-shadow",
      "lower-autonomy",
    ]);
    const levels = view?.options.map((option) => option.resulting_level) ?? [];
    expect(new Set(levels).size).toBe(3);
  });

  it("recommends exactly one, and names the fence it would apply", () => {
    const view = buildSandboxView();
    const recommended = view?.options.filter((option) => option.recommended) ?? [];
    expect(recommended).toHaveLength(1);
    expect(recommended[0]?.action).toBe("continue-for-validated-scope");
    expect(recommended[0]?.scope?.included).toEqual([
      "Routine NZ cases",
      "Routine AU cases",
      "Complex NZ cases",
    ]);
    expect(recommended[0]?.scope?.excluded).toEqual(["Complex AU cases"]);
  });

  it("distinguishes keeping the candidate in Shadow from lowering autonomy", () => {
    const view = buildSandboxView();
    const keep = view?.options.find((option) => option.action === "keep-in-shadow");
    const lower = view?.options.find((option) => option.action === "lower-autonomy");
    expect(keep?.resulting_level).toBe("shadow");
    expect(lower?.resulting_level).toBe("supervised");
    // Only one of them leaves the revalidation open.
    expect(keep?.resolves_revalidation).toBe(false);
    expect(lower?.resolves_revalidation).toBe(true);
  });

  it("restores a previously earned level directly, which a promotion never could", () => {
    // Continuity is not promotion: it can move Shadow to Constrained in one step
    // because the level was already earned, and is only being carried over.
    const view = buildSandboxView();
    const continueOption = view?.options.find(
      (option) => option.action === "continue-for-validated-scope",
    );
    expect(view?.candidate_level).toBe("shadow");
    expect(continueOption?.resulting_level).toBe("constrained");
  });

  it("marks the option that leaves the revalidation open", () => {
    renderSandbox();
    expect(screen.getByText("Revalidation stays open")).toBeInTheDocument();
  });
});

describe("recording a continuity decision", () => {
  it("requires a choice and a reason", async () => {
    const user = userEvent.setup();
    renderSandbox();
    const submit = screen.getByRole("button", { name: /Record continuity decision/ });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /Continue L4 · Constrained/ }));
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Decision reason"), "Validated for the routine scope.");
    expect(submit).toBeEnabled();
  });

  it("records the level, the fence and the resolution", async () => {
    renderSandbox();
    await recordContinuity(/Continue L4 · Constrained/, "Validated for the routine scope.");

    expect(await screen.findByText("Continuity decision recorded")).toBeInTheDocument();
    const recorded = loadDemoState().decisions[0];
    expect(recorded?.kind).toBe("continuity");
    expect(recorded?.final_level).toBe("constrained");
    expect(recorded?.resolves_revalidation).toBe(true);
    expect(recorded?.scope?.excluded).toEqual(["Complex AU cases"]);
    expect(recorded?.decided_by).toBe("Maya");
  });

  it("leaves the revalidation open when the candidate stays in Shadow", async () => {
    renderSandbox();
    await recordContinuity(/Keep the candidate at L1 · Shadow/, "More evidence needed first.");

    const recorded = loadDemoState().decisions[0];
    expect(recorded?.final_level).toBe("shadow");
    expect(recorded?.resolves_revalidation).toBe(false);
    expect(screen.getByText(/revalidation stays open/i)).toBeInTheDocument();
  });

  it("records lowering autonomy as its own outcome", async () => {
    renderSandbox();
    await recordContinuity(/Continue at L3 · Supervised/, "Continuing at a lower level.");

    const recorded = loadDemoState().decisions[0];
    expect(recorded?.final_level).toBe("supervised");
    expect(recorded?.outcome).toBe("autonomy-lowered");
    expect(recorded?.resolves_revalidation).toBe(true);
  });
});

describe("a continuity decision reaches the other screens", () => {
  it("appears in the audit log as a revalidation, not a promotion", async () => {
    const sandbox = renderSandbox();
    await recordContinuity(/Continue L4 · Constrained/, "Validated for the routine scope.");
    sandbox.unmount();

    const { container } = renderAudit();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(9);
    expect(screen.getByText("Recorded by you")).toBeInTheDocument();
    const rows = [...container.querySelectorAll("tbody tr")].map((row) => row.textContent ?? "");
    const own = rows.find((row) => row.includes("Recorded by you"));
    expect(own).toContain("Sandbox revalidation");
    expect(own).not.toContain("Autonomy decision");
  });

  it("clears the outstanding revalidation check on the scorecard", async () => {
    const before = await renderScorecard("filing-readiness");
    expect(
      within(before.container).getByText("Sandbox revalidation completed"),
    ).toBeInTheDocument();
    before.unmount();

    const sandbox = renderSandbox();
    await recordContinuity(/Continue L4 · Constrained/, "Validated for the routine scope.");
    sandbox.unmount();

    const after = await renderScorecard("filing-readiness");
    // The conditional check disappears once nothing is outstanding.
    expect(after.container.textContent).not.toContain("Sandbox revalidation completed");
  });

  it("leaves the check in place when the candidate stays in Shadow", async () => {
    const sandbox = renderSandbox();
    await recordContinuity(/Keep the candidate at L1 · Shadow/, "More evidence needed first.");
    sandbox.unmount();

    const after = await renderScorecard("filing-readiness");
    expect(
      within(after.container).getByText("Sandbox revalidation completed"),
    ).toBeInTheDocument();
  });

  it("restores the pending scenario when the demo is reset", async () => {
    const sandbox = renderSandbox();
    await recordContinuity(/Continue L4 · Constrained/, "Validated for the routine scope.");
    sandbox.unmount();

    globalThis.localStorage.clear();

    const again = renderSandbox();
    expect(again.container.textContent).not.toContain("Continuity decision recorded");
    expect(screen.getByText("Continuity recommendation")).toBeInTheDocument();
  });
});

describe("what this screen does not do", () => {
  it("never suggests splitting the task", () => {
    const { container } = renderSandbox();
    const text = (container.textContent ?? "").toLowerCase();
    for (const phrase of ["split", "separate task", "divide the task", "break the task"]) {
      expect(text, phrase).not.toContain(phrase);
    }
  });

  it("never restores autonomy without a decision", () => {
    const view = buildSandboxView();
    // Every option is something a person chooses; none is applied by default.
    for (const option of view?.options ?? []) {
      expect(typeof option.action).toBe("string");
    }
    const { container } = renderSandbox();
    expect(container.textContent).toContain("Previous autonomy does not return on its own");
  });

  it("uses no forbidden term", () => {
    const { container } = renderSandbox();
    const text = (container.textContent ?? "").toLowerCase();
    const found = DENIED_TERMS.filter((term) => text.includes(term.toLowerCase()));
    expect(found, `forbidden terms: ${found.join(", ")}`).toEqual([]);
  });
});
