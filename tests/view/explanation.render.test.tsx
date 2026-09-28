import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskScorecardPage from "@/app/tasks/[taskId]/page";
import { DENIED_TERMS } from "@/lib/domain/vocabulary";
import { renderWithProviders } from "../helpers/renderPage";

async function renderScorecard(taskId = "routine-rule-application") {
  return renderWithProviders(await TaskScorecardPage({ params: Promise.resolve({ taskId }) }));
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  globalThis.localStorage?.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("without the live layer", () => {
  it("shows the deterministic wording, labelled as standard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ summary: "ignored", source: "standard" })),
    );
    const { container } = await renderScorecard();

    expect(container.textContent).toContain("0.88%");
    expect(container.textContent).toContain("0.25%");
    expect(await screen.findByText("Standard summary")).toBeInTheDocument();
  });

  it("renders wording immediately, before any request resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const { container } = await renderScorecard();
    // The explanation is on screen while the request is still outstanding.
    expect(container.textContent).toContain("high-confidence wrong answers");
    expect(screen.getByText("Standard summary")).toBeInTheDocument();
  });
});

describe("with the live layer", () => {
  it("replaces the wording and changes the label", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          summary: "This task stays Supervised because too many confident answers were wrong.",
          source: "live",
        }),
      ),
    );
    await renderScorecard();

    expect(
      await screen.findByText(
        "This task stays Supervised because too many confident answers were wrong.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Plain-language summary")).toBeInTheDocument();
    expect(screen.queryByText("Standard summary")).not.toBeInTheDocument();
  });

  it("sends the decision code and quoted figures, and no evidence", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ summary: "x", source: "live" }));
    vi.stubGlobal("fetch", fetchMock);
    await renderScorecard();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/explain");
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sent.code).toBe("HOLD_CONFIDENT_WRONG_RATE");
    expect(Object.keys(sent)).toEqual(["code", "target_level_label", "detail"]);
    // Nothing resembling the evidence is in the request.
    expect(JSON.stringify(sent)).not.toContain("RUN-");
    expect(JSON.stringify(sent)).not.toContain("CASE-");
  });
});

describe("when the layer fails", () => {
  it.each([
    ["a refusal", async () => jsonResponse({ error: "no" }, 503)],
    ["a server error", async () => jsonResponse({ error: "no" }, 500)],
    ["an empty reply", async () => jsonResponse({ summary: "", source: "live" })],
    [
      "a thrown request",
      async () => {
        throw new Error("network down");
      },
    ],
  ])("falls back silently on %s", async (_label, responder) => {
    vi.stubGlobal("fetch", vi.fn(responder as () => Promise<Response>));
    const { container } = await renderScorecard();

    expect(await screen.findByText("Standard summary")).toBeInTheDocument();
    expect(container.textContent).toContain("0.88%");

    // The reader is never told a provider had a problem. Only phrases that
    // could not appear in ordinary governance copy are checked: "could not", for
    // instance, is legitimate in "something the previous one could not".
    const text = (container.textContent ?? "").toLowerCase();
    for (const phrase of ["unavailable", "outage", "try again", "provider", "groq"]) {
      expect(text, phrase).not.toContain(phrase);
    }
  });

  it("leaves the recommendation itself untouched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 503)));
    const { container } = await renderScorecard();
    expect(container.textContent).toContain("Remain Supervised");
    expect(container.textContent).toContain("Needs improvement");
  });
});

describe("vocabulary", () => {
  it("names no provider, live or not", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ summary: "Rephrased wording.", source: "live" })),
    );
    const { container } = await renderScorecard();
    await screen.findByText("Plain-language summary");

    const text = (container.textContent ?? "").toLowerCase();
    const found = DENIED_TERMS.filter((term) => text.includes(term.toLowerCase()));
    expect(found, `forbidden terms: ${found.join(", ")}`).toEqual([]);
  });
});
