import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/AppShell";
import { NAV_ITEMS } from "@/lib/config/routes";

describe("AppShell", () => {
  it("renders the product name and tagline", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByText("Autonomy Gate")).toBeInTheDocument();
    expect(screen.getByText("Evidence-based autonomy for AI tasks")).toBeInTheDocument();
  });

  it("renders exactly the four approved top-level destinations", () => {
    render(<AppShell>content</AppShell>);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = nav.querySelectorAll("a");
    expect(links).toHaveLength(4);
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }
  });

  it("does not show a product version badge in the header", () => {
    const { container } = render(<AppShell>content</AppShell>);
    expect(container.textContent).not.toMatch(/v1\.4/);
  });

  it("identifies itself as a prototype using synthetic data", () => {
    const { container } = render(<AppShell>content</AppShell>);
    expect(screen.getAllByText(/Prototype/i).length).toBeGreaterThan(0);
    expect(container.textContent).toMatch(/Synthetic prototype data/i);
  });

  it("offers the prototype disclosure entry point", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByRole("button", { name: "About this prototype" })).toBeInTheDocument();
  });

  it("keeps the navigation reachable on a narrow screen", () => {
    // On a phone the four destinations do not fit. The strip scrolls rather than
    // wrapping each label onto three lines and clipping the last one, which is
    // what happened before: Audit Log could not be reached at all.
    const { container } = render(<AppShell>content</AppShell>);
    const nav = container.querySelector('nav[aria-label="Primary"]');
    expect(nav?.className).toContain("overflow-x-auto");
    for (const link of nav?.querySelectorAll("a") ?? []) {
      expect(link.className).toContain("whitespace-nowrap");
      expect(link.className).toContain("shrink-0");
    }
  });

  it("renders its children", () => {
    render(
      <AppShell>
        <p>page body</p>
      </AppShell>,
    );
    expect(screen.getByText("page body")).toBeInTheDocument();
  });
});
