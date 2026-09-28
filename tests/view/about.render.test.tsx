import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AboutPanel } from "@/components/AboutPanel";
import { DENIED_TERMS } from "@/lib/domain/vocabulary";
import { renderWithProviders } from "../helpers/renderPage";

/**
 * The prototype disclosure.
 *
 * The single most misleading thing this product could do is present a seeded
 * classification as a live one. This is where it says which it is.
 */

async function openPanel(props: Parameters<typeof AboutPanel>[0] = {}) {
  const user = userEvent.setup();
  const rendered = renderWithProviders(<AboutPanel {...props} />);
  await user.click(screen.getByRole("button", { name: "About this prototype" }));
  return { ...rendered, dialog: screen.getByRole("dialog") };
}

describe("what it always says", () => {
  it("states that the data is synthetic and decisions are human-controlled", async () => {
    const { dialog } = await openPanel();
    const text = dialog.textContent ?? "";
    expect(text).toContain("synthetic portfolio prototype");
    expect(text).toContain("does not use real customer or accounting data");
    expect(text).toContain("final decisions remain human-controlled");
  });

  it("states that thresholds are assumptions, not standards", async () => {
    const { dialog } = await openPanel();
    expect(dialog.textContent).toContain("not accounting or regulatory standards");
  });

  it("explains where a visitor's own changes live", async () => {
    const { dialog } = await openPanel();
    const text = dialog.textContent ?? "";
    expect(text).toContain("kept in your own browser");
    expect(text).toContain("Reset demo removes them");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    await openPanel();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("it says which provider is actually in use", () => {
  it("says classifications are seeded when nothing is configured", async () => {
    const { dialog } = await openPanel({ classificationIsLive: false });
    const text = dialog.textContent ?? "";
    expect(text).toContain("seeded prototype responses, not a live external service");
    // And that the governance behaviour is the same either way.
    expect(text).toContain("confirmed by a person before they count as evidence");
  });

  it("says classifications are live when one is configured", async () => {
    const { dialog } = await openPanel({ classificationIsLive: true });
    const text = dialog.textContent ?? "";
    expect(text).toContain("produced by a live external service");
    expect(text).not.toContain("seeded prototype responses");
  });

  it("says summaries come from templates when nothing is configured", async () => {
    const { dialog } = await openPanel({ explanationIsLive: false });
    const text = dialog.textContent ?? "";
    expect(text).toContain("written from fixed templates, not a live external service");
    expect(text).toContain("cannot change it");
  });

  it("says summaries are live when one is configured", async () => {
    const { dialog } = await openPanel({ explanationIsLive: true });
    const text = dialog.textContent ?? "";
    expect(text).toContain("rephrased by a live external service");
    expect(text).toContain("cannot change it");
  });

  it("never presents a seeded classification as a live one", async () => {
    const { dialog } = await openPanel({ classificationIsLive: false });
    const classifications = within(dialog)
      .getByText("Review classifications")
      .parentElement?.textContent;
    expect(classifications).toContain("not a live external service");
  });
});

describe("vocabulary", () => {
  it.each([
    [true, true],
    [false, false],
  ])("names no provider (classification %s, explanation %s)", async (c, e) => {
    const { dialog } = await openPanel({ classificationIsLive: c, explanationIsLive: e });
    const text = (dialog.textContent ?? "").toLowerCase();
    const found = DENIED_TERMS.filter((term) => text.includes(term.toLowerCase()));
    expect(found, `forbidden terms: ${found.join(", ")}`).toEqual([]);
    for (const term of ["typesafe", "groq", "jev", "sdk", "api key"]) {
      expect(text, term).not.toContain(term);
    }
  });
});
