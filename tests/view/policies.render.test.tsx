import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import AuditLogPage from "@/app/audit/page";
import PoliciesAndVersionsPage from "@/app/policies/page";
import TaskScorecardPage from "@/app/tasks/[taskId]/page";
import { DENIED_TERMS } from "@/lib/domain/vocabulary";
import { loadDemoState } from "@/lib/state/demoState";
import { renderWithProviders } from "../helpers/renderPage";

const renderPolicies = () => renderWithProviders(PoliciesAndVersionsPage());
const renderAudit = () => renderWithProviders(AuditLogPage());

async function renderScorecard(taskId: string) {
  return renderWithProviders(await TaskScorecardPage({ params: Promise.resolve({ taskId }) }));
}

/** Tightens the confident-but-wrong limit and publishes the new version. */
async function editConfidentWrong(value: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Edit policy/ }));
  const field = screen.getByLabelText("Confident-but-wrong limit for Constrained");
  await user.clear(field);
  await user.type(field, value);
  await user.click(screen.getByRole("button", { name: "Save as new version" }));
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});

describe("policy configuration, separate from performance", () => {
  it("lists a policy for every task", () => {
    const { container } = renderPolicies();
    const table = container.querySelector("table");
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(8);
    expect(screen.getByRole("heading", { name: "Policies by task" })).toBeInTheDocument();
  });

  it("counts policies and alignment from the data", () => {
    const { container } = renderPolicies();
    expect(container.textContent).toContain("Tasks with an evaluation policy");
    expect(container.textContent).toContain("One task has a version mismatch");
  });

  it("shows criteria for all three stages, not one blended set", () => {
    renderPolicies();
    expect(screen.getByText("Shadow to Assisted")).toBeInTheDocument();
    expect(screen.getByText("Assisted to Supervised")).toBeInTheDocument();
    expect(screen.getByText("Supervised to Constrained")).toBeInTheDocument();
  });

  it("keeps performance figures off this screen", () => {
    const { container } = renderPolicies();
    const text = container.textContent ?? "";
    // Thresholds belong here; how the task is actually doing belongs on the scorecard.
    expect(text).not.toContain("Performance by scope");
    expect(text).not.toContain("Additional metrics");
    expect(text).not.toContain("Needs improvement");
  });

  it("carries no checksum or hash line", () => {
    const { container } = renderPolicies();
    const text = (container.textContent ?? "").toLowerCase();
    expect(text).not.toContain("sha256");
    expect(text).not.toContain("checksum");
  });

  it("uses no forbidden term", () => {
    const { container } = renderPolicies();
    const text = (container.textContent ?? "").toLowerCase();
    const found = DENIED_TERMS.filter((term) => text.includes(term.toLowerCase()));
    expect(found, `forbidden terms: ${found.join(", ")}`).toEqual([]);
  });
});

describe("three stage minimums, not one field", () => {
  it("offers a separate minimum for each stage transition", async () => {
    const user = userEvent.setup();
    renderPolicies();
    await user.click(screen.getByRole("button", { name: /Edit policy/ }));

    expect(screen.getByLabelText("Shadow to Assisted minimum cases")).toHaveValue(200);
    expect(screen.getByLabelText("Assisted to Supervised minimum cases")).toHaveValue(200);
    expect(screen.getByLabelText("Supervised to Constrained minimum cases")).toHaveValue(300);
  });

  it("shows the PRD's evidence coverage default", async () => {
    const user = userEvent.setup();
    renderPolicies();
    await user.click(screen.getByRole("button", { name: /Edit policy/ }));
    expect(screen.getByLabelText("Evidence coverage")).toHaveValue(98);
  });
});

describe("saving publishes a version rather than overwriting", () => {
  it("warns which version will be published before saving", async () => {
    const user = userEvent.setup();
    const { container } = renderPolicies();
    await user.click(screen.getByRole("button", { name: /Edit policy/ }));
    expect(container.textContent).toContain("publishes");
    expect(container.textContent).toContain("v1.4");
    expect(container.textContent).toContain(
      "historical decisions continue to reference the version used at the time",
    );
  });

  it("creates v1.4 from v1.3 and records what changed", async () => {
    renderPolicies();
    await editConfidentWrong("1");

    const stored = loadDemoState();
    expect(stored.policies).toHaveLength(1);
    const published = stored.policies[0];
    expect(published?.version).toBe("1.4");
    expect(published?.based_on).toBe("1.3");
    expect(published?.task_id).toBe("routine-rule-application");
    expect(published?.stages.supervised_to_constrained.max_confident_wrong_rate).toBe(0.01);
    expect(published?.change_note).toContain("Confident-but-wrong limit for Constrained");
  });

  it("refuses to publish a version when nothing changed", async () => {
    const user = userEvent.setup();
    const { container } = renderPolicies();
    await user.click(screen.getByRole("button", { name: /Edit policy/ }));
    await user.click(screen.getByRole("button", { name: "Save as new version" }));
    expect(container.textContent).toContain("Nothing has changed");
    expect(loadDemoState().policies).toHaveLength(0);
  });

  it("keeps earlier versions in the history, marked superseded", async () => {
    const { container } = renderPolicies();
    await editConfidentWrong("1");

    const history = screen.getByText("Policy history").closest("section") as HTMLElement;
    expect(within(history).getByText("v1.4")).toBeInTheDocument();
    expect(within(history).getByText("v1.3")).toBeInTheDocument();
    expect(within(history).getByText("v1.2")).toBeInTheDocument();
    expect(within(history).getByText("Published by you")).toBeInTheDocument();
    expect(container.textContent).toContain("Nothing here is overwritten");
  });
});

describe("a policy change reaches the scorecard", () => {
  it("turns a held task into a promotable one when the limit is loosened", async () => {
    // Routine rule application sits at 0.88% confident-but-wrong against a 0.25%
    // limit. Loosening the limit past it should change the recommendation.
    const policies = renderPolicies();
    await editConfidentWrong("2");
    policies.unmount();

    const scorecard = await renderScorecard("routine-rule-application");
    expect(await screen.findByText(/You published policy v1.4/)).toBeInTheDocument();
    // The recommendation itself flipped, not merely a scope row.
    expect(scorecard.container.textContent).not.toContain("Remain Supervised");
    expect(screen.getAllByText("Eligible for promotion").length).toBeGreaterThan(0);
    expect(scorecard.container.textContent).toContain(
      "Every criterion for the next autonomy level has been met.",
    );
    expect(scorecard.container.textContent).toContain("≤ 2.0%");
  });

  it("leaves the task held when the limit is tightened instead", async () => {
    const policies = renderPolicies();
    await editConfidentWrong("0.1");
    policies.unmount();

    const scorecard = await renderScorecard("routine-rule-application");
    expect(scorecard.container.textContent).toContain("Remain Supervised");
    expect(scorecard.container.textContent).toContain("≤ 0.10%");
  });

  it("changes nothing for other tasks", async () => {
    const policies = renderPolicies();
    await editConfidentWrong("2");
    policies.unmount();

    const other = await renderScorecard("match-invoice-to-ledger");
    expect(other.container.textContent).not.toContain("You published policy");
    expect(other.container.textContent).toContain("v1.2");
  });
});

describe("history is not rewritten by a policy change", () => {
  it("adds the new version to the log without disturbing what is already there", async () => {
    const before = renderAudit();
    const beforeRows = [...before.container.querySelectorAll("tbody tr")].map(
      (row) => row.textContent,
    );
    before.unmount();

    const policies = renderPolicies();
    await editConfidentWrong("2");
    policies.unmount();

    const after = renderAudit();
    const afterRows = [...after.container.querySelectorAll("tbody tr")].map(
      (row) => row.textContent,
    );

    // One new record, and every earlier one untouched.
    expect(afterRows).toHaveLength(beforeRows.length + 1);
    for (const row of beforeRows) {
      expect(afterRows).toContain(row);
    }
    expect(after.container.textContent).toContain("Policy v1.3");
    expect(after.container.textContent).toContain("Policy v1.4");
  });

  it("keeps a decision pinned to the version it was made under", async () => {
    const policies = renderPolicies();
    await editConfidentWrong("2");
    policies.unmount();

    const user = userEvent.setup();
    renderAudit();
    const buttons = screen.getAllByRole("button", { name: "View details" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);
    const drawer = screen.getByRole("dialog");
    // Published v1.4 above; this 2026-05-18 decision still reads v1.2.
    expect(within(drawer).getByText("v1.2")).toBeInTheDocument();
    expect(within(drawer).getByText(/remains linked to policy v1.2/)).toBeInTheDocument();
  });
});

describe("rule versions", () => {
  it("names the task's own rule pack, since packs are per task", () => {
    const { container } = renderPolicies();
    expect(container.textContent).toContain("Routine tax rules");
    expect(container.textContent).toContain("Rule sets are defined per task");
  });

  it("raises the one mismatched task with its versions", () => {
    const { container } = renderPolicies();
    const text = container.textContent ?? "";
    expect(text).toContain("Draft tax position");
    expect(text).toContain("v2.3");
    expect(text).toContain("v2.4");
    expect(text).toContain("paused until the versions align");
  });
});
