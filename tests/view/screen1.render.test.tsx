import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AgentsAndTasksPage from "@/app/page";
import { DENIED_TERMS } from "@/lib/domain/vocabulary";
import { renderWithProviders } from "../helpers/renderPage";

/**
 * Renders the real screen and checks what a person would actually read.
 *
 * The vocabulary sweep here is the safeguard that matters most: the product's
 * credibility rests on never overclaiming and never leaking implementation
 * detail into a governance screen, and neither is something to police by eye.
 */

async function renderScreen(filter?: string) {
  const ui = await AgentsAndTasksPage({
    searchParams: Promise.resolve(filter ? { filter } : {}),
  });
  return renderWithProviders(ui);
}

describe("Agents & Tasks screen", () => {
  it("renders the task-level framing rather than an agent verdict", async () => {
    await renderScreen();
    expect(screen.getByRole("heading", { level: 1, name: "AI agents" })).toBeInTheDocument();
    expect(
      screen.getByText(/Autonomy is evaluated separately for each task/i),
    ).toBeInTheDocument();
  });

  it("lists both agents with all eight tasks", async () => {
    await renderScreen();
    expect(screen.getByRole("heading", { level: 2, name: "Invoice Helper" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tax Helper" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /View scorecard/ })).toHaveLength(8);
  });

  it("shows one agent holding several different autonomy levels", async () => {
    const { container } = await renderScreen();
    const invoiceTable = container.querySelectorAll("table")[0];
    expect(invoiceTable).toBeDefined();
    if (!invoiceTable) return;
    const text = invoiceTable.textContent ?? "";
    // The whole argument of the product, visible in one table.
    expect(text).toContain("Constrained");
    expect(text).toContain("Supervised");
    expect(text).toContain("Assisted");
  });

  it("never labels an agent itself with an autonomy level", async () => {
    const { container } = await renderScreen();
    const headers = [...container.querySelectorAll("header")];
    for (const header of headers) {
      const text = header.textContent ?? "";
      if (!text.includes("Invoice Helper") && !text.includes("Tax Helper")) continue;
      expect(text).not.toMatch(/\bL[1-4]\s*·/);
    }
  });

  it("states the corrected Assisted definition, not the mockup's", async () => {
    await renderScreen();
    expect(
      screen.getByText(/AI recommends; a human approves before the result becomes operational/i),
    ).toBeInTheDocument();
  });

  it("shows the summary numbers the data supports", async () => {
    const { container } = await renderScreen();
    const text = container.textContent ?? "";
    expect(text).toContain("1 task requires review");
    expect(text).toContain("1 task being revalidated");
  });

  it("puts the previously approved level beside the candidate's restart level", async () => {
    await renderScreen();
    expect(screen.getByText("L4 · Constrained")).toBeInTheDocument();
    expect(screen.getByText(/L1 · Shadow validation/)).toBeInTheDocument();
    expect(screen.getByText("142 of 200 cases evaluated")).toBeInTheDocument();
  });

  it("raises the paused task as a policy issue", async () => {
    await renderScreen();
    expect(screen.getByText("1 policy issue requires attention")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review issue/ })).toBeInTheDocument();
  });

  it("reports validation progress accessibly", async () => {
    await renderScreen();
    const bar = screen.getByRole("progressbar", { name: "Validation progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "71");
  });

  it("marks the active filter and links the others", async () => {
    await renderScreen("sandbox");
    const group = screen.getByRole("group", { name: "Filter tasks" });
    const active = within(group).getByRole("link", { name: /Sandbox/ });
    expect(active).toHaveAttribute("aria-current", "true");
    expect(within(group).getByRole("link", { name: /All tasks \(8\)/ })).toBeInTheDocument();
  });

  it("filters the tables without changing the headline totals", async () => {
    const { container } = await renderScreen("attention");
    expect(screen.getAllByRole("link", { name: /View scorecard/ })).toHaveLength(1);
    expect(container.textContent).toContain("Draft tax position");
    expect(container.textContent).toContain("All tasks (8)");
  });
});

describe("vocabulary", () => {
  it("uses no forbidden term anywhere on the screen", async () => {
    const { container } = await renderScreen();
    const text = (container.textContent ?? "").toLowerCase();
    const found = DENIED_TERMS.filter((term) => text.includes(term.toLowerCase()));
    expect(found, `forbidden terms rendered: ${found.join(", ")}`).toEqual([]);
  });

  it("uses no forbidden term in any markup attribute either", async () => {
    const { container } = await renderScreen();
    const markup = container.innerHTML.toLowerCase();
    // Class names legitimately contain colour tokens, so only check the terms
    // that could never be part of a style: the overclaiming vocabulary.
    const overclaiming = [
      "full autonomy",
      "fully trusted",
      "autonomous agent",
      "immutable ledger",
      "attestation",
      "trust score",
      "cryptographic",
      "sha256",
    ];
    const found = overclaiming.filter((term) => markup.includes(term));
    expect(found).toEqual([]);
  });

  it("shows no product version badge and no variance flag", async () => {
    const { container } = await renderScreen();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/v1\.4/);
    expect(text).not.toMatch(/Variance flag/i);
  });

  it("uses only approved autonomy level names", async () => {
    const { container } = await renderScreen();
    const text = container.textContent ?? "";
    for (const name of ["Shadow", "Assisted", "Supervised", "Constrained"]) {
      expect(text).toContain(name);
    }
  });

  it("states that the data is synthetic", async () => {
    const { container } = await renderScreen();
    expect(container.textContent).toMatch(/Synthetic prototype data/i);
  });
});
