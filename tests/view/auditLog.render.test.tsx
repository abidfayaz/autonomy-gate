import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import AuditLogPage from "@/app/audit/page";
import AutonomyDecisionPage from "@/app/tasks/[taskId]/decision/page";
import { DENIED_TERMS } from "@/lib/domain/vocabulary";
import { renderWithProviders } from "../helpers/renderPage";

const renderAudit = () => renderWithProviders(AuditLogPage());

async function renderDecision(taskId: string) {
  return renderWithProviders(
    await AutonomyDecisionPage({ params: Promise.resolve({ taskId }) }),
  );
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});

describe("the log reads as a governance record", () => {
  it("shows the seeded history with its column headings", () => {
    const { container } = renderAudit();
    const table = container.querySelector("table");
    const headings = [...(table?.querySelectorAll("th") ?? [])].map((th) => th.textContent);
    expect(headings).toEqual(["Date", "Agent & task", "Event", "Change", "By", "Status", "Details"]);
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(8);
  });

  it("states that history keeps the policy version used at the time", () => {
    const { container } = renderAudit();
    expect(container.textContent).toContain(
      "Historical decisions keep the policy version used at the time.",
    );
    expect(container.textContent).toContain("not edited or recalculated when a policy changes");
  });

  it("does not read as a technical system log", () => {
    const { container } = renderAudit();
    const text = (container.textContent ?? "").toLowerCase();
    // Terms that only appear in a technical log. "exception" is excluded on
    // purpose: it is ordinary governance vocabulary here, as in
    // "Detect invoice exceptions" and "missed critical exceptions".
    for (const term of ["stack trace", "payload", "request id", "endpoint", "status code"]) {
      expect(text, term).not.toContain(term);
    }
  });

  it("uses no forbidden term", () => {
    const { container } = renderAudit();
    const text = (container.textContent ?? "").toLowerCase();
    const found = DENIED_TERMS.filter((term) => text.includes(term.toLowerCase()));
    expect(found, `forbidden terms: ${found.join(", ")}`).toEqual([]);
  });

  it("carries none of the corrupted strings from the reference mockup", () => {
    const { container } = renderAudit();
    const text = container.textContent ?? "";
    expect(text).not.toContain("Autonomy decisions decisions");
    expect(text).not.toContain("Policy changes v1.2");
    expect(text).not.toContain("Previous decisions");
    expect(text).not.toContain("Enterprise AI Safety Framework");
  });
});

describe("filters", () => {
  it("narrows to one kind of event", async () => {
    const user = userEvent.setup();
    const { container } = renderAudit();
    await user.click(screen.getByRole("button", { name: "Policy changes" }));
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(container.textContent).toContain("Policy change");
  });

  it("narrows by agent, and resets the task list with it", async () => {
    const user = userEvent.setup();
    const { container } = renderAudit();
    await user.selectOptions(screen.getByLabelText("Agent"), "invoice-helper");
    const rows = [...container.querySelectorAll("tbody tr")];
    for (const row of rows) {
      expect(row.textContent).toContain("Invoice Helper");
    }
  });

  it("narrows by task", async () => {
    const user = userEvent.setup();
    const { container } = renderAudit();
    await user.selectOptions(screen.getByLabelText("Task"), "draft-tax-position");
    const rows = [...container.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Draft tax position");
  });

  it("narrows by date", async () => {
    const user = userEvent.setup();
    const { container } = renderAudit();
    await user.click(screen.getByRole("button", { name: "Quarter to date" }));
    const rows = [...container.querySelectorAll("tbody tr")];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(8);
  });

  it("says so when nothing matches, rather than showing an empty table", async () => {
    const user = userEvent.setup();
    const { container } = renderAudit();
    await user.selectOptions(screen.getByLabelText("Task"), "draft-tax-position");
    await user.click(screen.getByRole("button", { name: "Policy changes" }));
    expect(container.textContent).toContain("No records match these filters.");
  });
});

describe("decision detail", () => {
  it("opens a drawer with the frozen evidence and the versions of the day", async () => {
    const user = userEvent.setup();
    renderAudit();
    const buttons = screen.getAllByRole("button", { name: "View details" });
    expect(buttons.length).toBeGreaterThan(0);
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Evidence at the time")).toBeInTheDocument();
    expect(within(drawer).getByText("System recommendation")).toBeInTheDocument();
    expect(within(drawer).getByText("Final decision")).toBeInTheDocument();
    expect(within(drawer).getByText("Decision reason")).toBeInTheDocument();
    expect(within(drawer).getByText(/remains linked to policy v/)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderAudit();
    await user.click(screen.getAllByRole("button", { name: "View details" })[0] as HTMLElement);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("states that a decision does not generalise across the agent's other tasks", async () => {
    const user = userEvent.setup();
    renderAudit();
    await user.click(screen.getAllByRole("button", { name: "View details" })[0] as HTMLElement);
    expect(
      within(screen.getByRole("dialog")).getByText(/does not generalise across/),
    ).toBeInTheDocument();
  });
});

describe("a decision recorded in this session", () => {
  it("appears in the log, marked as this visitor's own", async () => {
    const user = userEvent.setup();
    const decisionView = await renderDecision("match-invoice-to-ledger");
    await user.click(await screen.findByRole("radio", { name: /Approve L4 · Constrained/ }));
    await user.type(screen.getByLabelText("Decision reason"), "Every criterion has been met.");
    await user.click(screen.getByRole("button", { name: /Confirm decision/ }));
    expect(await screen.findByText("Decision recorded")).toBeInTheDocument();
    decisionView.unmount();

    const { container } = renderAudit();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(9);
    expect(screen.getByText("Recorded by you")).toBeInTheDocument();
    expect(container.textContent).toContain("L3 · Supervised");
    expect(container.textContent).toContain("L4 · Constrained");
  });

  it("keeps its own evidence snapshot in the drawer", async () => {
    const user = userEvent.setup();
    const decisionView = await renderDecision("match-invoice-to-ledger");
    await user.click(await screen.findByRole("radio", { name: /Approve L4 · Constrained/ }));
    await user.type(screen.getByLabelText("Decision reason"), "Every criterion has been met.");
    await user.click(screen.getByRole("button", { name: /Confirm decision/ }));
    decisionView.unmount();

    renderAudit();
    await user.click(screen.getAllByRole("button", { name: "View details" })[0] as HTMLElement);
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText(/You recorded this decision in this session/)).toBeInTheDocument();
    expect(within(drawer).getByText("Every criterion has been met.", { exact: false })).toBeInTheDocument();
    // 308 Supervised-mode cases, frozen at the moment it was recorded.
    expect(within(drawer).getByText("308")).toBeInTheDocument();
  });

  it("disappears again when the demo is reset", async () => {
    const user = userEvent.setup();
    const decisionView = await renderDecision("match-invoice-to-ledger");
    await user.click(await screen.findByRole("radio", { name: /Approve L4 · Constrained/ }));
    await user.type(screen.getByLabelText("Decision reason"), "Every criterion has been met.");
    await user.click(screen.getByRole("button", { name: /Confirm decision/ }));
    decisionView.unmount();

    globalThis.localStorage.clear();

    const { container } = renderAudit();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(8);
    expect(screen.queryByText("Recorded by you")).not.toBeInTheDocument();
  });
});
